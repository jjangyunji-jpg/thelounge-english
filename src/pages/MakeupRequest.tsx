import { useNavigate } from "react-router-dom";
import { useEffect } from "react";

// This page now redirects to dashboard — the modal is shown inline there
export default function MakeupRequest() {
  const navigate = useNavigate();
  useEffect(() => { navigate("/my/dashboard", { replace: true }); }, []);
  return null;
}
