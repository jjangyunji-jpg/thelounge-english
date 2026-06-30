// Shared lookup for homework submissions that handles the case where a student
// submitted against a sibling assignment copy (e.g., on a previous, possibly
// cancelled session's auto-copy) before the current session's copy received its
// own submission record. All callers that surface "did this student submit?"
// for a per-session assignment row should use this helper for consistent
// behavior with the instructor dashboard.

export interface HwAssignmentLite {
  id: string;
  student_name: string;
  preset_origin_id: string | null;
}

export interface HwSubmissionLite {
  id: string;
  assignment_id: string | null;
  submitted_at?: string | null;
  status?: string | null;
}

function isSubmittedLike(status?: string | null) {
  return status === "submitted" || status === "reviewed";
}

function pickBestSubmission<S extends HwSubmissionLite>(items: S[]): S | undefined {
  return [...items].sort((x, y) => {
    const statusDiff = Number(isSubmittedLike(y.status)) - Number(isSubmittedLike(x.status));
    if (statusDiff !== 0) return statusDiff;
    return new Date(y.submitted_at || 0).getTime() - new Date(x.submitted_at || 0).getTime();
  })[0];
}

export function findSubmissionForAssignment<
  A extends HwAssignmentLite,
  S extends HwSubmissionLite,
>(
  a: A,
  _allAssignments: A[],
  submissions: S[],
  _windowStartTs: number = 0,
  _windowEndTs: number = Number.POSITIVE_INFINITY,
): S | undefined {
  // Writes are now routed to the correct session-copy via
  // resolveCanonicalSubmissionTarget, so each session card only owns the
  // submissions made on its own assignment row. Cross-sibling pooling would
  // make a 4회차 card incorrectly show a 3회차 submission as "submitted",
  // so we match strictly on assignment_id.
  return pickBestSubmission(submissions.filter((s) => s.assignment_id === a.id));
}


// ─────────────────────────────────────────────────────────────────────────────
// Canonical write-target resolution
//
// 학생이 숙제를 제출할 때, 어떤 assignment_id에 기록할지 결정한다.
// 같은 preset에서 파생된 sibling row(preset master + per-session 카피)들 중
// "지금 학생이 준비하고 있는 회차"의 세션 카피를 canonical target으로 삼는다.
//
// 규칙:
//   1) 이미 제출본이 있다면 그 row를 그대로 사용한다 (데이터 분산 방지).
//   2) 없다면 학생의 다음 예정 세션(취소 제외)을 target session으로 잡는다.
//      - 다음 예정 세션이 없으면 가장 최근 과거 세션을 target으로.
//   3) target session의 sibling 카피(session_id = target.id)가 존재하면 그것이 canonical.
//   4) 없으면 preset master에서 즉석으로 새 session 카피를 생성하고 그 id를 canonical로 한다.
//   5) preset master(is_preset=true)는 절대 학생 제출 타겟이 될 수 없다.
//   6) 모든 단계에서 실패하면 호출자가 넘긴 assignment.id로 fallback (단, preset이면 안 됨).
// ─────────────────────────────────────────────────────────────────────────────

interface AssignmentRow {
  id: string;
  session_id: string | null;
  preset_origin_id: string | null;
  is_preset: boolean;
  type: string;
  title: string;
  description: string | null;
  student_name: string;
  due_at: string | null;
}

interface SessionRow {
  id: string;
  scheduled_at: string;
  cancellation_type: string | null;
}

