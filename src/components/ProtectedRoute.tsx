import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

type AppRole = "admin" | "manager" | "staff" | "instructor" | "student";

interface ProtectedRouteProps {
  /** Roles that are allowed to access this route */
  allowedRoles: AppRole[];
  children: React.ReactNode;
}

/**
 * **UI-only access guard.** This component performs role/approval checks in
 * the browser purely to redirect unauthorized users away from the route.
 *
 * It is NOT a security boundary — a determined attacker can bypass it by
 * editing client JavaScript. All real authorization MUST be enforced by:
 *  - Supabase Row-Level Security policies on every table
 *  - Server-side role checks in edge functions (via `auth.getUser()` +
 *    `has_role` / `is_manager_or_above` / `is_staff_or_above`)
 *
 * Never rely on this component alone to gate access to sensitive data.
 */
export default function ProtectedRoute({ allowedRoles, children }: ProtectedRouteProps) {
  const [status, setStatus] = useState<"loading" | "authorized" | "unauthorized" | "unauthenticated" | "waitlist" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;

    const withTimeout = <T,>(p: Promise<T>, ms: number, label: string): Promise<T> =>
      Promise.race([
        p,
        new Promise<T>((_, reject) =>
          setTimeout(() => reject(new Error(`[ProtectedRoute] ${label} timeout`)), ms),
        ),
      ]);

    const check = async (attempt = 0): Promise<void> => {
      try {
        const { data: { session } } = await withTimeout(
          supabase.auth.getSession(),
          5000,
          "getSession",
        );
        if (cancelled) return;
        if (!session) {
          setStatus("unauthenticated");
          return;
        }

        const { data: roles, error: rolesErr } = await withTimeout(
          Promise.resolve(
            supabase
              .from("user_roles")
              .select("role, approved")
              .eq("user_id", session.user.id),
          ),
          8000,
          "user_roles",
        );

        if (cancelled) return;
        if (rolesErr) throw rolesErr;

        if (!roles || roles.length === 0) {
          setStatus("unauthorized");
          return;
        }

        // Check if unapproved student → redirect to waitlist
        const studentRole = roles.find((r) => r.role === "student");
        if (studentRole && !studentRole.approved && allowedRoles.includes("student")) {
          setStatus("waitlist");
          return;
        }

        // Check if user has any of the allowed roles (must be approved)
        // Manager/staff can access admin routes
        const expandedAllowed = [...allowedRoles];
        if (expandedAllowed.includes("admin") || expandedAllowed.includes("manager") || expandedAllowed.includes("staff")) {
          if (!expandedAllowed.includes("manager")) expandedAllowed.push("manager");
          if (!expandedAllowed.includes("staff")) expandedAllowed.push("staff");
        }

        const hasAccess = roles.some(
          (r) => r.approved && expandedAllowed.includes(r.role as AppRole)
        );

        // Special case: manager role can access everything (like old admin)
        const isManagerOrAbove = roles.some((r) => r.approved && (r.role === "admin" || r.role === "manager"));

        setStatus(hasAccess || isManagerOrAbove ? "authorized" : "unauthorized");
      } catch (err) {
        console.warn("[ProtectedRoute] check failed:", err);
        if (cancelled) return;
        if (attempt < 1) {
          // One retry after short delay
          setTimeout(() => { if (!cancelled) check(attempt + 1); }, 800);
        } else {
          // 명시적 에러 화면 — 사용자가 무한 로딩에 갇히지 않도록 원인을 보여준다
          const message = err instanceof Error ? err.message : String(err);
          setErrorMsg(message);
          setStatus("error");
        }
      }
    };

    check();

    return () => { cancelled = true; };
  }, [allowedRoles, location.pathname]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm text-center space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto">
            <span className="text-2xl">⚠️</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">접속 확인에 실패했어요</h1>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
              네트워크 또는 서버 응답에 문제가 있습니다.<br />
              잠시 후 새로고침하거나 로그아웃 후 다시 로그인해주세요.
            </p>
          </div>
          {errorMsg && (
            <p className="text-[11px] text-muted-foreground/70 break-all bg-muted/40 p-2 rounded">
              {errorMsg}
            </p>
          )}
          <div className="flex flex-col gap-2">
            <button
              onClick={() => window.location.reload()}
              className="w-full py-2.5 rounded-lg bg-navy text-primary-foreground font-bold text-sm hover:bg-navy-light transition-colors"
            >
              새로고침
            </button>
            <button
              onClick={async () => {
                try { await supabase.auth.signOut(); } catch {}
                window.location.href = "/login";
              }}
              className="w-full py-2.5 rounded-lg border border-border text-foreground text-sm hover:bg-muted transition-colors"
            >
              로그아웃
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return <Navigate to="/login" replace />;
  }

  if (status === "waitlist") {
    return <Navigate to="/waitlist" replace />;
  }

  if (status === "unauthorized") {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
