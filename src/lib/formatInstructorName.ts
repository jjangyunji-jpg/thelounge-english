/**
 * Display instructor by English name when available, falling back to the
 * Korean name. Use this everywhere instructors are shown to students or
 * staff so naming stays consistent across the app (e.g. makeup modal,
 * schedule cards, feedback, notifications).
 */
export function formatInstructorName(
  name: string | null | undefined,
  englishName?: string | null,
): string {
  const en = (englishName ?? "").trim();
  if (en) return en;
  return (name ?? "").trim();
}

/**
 * Build a name → english_name lookup map from a list of instructor records.
 */
export function buildInstructorNameMap<
  T extends { name: string; english_name?: string | null },
>(instructors: T[] | null | undefined): Map<string, string> {
  const map = new Map<string, string>();
  for (const i of instructors ?? []) {
    if (i?.name) map.set(i.name, formatInstructorName(i.name, i.english_name));
  }
  return map;
}
