import { supabase } from "@/integrations/supabase/client";

const getProjectRef = () => {
  try {
    const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    return url ? new URL(url).hostname.split(".")[0] : null;
  } catch {
    return null;
  }
};

const clearStoredAuthTokens = () => {
  if (typeof window === "undefined") return;

  const projectRef = getProjectRef();
  const projectPrefix = projectRef ? `sb-${projectRef}-` : "sb-";

  Object.keys(window.localStorage).forEach((key) => {
    if (!key.startsWith(projectPrefix)) return;
    if (key.includes("auth-token") || key.includes("code-verifier")) {
      window.localStorage.removeItem(key);
    }
  });
};

export const resetLocalAuthSession = async () => {
  clearStoredAuthTokens();

  try {
    await Promise.race([
      supabase.auth.signOut({ scope: "local" }),
      new Promise((resolve) => window.setTimeout(resolve, 800)),
    ]);
  } catch {
    // If auth is already in a broken refresh state, still clear persisted tokens manually.
  } finally {
    clearStoredAuthTokens();
  }
};