import { supabase } from "@/integrations/supabase/client";

const PUBLIC_MARKER = "/storage/v1/object/public/homework-files/";
const SIGNED_MARKER = "/storage/v1/object/sign/homework-files/";

/** Extract bucket-relative path from a stored value (URL or bare path). */
export function extractHomeworkFilePath(stored: string | null | undefined): string | null {
  if (!stored) return null;
  const s = stored.trim();
  if (!s) return null;
  let idx = s.indexOf(PUBLIC_MARKER);
  if (idx >= 0) return s.slice(idx + PUBLIC_MARKER.length).split("?")[0];
  idx = s.indexOf(SIGNED_MARKER);
  if (idx >= 0) return s.slice(idx + SIGNED_MARKER.length).split("?")[0];
  // Already a bare path (e.g. "assignmentId/123.ext")
  if (!/^https?:\/\//i.test(s)) return s.split("?")[0];
  return null;
}

/** Generate a short-lived signed URL for a stored homework file value. */
export async function getHomeworkFileSignedUrl(stored: string | null | undefined, expiresIn = 3600): Promise<string | null> {
  const path = extractHomeworkFilePath(stored);
  if (!path) return null;
  const { data, error } = await supabase.storage.from("homework-files").createSignedUrl(path, expiresIn);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
