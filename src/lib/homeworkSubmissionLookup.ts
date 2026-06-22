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
  allAssignments: A[],
  submissions: S[],
  windowStartTs: number = 0,
  windowEndTs: number = Number.POSITIVE_INFINITY,
): S | undefined {
  // Build full sibling pool — self + all assignments sharing the same preset
  // (either as the preset itself, or as a copy with preset_origin_id matching).
  // We pool ALL siblings (not just fallback) so that if the student saved a
  // draft against one sibling and a stronger submission exists on another,
  // we surface the strongest one consistently. This prevents the "submitted
  // content disappeared" UX when the same logical task exists as multiple
  // assignment rows (preset + per-session copies).
  const siblingIds = new Set<string>([a.id]);
  const presetKey = a.preset_origin_id ?? a.id;
  siblingIds.add(presetKey);
  for (const x of allAssignments) {
    if (x.student_name !== a.student_name) continue;
    if (x.id === presetKey) siblingIds.add(x.id);
    if (x.preset_origin_id && x.preset_origin_id === presetKey) siblingIds.add(x.id);
  }
  return pickBestSubmission(submissions
    .filter((s) => s.assignment_id && siblingIds.has(s.assignment_id))
    .filter((s) => {
      // Direct (same assignment_id) matches always pass the window filter so
      // in-progress drafts on the exact row are never hidden by a window.
      if (s.assignment_id === a.id) return true;
      if (!s.submitted_at) return false;
      const t = new Date(s.submitted_at).getTime();
      return t >= windowStartTs && t < windowEndTs;
    }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Canonical write-target resolution
//
// Same-회차 숙제는 preset row + per-session copy로 쪼개져 있어, 학생이 진입
// 경로에 따라 서로 다른 assignment_id에 draft/submission이 쌓이는 문제가 있다.
// 이 헬퍼는 write 직전에 호출되어, 형제(sibling) row들 중 이미 제출본이 존재
// 한다면 그 row의 assignment_id를 "canonical"로 반환한다. 없으면 prop으로
// 들어온 assignment.id를 그대로 사용한다. 기존 데이터를 이동시키지 않으므로
// CASCADE 삭제 위험은 추가되지 않는다.
// ─────────────────────────────────────────────────────────────────────────────
export async function resolveCanonicalSubmissionTarget(
  supabase: any,
  assignment: { id: string; preset_origin_id?: string | null },
  studentName: string,
): Promise<{ canonicalId: string; existingSubmission: any | null }> {
  try {
    // If caller didn't supply preset_origin_id, fetch it so we can compute the
    // sibling pool correctly even when called with a session-copy id only.
    let presetOriginId: string | null | undefined = assignment.preset_origin_id;
    if (presetOriginId === undefined) {
      const { data: selfRow } = await supabase
        .from("homework_assignments")
        .select("preset_origin_id")
        .eq("id", assignment.id)
        .maybeSingle();
      presetOriginId = (selfRow as { preset_origin_id: string | null } | null)?.preset_origin_id ?? null;
    }
    const presetKey = presetOriginId ?? assignment.id;
    // 1) Fetch sibling assignment ids: self + preset + all copies sharing preset_origin_id
    const { data: siblings } = await supabase
      .from("homework_assignments")
      .select("id, preset_origin_id")
      .or(`id.eq.${presetKey},preset_origin_id.eq.${presetKey}`);

    const siblingIds = new Set<string>([assignment.id, presetKey]);
    for (const s of (siblings || []) as Array<{ id: string; preset_origin_id: string | null }>) {
      siblingIds.add(s.id);
    }

    // 2) Find existing submissions across all siblings for this student
    const { data: subs } = await supabase
      .from("homework_submissions")
      .select("*")
      .in("assignment_id", Array.from(siblingIds))
      .eq("student_name", studentName);

    const best = pickBestSubmission((subs || []) as HwSubmissionLite[]);
    if (best && best.assignment_id) {
      return { canonicalId: best.assignment_id, existingSubmission: best };
    }
    return { canonicalId: assignment.id, existingSubmission: null };
  } catch {
    // On any error, fall back to the prop's id — never block the write
    return { canonicalId: assignment.id, existingSubmission: null };
  }
}
