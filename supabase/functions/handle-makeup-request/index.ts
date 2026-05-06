import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createCalendarEvent, deleteCalendarEvent, deleteCalendarEventsBySearch, formatEventTitle } from "./gcal.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "인증이 필요합니다." }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "인증이 필요합니다." }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = user.id;

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Check instructor/manager role
    const { data: roleData } = await sb.from("user_roles").select("role")
      .eq("user_id", userId).in("role", ["admin", "manager", "instructor"]);
    if (!roleData || roleData.length === 0) {
      return new Response(JSON.stringify({ error: "권한이 없습니다." }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, request_id, reject_reason } = await req.json();

    // Get the request
    const { data: makeupReq, error: reqErr } = await sb
      .from("makeup_requests").select("*").eq("id", request_id).single();
    if (reqErr || !makeupReq) throw new Error("요청을 찾을 수 없습니다.");
    if (action !== "cancel" && makeupReq.status !== "pending") throw new Error("이미 처리된 요청입니다.");

    // Get the slot (may be null for legacy approved requests where slot was not booked through the flow)
    let slot: any = null;
    if (makeupReq.slot_id) {
      const { data: slotData } = await sb
        .from("instructor_available_slots").select("*").eq("id", makeupReq.slot_id).maybeSingle();
      slot = slotData;
    }
    // For approve/reject we still require a slot
    if ((action === "approve" || action === "reject") && !slot) {
      throw new Error("슬롯 정보를 찾을 수 없습니다.");
    }

    // Helper: lookup student details for calendar title/meet link
    const fetchStudentInfo = async (studentName: string) => {
      const { data } = await sb.from("instructor_students")
        .select("english_name, student_type, meet_link")
        .eq("student_name", studentName)
        .eq("status", "active")
        .maybeSingle();
      return {
        english_name: data?.english_name || null,
        student_type: data?.student_type || "regular",
        meet_link: data?.meet_link || null,
      };
    };

    // Helper: lookup which Google Calendar to write to for an instructor,
    // and an optional display_name (e.g. "Reina") to use in event titles.
    // Priority for display name: instructors.english_name > mapping.display_name > instructor_name
    const fetchInstructorMapping = async (instructorName: string): Promise<{ calendarId: string | null; displayName: string | null }> => {
      const [mapRes, instRes] = await Promise.all([
        sb.from("instructor_calendar_mapping")
          .select("gcal_calendar_id, display_name")
          .eq("instructor_name", instructorName)
          .maybeSingle(),
        sb.from("instructors")
          .select("english_name")
          .eq("name", instructorName)
          .maybeSingle(),
      ]);
      const englishName = instRes.data?.english_name || null;
      return {
        calendarId: mapRes.data?.gcal_calendar_id || null,
        displayName: englishName || mapRes.data?.display_name || null,
      };
    };

    if (action === "approve") {
      const newScheduledAt = new Date(`${slot.slot_date}T${slot.slot_time}+09:00`).toISOString();

      if (makeupReq.request_type === "reschedule" && makeupReq.original_session_id) {
        // Get original session
        const { data: origSession } = await sb
          .from("class_sessions").select("*").eq("id", makeupReq.original_session_id).single();
        if (!origSession) throw new Error("원래 세션을 찾을 수 없습니다.");

        // Save original_scheduled_at to makeup_requests for history
        await sb.from("makeup_requests").update({
          original_scheduled_at: origSession.scheduled_at,
        }).eq("id", request_id);

        // Compute KST date strings
        const origDate = new Date(origSession.scheduled_at);
        const origDateStr = origDate.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
        const origHour = origDate.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul" });

        // GCAL: delete the original event — original time slot disappears from calendar.
        // Prefer token-based delete; fall back to a ±30min search of the
        // instructor's mapped calendar for events containing the student name
        // (covers manually-created regular-class events that have no token).
        const origInstMapping = await fetchInstructorMapping(origSession.instructor_name);
        if (origSession.gcal_event_id) {
          await deleteCalendarEvent(origSession.gcal_event_id);
        } else {
          await deleteCalendarEventsBySearch({
            calendarId: origInstMapping.calendarId,
            studentName: origSession.student_name,
            scheduledISO: origSession.scheduled_at,
          });
        }

        // 1) Detach makeup_requests references and delete the original session
        //    (we no longer mark it as sick — that was incorrectly labeling student-initiated reschedules)
        await sb.from("makeup_requests").update({ original_session_id: null })
          .eq("original_session_id", makeupReq.original_session_id)
          .neq("id", request_id);
        await sb.from("class_sessions").delete().eq("id", makeupReq.original_session_id);

        // GCAL: create a new event at the new time
        const stuInfo = await fetchStudentInfo(origSession.student_name);
        const instMapping = await fetchInstructorMapping(origSession.instructor_name);
        const title = formatEventTitle({
          studentName: origSession.student_name,
          englishName: stuInfo.english_name,
          studentType: stuInfo.student_type,
          instructorName: instMapping.displayName || origSession.instructor_name,
        });
        const newEventId = await createCalendarEvent({
          title,
          startISO: newScheduledAt,
          meetLink: stuInfo.meet_link || origSession.meet_link,
          description: `보강 (강사: ${origSession.instructor_name})`,
          calendarId: instMapping.calendarId,
        });

        // 2) Create new makeup session at newScheduledAt — preserves notes/topic/remarks
        await sb.from("class_sessions").insert({
          student_name: origSession.student_name,
          instructor_name: origSession.instructor_name,
          scheduled_at: newScheduledAt,
          level: origSession.level || "B1",
          meet_link: origSession.meet_link || null,
          group_students: Array.isArray(origSession.group_students) ? origSession.group_students : [],
          notes: origSession.notes || null,
          topic: origSession.topic || null,
          remarks: origSession.remarks || null,
          reschedule_origin_dates: [origDateStr],
          gcal_event_id: newEventId,
        });

        // Re-open original time slot for other students (only if not already exists)
        const { data: existingSlot } = await sb.from("instructor_available_slots")
          .select("id")
          .eq("instructor_id", slot.instructor_id)
          .eq("slot_date", origDateStr)
          .eq("slot_time", origHour + ":00")
          .maybeSingle();

        if (!existingSlot) {
          await sb.from("instructor_available_slots").insert({
            instructor_id: slot.instructor_id,
            instructor_name: slot.instructor_name,
            slot_date: origDateStr,
            slot_time: origHour + ":00",
            status: "open",
          }).select();
        } else {
          // If slot exists but is booked, release it
          await sb.from("instructor_available_slots")
            .update({ status: "open" })
            .eq("id", existingSlot.id)
            .eq("status", "booked");
        }

    } else if (makeupReq.request_type === "extra") {
        // Create new session
        const { data: studentRec } = await sb.from("instructor_students")
          .select("level, meet_link, group_students, english_name, student_type")
          .eq("student_name", makeupReq.student_name)
          .eq("status", "active")
          .maybeSingle();

        // Check if original cancelled session has notes/topic to transfer
        let transferNotes: string | null = null;
        let transferTopic: string | null = null;
        let transferRemarks: string | null = null;
        if (makeupReq.original_session_id) {
          const { data: origSession } = await sb
            .from("class_sessions").select("notes, topic, remarks")
            .eq("id", makeupReq.original_session_id).single();
          if (origSession) {
            transferNotes = origSession.notes || null;
            transferTopic = origSession.topic || null;
            transferRemarks = origSession.remarks || null;
          }
        }

        // GCAL: create event for the new extra session
        const instMapping = await fetchInstructorMapping(makeupReq.instructor_name);
        const title = formatEventTitle({
          studentName: makeupReq.student_name,
          englishName: studentRec?.english_name || null,
          studentType: studentRec?.student_type || "regular",
          instructorName: instMapping.displayName || makeupReq.instructor_name,
        });
        const newEventId = await createCalendarEvent({
          title,
          startISO: newScheduledAt,
          meetLink: studentRec?.meet_link || null,
          description: `보강 (강사: ${makeupReq.instructor_name})`,
          calendarId: instMapping.calendarId,
        });

        await sb.from("class_sessions").insert({
          student_name: makeupReq.student_name,
          instructor_name: makeupReq.instructor_name,
          scheduled_at: newScheduledAt,
          level: studentRec?.level || "B1",
          meet_link: studentRec?.meet_link || null,
          group_students: Array.isArray(makeupReq.group_students) && makeupReq.group_students.length > 0
            ? makeupReq.group_students
            : (studentRec?.group_students || []),
          notes: transferNotes,
          topic: transferTopic,
          remarks: transferRemarks,
          gcal_event_id: newEventId,
        });

        // Clear notes/topic from original cancelled session (moved, not copied)
        if (makeupReq.original_session_id && (transferNotes || transferTopic)) {
          await sb.from("class_sessions").update({
            notes: null,
            topic: null,
            remarks: null,
          }).eq("id", makeupReq.original_session_id);
        }
      }

      // If this makeup request is linked to a cancelled session, mark it as resolved
      if (makeupReq.original_session_id && makeupReq.request_type === "extra") {
        await sb.from("class_sessions").update({
          cancellation_resolution: "makeup_completed",
        }).eq("id", makeupReq.original_session_id);
      }

      // Close the booked slot
      await sb.from("instructor_available_slots")
        .update({ status: "booked" })
        .eq("id", makeupReq.slot_id);

      // Update request status
      await sb.from("makeup_requests").update({
        status: "approved",
        resolved_at: new Date().toISOString(),
      }).eq("id", request_id);

      return new Response(JSON.stringify({ success: true, action: "approved" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "reject") {
      // Re-open the slot
      await sb.from("instructor_available_slots")
        .update({ status: "open" })
        .eq("id", makeupReq.slot_id);

      // Update request
      await sb.from("makeup_requests").update({
        status: "rejected",
        reject_reason: reject_reason || null,
        resolved_at: new Date().toISOString(),
      }).eq("id", request_id);

      return new Response(JSON.stringify({ success: true, action: "rejected" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    } else if (action === "cancel") {
      // Cancel an approved (or student-requested-cancel) makeup request —
      // undo session changes and re-open slot.
      if (makeupReq.status !== "approved" && makeupReq.status !== "cancel_requested") {
        throw new Error("승인된 요청만 취소할 수 있습니다.");
      }

      // Determine the makeup session's scheduled time.
      // Prefer the booked slot; fall back to looking up the makeup session
      // via reschedule_origin_dates (covers legacy approvals that have no slot_id).
      let newScheduledAt: string | null = slot
        ? new Date(`${slot.slot_date}T${slot.slot_time}+09:00`).toISOString()
        : null;

      if (makeupReq.request_type === "reschedule" && makeupReq.original_session_id) {
        if (!makeupReq.original_scheduled_at) throw new Error("원래 일정 정보가 없습니다.");

        const origDateStrForMatch = new Date(makeupReq.original_scheduled_at)
          .toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });

        // Find the makeup session — try by exact scheduled_at first, then by reschedule_origin_dates
        let makeupRow: any = null;
        if (newScheduledAt) {
          const { data: byTime } = await sb
            .from("class_sessions")
            .select("id, notes, topic, remarks, gcal_event_id, instructor_name, student_name, meet_link, scheduled_at")
            .eq("student_name", makeupReq.student_name)
            .eq("scheduled_at", newScheduledAt);
          if (byTime && byTime.length > 0) makeupRow = byTime[0];
        }
        if (!makeupRow) {
          const { data: byOrigin } = await sb
            .from("class_sessions")
            .select("id, notes, topic, remarks, gcal_event_id, instructor_name, student_name, meet_link, scheduled_at")
            .eq("student_name", makeupReq.student_name)
            .contains("reschedule_origin_dates", [origDateStrForMatch])
            .order("scheduled_at", { ascending: false });
          if (byOrigin && byOrigin.length > 0) makeupRow = byOrigin[0];
        }
        if (makeupRow && !newScheduledAt) newScheduledAt = makeupRow.scheduled_at;

        // GCAL: delete the makeup event
        if (makeupRow?.gcal_event_id) {
          await deleteCalendarEvent(makeupRow.gcal_event_id);
        }

        // GCAL: re-create the original event (since we deleted it on approve)
        const stuInfo = await fetchStudentInfo(makeupReq.student_name);
        const instMapping = await fetchInstructorMapping(makeupReq.instructor_name);
        const title = formatEventTitle({
          studentName: makeupReq.student_name,
          englishName: stuInfo.english_name,
          studentType: stuInfo.student_type,
          instructorName: instMapping.displayName || makeupReq.instructor_name,
        });
        const restoredEventId = await createCalendarEvent({
          title,
          startISO: makeupReq.original_scheduled_at,
          meetLink: stuInfo.meet_link || makeupRow?.meet_link || null,
          description: `정규 수업 (강사: ${makeupReq.instructor_name})`,
          calendarId: instMapping.calendarId,
        });

        // Re-create the original session at original_scheduled_at (we deleted it on approve)
        if (makeupRow) {
          await sb.from("class_sessions").insert({
            student_name: makeupReq.student_name,
            instructor_name: makeupReq.instructor_name,
            scheduled_at: makeupReq.original_scheduled_at,
            level: "B1",
            meet_link: makeupRow.meet_link || null,
            notes: makeupRow.notes || null,
            topic: makeupRow.topic || null,
            remarks: makeupRow.remarks || null,
            gcal_event_id: restoredEventId,
          });
          await sb.from("class_sessions").delete().eq("id", makeupRow.id);
        } else {
          // Fallback: just create an empty original session
          await sb.from("class_sessions").insert({
            student_name: makeupReq.student_name,
            instructor_name: makeupReq.instructor_name,
            scheduled_at: makeupReq.original_scheduled_at,
            level: "B1",
            gcal_event_id: restoredEventId,
          });
        }

        // Clean up any "open" slots at the restored original time —
        // 강사가 그 시간대를 보강 슬롯으로 미리 등록해뒀다면 정규 수업과 충돌하므로 자동 삭제.
        // slot_id가 없는 수동 reschedule 케이스도 instructor_name으로 fallback 매칭.
        {
          const origDate = new Date(makeupReq.original_scheduled_at);
          const origDateStr = origDate.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
          const origHour = origDate.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul" });
          let cleanup = sb.from("instructor_available_slots")
            .delete()
            .eq("slot_date", origDateStr)
            .eq("slot_time", origHour + ":00")
            .eq("status", "open");
          if (slot?.instructor_id) {
            cleanup = cleanup.eq("instructor_id", slot.instructor_id);
          } else {
            cleanup = cleanup.eq("instructor_name", makeupReq.instructor_name);
          }
          await cleanup;
        }

      } else if (makeupReq.request_type === "extra") {
        // Delete the extra session that was created
        if (newScheduledAt) {
          const { data: extraSessions } = await sb
            .from("class_sessions")
            .select("id, gcal_event_id")
            .eq("student_name", makeupReq.student_name)
            .eq("scheduled_at", newScheduledAt);
          if (extraSessions && extraSessions.length > 0) {
            if (extraSessions[0].gcal_event_id) {
              await deleteCalendarEvent(extraSessions[0].gcal_event_id);
            }
            await sb.from("class_sessions").delete().eq("id", extraSessions[0].id);
          }
        }
      }

      // Re-open the booked slot (if any)
      if (makeupReq.slot_id) {
        await sb.from("instructor_available_slots")
          .update({ status: "open" })
          .eq("id", makeupReq.slot_id);
      }

      // Update request status
      await sb.from("makeup_requests").update({
        status: "cancelled",
        resolved_at: new Date().toISOString(),
      }).eq("id", request_id);

      return new Response(JSON.stringify({ success: true, action: "cancelled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else if (action === "reject_cancel") {
      // Instructor rejects the student's cancellation request — restore status to approved
      if (makeupReq.status !== "cancel_requested") {
        throw new Error("취소 요청 상태인 보강만 거절할 수 있습니다.");
      }
      await sb.from("makeup_requests").update({
        status: "approved",
        resolved_at: null,
      }).eq("id", request_id);
      return new Response(JSON.stringify({ success: true, action: "cancel_rejected" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("잘못된 요청입니다.");
  } catch (e) {
    console.error("handle-makeup-request error:", e);
    return new Response(JSON.stringify({ error: e.message || "처리 중 오류가 발생했습니다." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
