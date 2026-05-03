import React from "react";

interface Props {
  children: React.ReactNode;
  /** Optional callback when an error is caught (e.g. close popup). */
  onError?: (error: Error) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Localized error boundary for the notification popup/inbox area.
 * Prevents a render-time crash inside notifications (e.g. Radix Dialog
 * primitives accidentally rendered outside a Dialog context) from taking
 * down the entire dashboard. The boundary swallows the error and renders
 * a minimal fallback so the rest of the page stays usable.
 */
export default class NotificationErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("[NotificationErrorBoundary]", error, info);
    try {
      this.props.onError?.(error);
    } catch {}
  }

  render() {
    if (this.state.hasError) {
      // Render nothing so the host dashboard keeps working.
      return null;
    }
    return this.props.children;
  }
}
