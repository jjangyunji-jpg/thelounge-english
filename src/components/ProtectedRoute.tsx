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
  const [status, setStatus] = useState<"loading" | "authorized" | "unauthorized" | "unauthenticated" | "waitlist">("loading");
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        if (!cancelled) setStatus("unauthenticated");
        return;
      }

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role, approved")
        .eq("user_id", session.user.id);

      if (cancelled) return;

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

      // Check if unapproved student has active waitlist entry → redirect to waitlist
      if (studentRole && !studentRole.approved && allowedRoles.includes("student")) {
        const { data: waitlistEntry } = await supabase
          .from("waitlist_entries")
          .select("id")
          .eq("user_id", session.user.id)
          .eq("status", "waiting")
          .maybeSingle();
        if (waitlistEntry) {
          setStatus("waitlist");
          return;
        }
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
