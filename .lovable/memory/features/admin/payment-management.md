---
name: Payment Management
description: 어드민 결제확인/예산관리 — 선결제는 결제월 총액 반영, 이후 차감월은 0원
type: feature
---

# 결제확인 / 예산관리 핵심 규칙

## 선결제(prepaid) 매출 인식
- **현금흐름 기준**: 선결제 등록/결제월에 `total_sessions × LESSON_PRICE` 전액 산입
- 이후 달 차감분은 이미 결제월에 잡힌 금액이므로 예산 반영 **0원**
- 등록 달 총액 → **🔵 스토어 (선결제 N회)** 뱃지, 스토어 합계 + 수수료 적용
- 이후 달 차감분 → **🟣 차감 N회** 뱃지, 예산 0원
- 잔액 있으나 미차감 → **⚪ 선결제 (미차감)** 뱃지, 0원, opacity-60

## 예시 (선결제 6회 = 30만원)
- 5월 선결제 등록/결제 → 5월 매출 30만원 (스토어 (선결제 6회))
- 6월 4회 차감 → 6월 예산 반영 0원 (차감 4회)
- 계산 오류 방지를 위해 결제월에 통으로 잡고 이후 차감은 표시만 한다

## 환불
- `payment_confirmations.note` JSON의 `refund: true`로 표시
- `refundFlags` Set에서 budgetEligible 제외
- 우상단 "환불 표시" 토글 버튼 — 기존 그대로

## 입금 시점 vs 매출 시점
- 실제 PG 입금/매출 반영 모두 등록 달에 발생
- 이후 월의 차감은 잔여 횟수 관리용이며 예산 합계에는 포함하지 않음
- 수수료(4.95%)는 등록/결제월 총액에만 적용

## 관련 파일
- `src/components/admin/CashReceiptManagement.tsx` — `budgetRows` 계산 (line ~1180-1230)
- `prepaid_credits` 테이블: total/used 회수 관리
- `prepaid_deductions` 테이블: month별 차감 기록 (UNIQUE student_name+month)
