import { useNavigate } from "react-router-dom";
import { RotateCcw, ArrowLeft, Coffee } from "lucide-react";

export default function MakeupRequest() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: "linear-gradient(160deg, #fffbeb 0%, #fff7ed 100%)" }}>
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mx-auto shadow-lg shadow-amber-200">
          <RotateCcw className="w-8 h-8 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-amber-900">보강 신청</h1>
          <p className="text-amber-500 mt-2 text-sm">준비 중인 기능입니다.</p>
          <p className="text-amber-400 mt-1 text-xs">곧 보강 신청 기능이 추가될 예정이에요!</p>
        </div>
        <div className="bg-white rounded-2xl border border-amber-100 p-5 text-left space-y-2">
          <p className="text-xs font-bold text-amber-700">Coming Soon</p>
          <ul className="text-xs text-amber-500 space-y-1 list-disc list-inside">
            <li>보강 가능 일정 확인</li>
            <li>담당 강사에게 보강 요청</li>
            <li>보강 일정 확정 알림</li>
          </ul>
        </div>
        <button
          onClick={() => navigate("/dashboard-student")}
          className="flex items-center gap-2 mx-auto text-sm text-amber-600 font-semibold"
        >
          <ArrowLeft className="w-4 h-4" /> 대시보드로 돌아가기
        </button>
      </div>
    </div>
  );
}
