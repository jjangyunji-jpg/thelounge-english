
## 배경
김춘호: 기존 12회 선결제(완전 차감됨) + 6월에 새 12회 추가 → 현재 한 행에 24/12로 합쳐져 있음.
요구: 결제 단위(트랜치)별로 분리 표시, 새 12회는 600,000원으로 6월 예산에 반영, 예산 요약은 결제완료만, 예산 관리는 예상치 기준.

## 변경 사항

### 1) DB 스키마
- `prepaid_credits.student_name` UNIQUE 제약 제거 (학생당 여러 트랜치 허용)
- `prepaid_credits`에 `payment_month text` 컬럼 추가 (예: '2026-06') — 어느 달 결제분인지 추적
- `prepaid_credits`에 `fee_total integer` 컬럼 추가 (선결제 등록 시 총액 직접 저장; NULL이면 `total_sessions × 50,000` 폴백)
- `prepaid_deductions`는 학생+월 단위 그대로 유지 (트랜치 간 FIFO로 차감: 오래된 잔여부터 사용)

### 2) 데이터 정정 (김춘호)
- 기존 24/12 행을 두 행으로 분리:
  - 행 A: 12회 등록, 12회 사용, payment_month=NULL, note="기존 12회"
  - 행 B: 12회 등록, 0회 사용, payment_month='2026-06', fee_total=600000, note="6월 추가 12회"

### 3) CashReceiptManagement.tsx 리팩토링
- `creditMap: Map<string, PrepaidCredit>` → `creditsByStudent: Map<string, PrepaidCredit[]>` (정렬: created_at asc)
- 학생별 표시: 트랜치별로 "X/Y회" 칩 여러 개 (예: `12/12 · 12/12`)
- "선결제 등록/충전" 모달: 기존 행에 충전 대신 **새 트랜치 추가**로 전환, payment_month는 현재 period로 자동 설정, 금액(₩) 입력 필드 추가 (기본값 = 회수×50,000)
- 차감 로직: FIFO로 잔여가 있는 트랜치에서 순차 차감

### 4) 예산 관리 탭 (예상치 — 기존 동작)
- 학생별 budgetRow 산출 시 트랜치들 합산:
  - `payment_month === periodKey`인 트랜치: `fee_total ?? sessions×50000`을 가산 (스토어, "🔵 스토어 (선결제 N회)" 뱃지)
  - 그 외 트랜치 + 차감 있음: 0원, "🟣 차감 N회" 뱃지
  - 잔액 있고 차감 없음: 0원, "⚪ 선결제 (미차감)" 뱃지
- 김춘호 6월 예산 관리에 자동으로 600,000원 반영됨

### 5) 예산 요약 탭 (결제완료 기준 — 신규)
- 기준: `payment_confirmations.confirmed === true`인 학생만 매출 산입
- 선결제 학생도 같은 기준 (해당 학생의 confirmation이 confirmed=true일 때만 포함)
- AI 프로그램은 기존대로 `ai_program_payments.paid` 기준
- 기업은 그대로 발생액 기반 (후불이라 별도 결제완료 토글 없음 → 기존 유지하되 카드에 "기업 발생액(후불)" 주석)
- 상단에 "결제완료 N / 전체 M" 표시

### 6) UI 보조
- 예산 관리 카드 라벨에 "(예상)" 명시, 예산 요약 카드 라벨에 "(결제완료 기준)" 명시
- 예산 관리에서 김춘호 행 클릭 시 트랜치 내역 툴팁

## 영향 범위
- DB: 마이그레이션 1건 + 데이터 정정 INSERT/UPDATE 1건
- 코드: `src/components/admin/CashReceiptManagement.tsx` 단일 파일 (creditMap → creditsByStudent 리팩토링)
- 메모리: `mem://features/admin/payment-management.md` 업데이트
