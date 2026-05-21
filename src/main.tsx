import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// 전역 에러 가시화: 어떤 비동기 오류나 렌더 오류든 콘솔과 화면 토스트에 노출
if (typeof window !== "undefined") {
  const showErrorToast = (title: string, message: string) => {
    try {
      // 동적 import: 토스트 시스템이 준비되기 전에도 안전
      import("@/hooks/use-toast").then(({ toast }) => {
        toast({ title, description: message.slice(0, 300), variant: "destructive" });
      });
    } catch {}
  };

  window.addEventListener("error", (e) => {
    // eslint-disable-next-line no-console
    console.error("[GlobalError]", e.error || e.message, e);
    const msg = e.error?.message || e.message || "알 수 없는 오류";
    if (!/ResizeObserver|Non-Error promise rejection/.test(msg)) {
      showErrorToast("오류가 발생했어요", msg);
    }
  });

  window.addEventListener("unhandledrejection", (e) => {
    // eslint-disable-next-line no-console
    console.error("[UnhandledRejection]", e.reason);
    const reason = e.reason;
    const msg = (reason instanceof Error ? reason.message : String(reason || "")) || "알 수 없는 오류";
    if (!/AbortError|cancelled/i.test(msg)) {
      showErrorToast("요청 처리 중 오류", msg);
    }
  });
}

createRoot(document.getElementById("root")!).render(<App />);
