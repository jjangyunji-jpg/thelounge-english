---
name: Budget Management
description: 어드민 결제확인 → 예산관리 탭. 정규 수강생 결제대상 × 50,000으로 총수입을 산출하고 현금/스토어로 분리, 스토어는 4.95% 수수료 차감 실수령 표시
type: feature
---

# 예산관리 탭

## 위치
- 어드민 → 결제확인 → "예산 관리" 탭 (3번째)
- 컴포넌트: `src/components/admin/CashReceiptManagement.tsx`

## 결제수단 플래그
- **학생 기본값**: `instructor_students.cash_payment` (boolean, 기본 false=스토어)
- **월별 오버라이드**: `payment_confirmations.note` JSON 내 `cash_override: true|false`
- **뱃지 UI**: 학생명 옆 "현금" / "스토어" 뱃지
  - 클릭: 이번 달만 토글 (cycleCashPayment) — `*` 마커 표시
  - 우클릭: 학생 기본값 토글 (toggleStudentCashDefault)

## 산출 로직 (정규 수강생만)
- 환불(`refund: true`) 표시된 학생 제외
- 기업 수강생 제외 (이번 단계 한정)
- 학생당 금액 = `getFee(s)` = 결제확인 탭과 동일 (billable × 50,000 또는 fee_override)
- **현금 합계** = 그대로
- **스토어 실수령** = `Math.round(total × (1 - 0.0495))`
- **수수료** = 결제총액 - 실수령

## 선결제(Prepaid) 처리
- `prepaid_credits.created_at`이 현재 period(start_date~end_date) 안 → **선결제 등록 달**
  - 해당 학생 행: fee 대신 `total_sessions × LESSON_PRICE` 일시 반영 (스토어 분류)
  - 학생명 옆 "선결제" 보라색 뱃지
- created_at < pStartDate → **이후 달**
  - 리스트(스토어 또는 현금)에는 표시하되 금액 자리에 "—", 합계에 미반영
  - "선결제 (차감)" 뱃지 + opacity-70
- 카드 상단 안내 문구에 차감 학생 수 표시

## UI 구성
1. 4개 요약 카드: 총수입(예상) / 현금 / 스토어 결제 / 실수령 합계
2. 스토어 수수료 내역 박스 (결제총액·수수료·실수령 3분할)
3. 좌우 2개 상세 테이블 (현금 / 스토어 학생별 리스트, 합계 footer)

## 상수
- `STORE_FEE_RATE = 0.0495`
- `LESSON_PRICE = 50000`
