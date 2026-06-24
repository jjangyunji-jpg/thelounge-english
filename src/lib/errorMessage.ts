// Extract a human-readable error message from any thrown value, including
// Supabase / PostgREST error objects which are plain objects (not Error
// instances). Always returns a non-empty string suitable for toast display.
export function getErrorMessage(e: unknown, fallback = "오류가 발생했어요. 잠시 후 다시 시도해주세요."): string {
  if (!e) return fallback;
  if (typeof e === "string") return e;
  if (e instanceof Error && e.message) return e.message;
  if (typeof e === "object") {
    const obj = e as Record<string, unknown>;
    // Supabase / PostgREST shape: { message, details, hint, code }
    const parts: string[] = [];
    if (typeof obj.message === "string" && obj.message) parts.push(obj.message);
    if (typeof obj.details === "string" && obj.details && obj.details !== obj.message) parts.push(obj.details);
    if (typeof obj.hint === "string" && obj.hint) parts.push(`힌트: ${obj.hint}`);
    if (typeof obj.code === "string" && obj.code) parts.push(`(${obj.code})`);
    if (parts.length) return parts.join(" · ");
    // Last resort
    try {
      const s = JSON.stringify(obj);
      if (s && s !== "{}") return s;
    } catch { /* ignore */ }
  }
  return fallback;
}
