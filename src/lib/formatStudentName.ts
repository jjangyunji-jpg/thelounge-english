/**
 * Format student name with optional English name.
 * e.g. "조은순" + "Joy" → "조은순 / Joy"
 * If no english name, returns just the Korean name.
 */
export function formatStudentName(name: string, englishName?: string | null): string {
  if (englishName) return `${name} / ${englishName}`;
  return name;
}
