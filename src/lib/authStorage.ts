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
  // Do not call supabase.auth.signOut() here.
  // In the preview environment that request can lag behind signInWithPassword,
  // then clear the freshly restored session after the app has already navigated
  // to a protected dashboard route.
  clearStoredAuthTokens();
};