export async function resolveCanonicalSubmissionTarget(
  supabase: any,
  assignment: { id: string; preset_origin_id?: string | null; is_preset?: boolean; session_id?: string | null },
  studentName: string,
): Promise<{ canonicalId: string; existingSubmission: any | null }> {
  // safeFallback: re-checks DB to make sure we never return a preset master id.
  // If the caller's assignment.id IS a preset master, look up any non-preset
  // sibling and return that. If none exists, throw — writing to a preset master
  // would orphan the submission from every session card.
  const safeFallback = async (): Promise<string> => {
    const { data: row } = await supabase
      .from("homework_assignments")
      .select("id, is_preset")
      .eq("id", assignment.id)
      .maybeSingle();
    const isPresetMaster = row?.is_preset === true || assignment.is_preset === true;
    if (isPresetMaster) {
      const { data: anyCopy } = await supabase
        .from("homework_assignments")
        .select("id")
        .eq("preset_origin_id", assignment.id)
        .eq("student_name", studentName)
        .eq("is_preset", false)
        .limit(1)
        .maybeSingle();
      if (anyCopy?.id) return anyCopy.id as string;
      throw new Error(
        "CANONICAL_RESOLVE_FAILED: no session copy could be resolved or created for this assignment.",
      );
    }
    return assignment.id;
  };

  try {
    let selfRow: AssignmentRow | null = null;
    {
      const { data } = await supabase
        .from("homework_assignments")
        .select("id, session_id, preset_origin_id, is_preset, type, title, description, student_name, due_at")
        .eq("id", assignment.id)
        .maybeSingle();
      selfRow = (data as AssignmentRow | null) ?? null;
    }

    // NOTE: We intentionally do NOT early-return when selfRow is already a
    // session copy. The caller's assignment.id may refer to a PAST session's
    // copy (e.g., student clicks 지난 회차 카드 after class ended), and we must
    // re-route the write to the NEXT scheduled session's copy so the
    // submission lands on the correct 회차. The fallthrough below handles
    // both "no session copy" and "wrong session copy" uniformly.
    //
    // Existing submitted/reviewed rows on selfRow remain untouched on their
    // original 회차 — only the new write goes to the upcoming target.

    const presetKey =
      (selfRow?.is_preset ? selfRow.id : selfRow?.preset_origin_id) ??
      assignment.preset_origin_id ??
      assignment.id;

    const { data: siblingsData } = await supabase
      .from("homework_assignments")
      .select("id, session_id, preset_origin_id, is_preset, type, title, description, student_name, due_at")
      .or(`id.eq.${presetKey},preset_origin_id.eq.${presetKey}`);
    const siblings = ((siblingsData || []) as AssignmentRow[])
      .filter((s) => s.student_name === studentName || s.is_preset);

    const nowIso = new Date().toISOString();
    const { data: sessionsData } = await supabase
      .from("class_sessions")
      .select("id, scheduled_at, cancellation_type")
      .eq("student_name", studentName)
      .is("cancellation_type", null)
      .order("scheduled_at", { ascending: true });
    const sessions = (sessionsData || []) as SessionRow[];
    const upcoming = sessions.find((s) => s.scheduled_at > nowIso) || null;
    const latestPast =
      [...sessions].reverse().find((s) => s.scheduled_at <= nowIso) || null;
    const targetSession = upcoming || latestPast;

    if (targetSession) {
      const match = siblings.find(
        (s) => !s.is_preset && s.session_id === targetSession.id,
      );
      if (match) {
        const { data: matchSubs } = await supabase
          .from("homework_submissions")
          .select("*")
          .eq("assignment_id", match.id)
          .eq("student_name", studentName);
        const best = pickBestSubmission((matchSubs || []) as HwSubmissionLite[]);
        return { canonicalId: match.id, existingSubmission: best ?? null };
      }

      const preset = siblings.find((s) => s.is_preset) || selfRow;
      if (preset && targetSession) {
        const { data: created, error: createErr } = await supabase
          .from("homework_assignments")
          .insert({
            session_id: targetSession.id,
            student_name: studentName,
            type: preset.type,
            title: preset.title,
            description: preset.description,
            is_preset: false,
            preset_origin_id: presetKey,
            due_at: preset.due_at,
          })
          .select("id")
          .single();
        if (!createErr && created?.id) {
          return { canonicalId: created.id as string, existingSubmission: null };
        }
        // INSERT failed — race or RLS. Re-query for a sibling that another
        // concurrent request may have just created.
        const { data: raceMatch } = await supabase
          .from("homework_assignments")
          .select("id")
          .eq("session_id", targetSession.id)
          .eq("student_name", studentName)
          .eq("preset_origin_id", presetKey)
          .eq("is_preset", false)
          .limit(1)
          .maybeSingle();
        if (raceMatch?.id) {
          const { data: raceSubs } = await supabase
            .from("homework_submissions")
            .select("*")
            .eq("assignment_id", raceMatch.id)
            .eq("student_name", studentName);
          const best = pickBestSubmission((raceSubs || []) as HwSubmissionLite[]);
          return { canonicalId: raceMatch.id as string, existingSubmission: best ?? null };
        }
        console.error(
          "resolveCanonicalSubmissionTarget: session copy INSERT failed",
          createErr,
        );
      }
    }

    return { canonicalId: await safeFallback(), existingSubmission: null };
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("CANONICAL_RESOLVE_FAILED")) {
      throw err;
    }
    return { canonicalId: await safeFallback(), existingSubmission: null };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sibling draft recovery — used by the submit modal to prefill textarea/audio
// when the student's strict-match card has no submission but a draft exists
// on a sibling row (legacy data from before canonical write-routing was added).
// Only returns drafts; submitted/reviewed rows are intentionally ignored so
// they don't get accidentally edited from a different session's card.
// ─────────────────────────────────────────────────────────────────────────────
export async function findLatestSiblingDraft(
  supabase: any,
  assignment: { id: string; preset_origin_id?: string | null; is_preset?: boolean },
  studentName: string,
): Promise<any | null> {
  try {
    const { data: selfRow } = await supabase
      .from("homework_assignments")
      .select("id, preset_origin_id, is_preset")
      .eq("id", assignment.id)
      .maybeSingle();

    const presetKey =
      (selfRow?.is_preset ? selfRow.id : selfRow?.preset_origin_id) ??
      assignment.preset_origin_id ??
      assignment.id;

    const { data: siblings } = await supabase
      .from("homework_assignments")
      .select("id")
      .or(`id.eq.${presetKey},preset_origin_id.eq.${presetKey}`)
      .eq("student_name", studentName);
    const siblingIds = new Set<string>(((siblings || []) as { id: string }[]).map((s) => s.id));
    siblingIds.add(assignment.id);

    const { data: drafts } = await supabase
      .from("homework_submissions")
      .select("*")
      .in("assignment_id", Array.from(siblingIds))
      .eq("student_name", studentName)
      .eq("status", "draft");

    if (!drafts || drafts.length === 0) return null;
    // Most recent draft wins
    return [...drafts].sort(
      (a: any, b: any) =>
        new Date(b.submitted_at || b.updated_at || 0).getTime() -
        new Date(a.submitted_at || a.updated_at || 0).getTime(),
    )[0];
  } catch {
    return null;
  }
}


