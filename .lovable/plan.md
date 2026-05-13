
## 목표
기업 수강생의 "매니저(신청·결제 담당)"와 "학생(실제 수강)"을 데이터 모델에서 분리하고, 결제확인 화면을 **그룹 단위 청구**로 재구성한다.

---

## 1. 스키마 변경 (마이그레이션)

`instructor_students`에 컬럼 추가:
- `corporate_role` text default `'learner'` — `'learner'` | `'manager'` | `'learner_manager'`
- `corporate_account` text nullable — 회사/매니저 그룹 식별자

인덱스: `corporate_account` 조회용.

---

## 2. 데이터 마이그레이션

| student_name | corporate_role | corporate_account | group_students 변경 |
|---|---|---|---|
| 전현지 | manager | 전현지팀 | [] |
| 도은, 지아나, 선혜, 연정, 지은 | learner | 전현지팀 | (현재 그대로 유지) |
| 김동욱 | manager | 황재민팀 | [] |
| 황재민 | learner | 황재민팀 | **[] (김동욱 제거)** |
| 환웅, 오의식 | learner_manager | (본인명) | [] |

황재민의 group_students에서 김동욱 제거 → 자동 50k 적용.

---

## 3. 코드 변경

### A. 결제확인 (CashReceiptManagement) — 가장 큰 변경
- `corporate_role='manager'` 행은 학생 목록에서 완전히 제외 (또는 매니저 섹션 분리)
- 청구 행을 `corporate_account` 단위로 그룹화:
  - learner_manager 단독 → 1행, 50k × 회수
  - 그룹 (도은+지아나) → 1행 표시 "도은 + 지아나", 70k × 회수 (그룹 수업 횟수 = 한 명 기준)
  - 개인 (지은, 황재민) → 1행, 50k × 회수
- billable_count 계산: 그룹의 경우 멤버 1명의 수업 카운트 사용 (전원이 동일하다고 가정)
- billable_overrides는 student_name 기준 유지 (그룹 대표자 = group_students 정렬 시 첫 이름)

### B. SessionCountReport
- manager 행 제외
- 학생별 카운트는 그대로 유지 (개별 수업 출결 추적 목적)

### C. 세션 자동 생성 (autoGenerateSessions)
- `corporate_role='manager'` 행은 스킵

### D. 보강 신청 (MakeupRequestModal)
- 로그인 사용자가 manager면 → 첫 단계에 "어느 학생 대신 신청?" 학생 선택 추가
- learner_manager는 본인 자동 선택
- 일반 learner도 본인 자동 선택

### E. 학생 대시보드 (StudentDashboard)
- manager 로그인 시 → 관리하는 learner 목록 표시, 학생 전환 탭/드롭다운으로 각 학생의 일정·노트·보강 조회
- learner_manager는 일반 학생 UI 그대로

### F. 어드민 학생 관리 (StudentManagement)
- 기업 탭 안에서 매니저 행은 별도 섹션 또는 "매니저" 뱃지로 표기
- 학생 카드에 corporate_account 표시

### G. 등록/수정 폼 (TransferStudentModal 등)
- `corporate_role` 라디오 + `corporate_account` 텍스트 입력 추가 (기업 수강생 선택 시)

---

## 4. 검증
- 마이그레이션 후 황재민 단가가 50k로 표시되는지 확인
- 도은+지아나 그룹이 결제확인에 1행으로 70k×N 표시되는지 확인
- 전현지 로그인 시 학생 5명 목록이 보이는지 확인
- manager 행이 세션 자동 생성에서 제외되는지 확인

---

## 5. 영향 범위 (변경 파일)
- `supabase/migrations/<new>.sql` (신규)
- `src/components/admin/CashReceiptManagement.tsx`
- `src/components/admin/SessionCountReport.tsx`
- `src/components/admin/StudentManagement.tsx`
- `src/components/admin/TransferStudentModal.tsx`
- `src/components/admin/EditTransferModal.tsx`
- `src/lib/autoGenerateSessions.ts`
- `src/components/dashboard/MakeupRequestModal.tsx`
- `src/pages/StudentDashboard.tsx`

---

## 비고
- `class_sessions`, `homework_assignments` 등은 student_name 기반이라 영향 없음
- 보강 슬롯·기존 청구 데이터에 영향 없음
- manager 행은 user_id로 로그인하지만 수업/결제에서는 invisible
