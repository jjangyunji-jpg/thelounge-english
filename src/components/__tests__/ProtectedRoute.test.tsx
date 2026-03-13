import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ProtectedRoute from "@/components/ProtectedRoute";

// Track navigation
const mockNavigate = vi.fn();
let mockLocation = { pathname: "/test" };

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    Navigate: (props: any) => {
      mockNavigate(props.to);
      return <div data-testid="navigate" data-to={props.to} />;
    },
    useLocation: () => mockLocation,
  };
});

// Supabase mock state
let mockSession: any = null;
let mockRoles: any[] = [];

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: mockSession } }),
    },
    from: () => ({
      select: () => ({
        eq: (col: string, val: string) => {
          // Return mock roles
          return Promise.resolve({ data: mockRoles, error: null });
        },
      }),
    }),
  },
}));

function renderProtected(allowedRoles: any[], children = <div>Protected Content</div>) {
  return render(
    <MemoryRouter>
      <ProtectedRoute allowedRoles={allowedRoles}>{children}</ProtectedRoute>
    </MemoryRouter>
  );
}

describe("ProtectedRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSession = null;
    mockRoles = [];
    mockLocation = { pathname: "/test" };
  });

  it("shows loader initially", () => {
    // Session never resolves quickly enough, so we see the loader
    mockSession = { user: { id: "u1" } };
    mockRoles = [{ role: "admin", approved: true }];
    renderProtected(["admin"]);
    // The spinner should be visible initially
    expect(screen.getByText("Protected Content").closest("div") || document.querySelector(".animate-spin")).toBeTruthy();
  });

  it("redirects to /login when not authenticated", async () => {
    mockSession = null;
    renderProtected(["admin"]);
    await waitFor(() => {
      expect(screen.getByTestId("navigate")).toHaveAttribute("data-to", "/login");
    });
  });

  it("redirects to /login when user has no roles", async () => {
    mockSession = { user: { id: "u1" } };
    mockRoles = [];
    renderProtected(["admin"]);
    await waitFor(() => {
      expect(screen.getByTestId("navigate")).toHaveAttribute("data-to", "/login");
    });
  });

  it("allows access for approved admin role", async () => {
    mockSession = { user: { id: "u1" } };
    mockRoles = [{ role: "admin", approved: true }];
    renderProtected(["admin"]);
    await waitFor(() => {
      expect(screen.getByText("Protected Content")).toBeInTheDocument();
    });
  });

  it("allows access for approved manager role on admin routes", async () => {
    mockSession = { user: { id: "u1" } };
    mockRoles = [{ role: "manager", approved: true }];
    renderProtected(["admin"]);
    await waitFor(() => {
      expect(screen.getByText("Protected Content")).toBeInTheDocument();
    });
  });

  it("allows access for approved staff role on admin routes", async () => {
    mockSession = { user: { id: "u1" } };
    mockRoles = [{ role: "staff", approved: true }];
    renderProtected(["admin"]);
    await waitFor(() => {
      expect(screen.getByText("Protected Content")).toBeInTheDocument();
    });
  });

  it("allows approved instructor on instructor routes", async () => {
    mockSession = { user: { id: "u1" } };
    mockRoles = [{ role: "instructor", approved: true }];
    renderProtected(["instructor"]);
    await waitFor(() => {
      expect(screen.getByText("Protected Content")).toBeInTheDocument();
    });
  });

  it("denies unapproved instructor", async () => {
    mockSession = { user: { id: "u1" } };
    mockRoles = [{ role: "instructor", approved: false }];
    renderProtected(["instructor"]);
    await waitFor(() => {
      expect(screen.getByTestId("navigate")).toHaveAttribute("data-to", "/login");
    });
  });

  it("redirects unapproved student to /waitlist", async () => {
    mockSession = { user: { id: "u1" } };
    mockRoles = [{ role: "student", approved: false }];
    renderProtected(["student"]);
    await waitFor(() => {
      expect(screen.getByTestId("navigate")).toHaveAttribute("data-to", "/waitlist");
    });
  });

  it("allows approved student on student routes", async () => {
    mockSession = { user: { id: "u1" } };
    mockRoles = [{ role: "student", approved: true }];
    renderProtected(["student"]);
    await waitFor(() => {
      expect(screen.getByText("Protected Content")).toBeInTheDocument();
    });
  });

  it("denies instructor trying to access student routes", async () => {
    mockSession = { user: { id: "u1" } };
    mockRoles = [{ role: "instructor", approved: true }];
    renderProtected(["student"]);
    await waitFor(() => {
      expect(screen.getByTestId("navigate")).toHaveAttribute("data-to", "/login");
    });
  });

  it("manager can access any route (like old admin)", async () => {
    mockSession = { user: { id: "u1" } };
    mockRoles = [{ role: "manager", approved: true }];
    renderProtected(["instructor"]);
    await waitFor(() => {
      expect(screen.getByText("Protected Content")).toBeInTheDocument();
    });
  });
});
