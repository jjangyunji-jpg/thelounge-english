---
name: Payment Management
description: 어드민 결제확인/예산관리 — 선결제는 매월 차감 회수 × 단가로 매출 인식 (회계 기준)
type: feature
---

# 결제확인 / 예산관리 핵심 규칙

## 선결제(prepaid) 매출 인식
- **회계 인식 기준**: 매월 `dedMap.deducted_sessions × LESSON_PRICE`로 그 달의 매출 산입
- 등록 달에 총액 일시 반영 X (이전 방식 폐기)
- 등록 달 차감분 → **🔵 스토어 (선결제 N회)** 뱃지, 스토어 합계 + 수수료 적용
- 이후 달 차감분 → **🟣 차감 N회** 뱃지, 스토어 합계 + 수수료 비례
- 잔액 있으나 미차감 → **⚪ 선결제 (미차감)** 뱃지, 0원, opacity-60

## 예시 (선결제 6회 = 30만원)
- 5월 2회 차감 → 5월 매출 10만원 (스토어 (선결제 2회))
- 6월 4회 차감 → 6월 매출 20만원 (차감 4회)
- 총합 30만원 동일, 월별로 정확히 분산

## 환불
- `payment_confirmations.note` JSON의 `refund: true`로 표시
- `refundFlags` Set에서 budgetEligible 제외
- 우상단 "환불 표시" 토글 버튼 — 기존 그대로

## 입금 시점 vs 매출 시점
- 실제 30만원 PG 입금은 등록 달에 발생 — 현금흐름은 그 달
- 매출 인식은 월별 차감 기준 — 손익은 분산
- 수수료(4.95%)는 인식된 매출에 비례 적용 (총액은 동일하되 월별 분산)

## 관련 파일
- `src/components/admin/CashReceiptManagement.tsx` — `budgetRows` 계산 (line ~1180-1230)
- `prepaid_credits` 테이블: total/used 회수 관리
- `prepaid_deductions` 테이블: month별 차감 기록 (UNIQUE student_name+month)
