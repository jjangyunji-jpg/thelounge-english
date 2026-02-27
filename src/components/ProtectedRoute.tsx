import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

type AppRole = "admin" | "instructor" | "student";

interface ProtectedRouteProps {
  /** Roles that are allowed to access this route */
  allowedRoles: AppRole[];
  children: React.ReactNode;
}

export default function ProtectedRoute({ allowedRoles, children }: ProtectedRouteProps) {
  const [status, setStatus] = useState<"loading" | "authorized" | "unauthorized" | "unauthenticated">("loading");

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

      // Check if user has any of the allowed roles (must be approved)
      const hasAccess = roles.some(
        (r) => r.approved && allowedRoles.includes(r.role as AppRole)
      );

      // Special case: admin role can access everything
      const isAdmin = roles.some((r) => r.approved && r.role === "admin");

      setStatus(hasAccess || isAdmin ? "authorized" : "unauthorized");
    };

    check();

    return () => { cancelled = true; };
  }, [allowedRoles]);

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

  if (status === "unauthorized") {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
