---
name: Budget Management
description: 어드민 결제확인의 예산 관리/예산 요약 탭. 정규 수강생, 기업 수강생, AI 프로그램 수입을 합산
type: feature
---

# 예산관리 / 예산요약 탭

## 위치
- 어드민 → 결제확인 → 4개 탭: 월별 수업 카운트 / 결제 확인 / 예산 관리 / 예산 요약
- 컴포넌트: `src/components/admin/CashReceiptManagement.tsx`
- AI 프로그램 합산 유틸: `src/lib/aiProgramTotals.ts` (parent에서도 동일 로직 재사용)

## 정규 수강생
### 결제수단 플래그
- **학생 기본값**: `instructor_students.cash_payment` (boolean, 기본 false=스토어)
- **월별 오버라이드**: `payment_confirmations.note` JSON 내 `cash_override`
- **뱃지**: 좌클릭=이번 달만 토글, 우클릭=학생 기본값 토글

### 산출
- 환불 학생 제외, 기업 수강생 제외
- 학생당 금액 = `getFee(s)` (billable × 50,000 또는 fee_override)
- 현금 합계 = 그대로 / 스토어 실수령 = `total × (1 - 0.0495)`

### 선결제(Prepaid)
- 등록 달 (created_at ∈ period): 일시 반영(`total_sessions × 50,000`), 보라색 뱃지
- 이후 달: 리스트에 표시(opacity-70), 금액 "—", 합계 미반영

## 기업 수강생 (후불)
### 결제 시점
- **전월 수업 회수 기준**: 4월 결제확인 = 3월 수업 카운트 × 단가
- `corpMonthStart/End` = currentPeriod.start_date의 한 달 전 calendar month
- `corpMonthLabel`로 UI에 표시

### 단가 (`instructor_students.corporate_rate`)
- 전현지: 70,000원
- 황재민, 여환웅: NULL → 기본값 50,000원
- `getCorpRate(s)`: corporate_rate > 0 → 사용, 없으면 그룹/개인 기본값

### 세금 토글 (계산서 vs 사업소득 3.3%)
- **학생 기본값**: `instructor_students.tax_invoice` (boolean, 기본 false=3.3%)
- **월별 오버라이드**: `payment_confirmations.note` JSON 내 `tax_invoice_override`
- **뱃지**: "계산서" / "3.3%" — 좌클릭=월별 토글, 우클릭=기본값 토글
- 실수령: 계산서 = gross / 3.3% = `Math.round(gross × (1 - 0.033))`

### 예산 카드 (4개)
- 총 결제액 / 계산서 합계 / 3.3% 합계 / 실수령 합계
- 하단에 학생별 리스트 (단가, 회수, 결제액, 실수령)

## 상수
- `STORE_FEE_RATE = 0.0495`
- `BIZ_INCOME_TAX_RATE = 0.033`
- `LESSON_PRICE = 50000` / `GROUP_LESSON_PRICE = 70000`
