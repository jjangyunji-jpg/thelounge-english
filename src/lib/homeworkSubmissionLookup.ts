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
