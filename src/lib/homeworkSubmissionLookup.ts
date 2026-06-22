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
  const direct = pickBestSubmission(submissions.filter((s) => s.assignment_id === a.id));
  if (direct) return direct;
  if (!a.preset_origin_id) return undefined;
  const siblingIds = new Set<string>([a.preset_origin_id]);
  for (const x of allAssignments) {
    if (
      x.id !== a.id &&
      x.student_name === a.student_name &&
      x.preset_origin_id === a.preset_origin_id
    ) {
      siblingIds.add(x.id);
    }
  }
  return pickBestSubmission(submissions
    .filter((s) => s.assignment_id && siblingIds.has(s.assignment_id) && s.submitted_at)
    .filter((s) => {
      const t = new Date(s.submitted_at as string).getTime();
      return t >= windowStartTs && t < windowEndTs;
    }));
}
