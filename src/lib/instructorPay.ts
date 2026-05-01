// 강사 급여 정산 로직 (KST 기준)
// 신규 규정 적용 시작: 이번 달 1일 (KST). 그 이전 세션은 기존 로직 유지.

export const BASE_PAY = 11000;

export const LEVEL_RATES: Record<string, number> = {
  A1: 14000, A2: 14000,
  B1: 19000, B2: 19000,
  C1: 24000, C2: 24000,
};

export const getLevelCategory = (level: string) => {
  if (["A1", "A2"].includes(level)) return "초급";
  if (["B1", "B2"].includes(level)) return "중급";
  if (["C1", "C2"].includes(level)) return "고급";
  return "중급";
};

// 신규 규정 시작일 = 현재 월의 1일 (KST). 이 날짜 이후 scheduled_at 세션에 신규 매핑 적용.
export function getNewRulesStartDate(): Date {
  const now = new Date();
  const kstNow = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
  return new Date(kstNow.getFullYear(), kstNow.getMonth(), 1);
}

export type SessionPayInput = {
  scheduled_at: string;
  level: string;
  cancellation_type?: string | null;
  ended_at?: string | null;
};

export type SessionPayResult = {
  // 정산에 포함되는지
  included: boolean;
  // payPerHour: BASE_PAY + (lesson rate component, possibly reduced)
  payPerHour: number;
  // 라벨 부가설명 (예: "[노쇼 50%]", "[24h 전 취소 — 기본만]")
  noteSuffix: string;
};

/**
 * 강사 급여 매핑 (카테고리 직접 매핑, 시각 비교 없음)
 * - completed (cancellation_type=null, ended_at 있음): Base + 수업수당
 * - no_show: Base + 수업수당×50%
 * - advance_cancel (24h전 / 사전예정): Base만
 * - student_cancel (당일 예외없음): 무급
 * - sick (당일 예외사유): 무급
 * - instructor_cancel: 무급
 *
 * isOwner=true (대표) 인 경우 flat rate 적용. 대표는 취소 시 무급.
 */
export function calcSessionPay(
  s: SessionPayInput,
  opts: { isOwner: boolean; ownerFlatRate?: number },
): SessionPayResult {
  const { isOwner, ownerFlatRate = 50000 } = opts;
  const ct = s.cancellation_type ?? null;
  const newRulesStart = getNewRulesStartDate();
  const sessionDate = new Date(s.scheduled_at);
  const isNewRules = sessionDate >= newRulesStart;
  const levelRate = LEVEL_RATES[s.level] || 19000;

  // 대표(flat rate) — 완료 또는 노쇼만 정산 (기존 로직 유지)
  if (isOwner) {
    if (ct === null && !s.ended_at) return { included: false, payPerHour: 0, noteSuffix: "" };
    if (ct === "student_cancel" || ct === "sick" || ct === "instructor_cancel" || ct === "advance_cancel") {
      return { included: false, payPerHour: 0, noteSuffix: "" };
    }
    if (ct === "no_show") {
      return { included: true, payPerHour: ownerFlatRate, noteSuffix: " [노쇼]" };
    }
    return { included: true, payPerHour: ownerFlatRate, noteSuffix: "" };
  }

  // 일반 강사 — 신규 규정
  if (isNewRules) {
    // 무급 케이스
    if (ct === "student_cancel" || ct === "sick" || ct === "instructor_cancel") {
      return { included: false, payPerHour: 0, noteSuffix: "" };
    }
    // 24h 전 취소 / 사전예정 → Base만
    if (ct === "advance_cancel") {
      return { included: true, payPerHour: BASE_PAY, noteSuffix: " [24h 전 취소 — 기본급만]" };
    }
    // 노쇼 → Base + 수업수당 50%
    if (ct === "no_show") {
      return {
        included: true,
        payPerHour: BASE_PAY + Math.round(levelRate * 0.5),
        noteSuffix: " [노쇼 — 수업수당 50%]",
      };
    }
    // 정상 완료
    if (ct === null && s.ended_at) {
      return { included: true, payPerHour: BASE_PAY + levelRate, noteSuffix: "" };
    }
    return { included: false, payPerHour: 0, noteSuffix: "" };
  }

  // 기존 규정 (이번 달 이전 세션) — 하위 호환
  if (ct === "student_cancel" || ct === "sick" || ct === "instructor_cancel" || ct === "advance_cancel") {
    return { included: false, payPerHour: 0, noteSuffix: "" };
  }
  if (ct === "no_show") {
    return { included: true, payPerHour: BASE_PAY + levelRate, noteSuffix: " [노쇼]" };
  }
  if (ct === null && s.ended_at) {
    return { included: true, payPerHour: BASE_PAY + levelRate, noteSuffix: "" };
  }
  return { included: false, payPerHour: 0, noteSuffix: "" };
}
