import React from "react";

interface Props { children: React.ReactNode }
interface State { hasError: boolean; error: Error | null }

export default class DashboardErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("[DashboardErrorBoundary]", error, info);
  }
  handleReload = () => {
    try { window.location.reload(); } catch {}
  };
  handleLogout = async () => {
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      await supabase.auth.signOut();
    } catch {}
    window.location.href = "/login";
  };
  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm text-center space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto">
            <span className="text-2xl">⚠️</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">일시적인 오류가 발생했어요</h1>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
              페이지를 새로고침해주세요.<br />
              문제가 계속되면 로그아웃 후 다시 로그인해주세요.
            </p>
          </div>
          {this.state.error?.message && (
            <p className="text-[11px] text-muted-foreground/70 break-all">
              {this.state.error.message}
            </p>
          )}
          <div className="flex flex-col gap-2">
            <button onClick={this.handleReload} className="w-full py-2.5 rounded-lg bg-navy text-primary-foreground font-bold text-sm hover:bg-navy-light transition-colors">
              새로고침
            </button>
            <button onClick={this.handleLogout} className="w-full py-2.5 rounded-lg border border-border text-foreground text-sm hover:bg-muted transition-colors">
              로그아웃
            </button>
          </div>
        </div>
      </div>
    );
  }
}
