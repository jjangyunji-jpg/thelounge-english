import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    // Get the slot
    const { data: slot } = await sb
      .from("instructor_available_slots").select("*").eq("id", makeupReq.slot_id).single();
    if (!slot) throw new Error("슬롯 정보를 찾을 수 없습니다.");

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

        // Release any previously booked makeup slot for the session's CURRENT time
        // (handles the case where the session was moved here by a prior makeup request)
        const curDate = new Date(origSession.scheduled_at);
        const curDateStr = curDate.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
        const curTimeStr = curDate.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul" }) + ":00";
        
        // Find and release booked slots at the session's current time for this instructor
        await sb.from("instructor_available_slots")
          .update({ status: "open" })
          .eq("instructor_name", slot.instructor_name)
          .eq("slot_date", curDateStr)
          .eq("slot_time", curTimeStr)
          .eq("status", "booked");

        // Extract original session's date and time for re-opening as available slot
        const origDate = new Date(origSession.scheduled_at);
        const origDateStr = origDate.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
        const origHour = origDate.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul" });

        // Update the session's scheduled_at
        const { error: updateErr } = await sb
          .from("class_sessions")
          .update({ scheduled_at: newScheduledAt })
          .eq("id", makeupReq.original_session_id);
        if (updateErr) throw new Error("세션 업데이트 실패: " + updateErr.message);

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
          .select("level, meet_link, group_students")
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
        });

        // Clear notes/topic from original cancelled session (moved, not copied)
        if (makeupReq.original_session_id && (transferNotes || transferTopic)) {
          // Use direct SQL-like approach: set notes to empty to avoid trigger blocking null
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
      // Cancel an approved makeup request — undo session changes and re-open slot
      if (makeupReq.status !== "approved") throw new Error("승인된 요청만 취소할 수 있습니다.");

      // Get the slot to find the scheduled time
      const newScheduledAt = new Date(`${slot.slot_date}T${slot.slot_time}+09:00`).toISOString();

      if (makeupReq.request_type === "reschedule" && makeupReq.original_session_id) {
        // Revert session to original time
        if (!makeupReq.original_scheduled_at) throw new Error("원래 일정 정보가 없습니다.");
        const { error: revertErr } = await sb
          .from("class_sessions")
          .update({ scheduled_at: makeupReq.original_scheduled_at })
          .eq("id", makeupReq.original_session_id);
        if (revertErr) throw new Error("세션 복원 실패: " + revertErr.message);

        // Delete the re-opened original slot (if it exists) — the slot that was created when reschedule was approved
        const origDate = new Date(makeupReq.original_scheduled_at);
        const origDateStr = origDate.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
        const origHour = origDate.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul" });
        await sb.from("instructor_available_slots")
          .delete()
          .eq("instructor_id", slot.instructor_id)
          .eq("slot_date", origDateStr)
          .eq("slot_time", origHour + ":00")
          .eq("status", "open");

      } else if (makeupReq.request_type === "extra") {
        // Delete the extra session that was created
        // Find session matching student_name + scheduled_at
        const { data: extraSessions } = await sb
          .from("class_sessions")
          .select("id")
          .eq("student_name", makeupReq.student_name)
          .eq("scheduled_at", newScheduledAt);
        if (extraSessions && extraSessions.length > 0) {
          await sb.from("class_sessions").delete().eq("id", extraSessions[0].id);
        }
      }

      // Re-open the booked slot
      await sb.from("instructor_available_slots")
        .update({ status: "open" })
        .eq("id", makeupReq.slot_id);

      // Update request status
      await sb.from("makeup_requests").update({
        status: "cancelled",
        resolved_at: new Date().toISOString(),
      }).eq("id", request_id);

      return new Response(JSON.stringify({ success: true, action: "cancelled" }), {
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
