## 예약형 강사 이관 시스템

### 현재 문제점
- 이관 즉시 실행 → 이관일 이전에도 신규 강사가 접근 불가
- 모든 미시작 세션 삭제 → 이관일 이전 세션까지 삭제됨
- 세션 자동 생성 안 됨

### 구현 계획

#### 1. DB 변경: `instructor_students` 테이블에 이관 메타데이터 추가
- `transfer_from_id` (uuid, nullable) — 이관 원본 레코드 ID (이전 강사의 instructor_students.id)
- `transfer_date` (date, nullable) — 이관 예정일
- `transfer_status` (text, nullable) — `pending` | `completed` | `cancelled`

이관 설정 시:
- 기존 레코드: **active 유지** (이관일까지 기존 강사가 계속 수업)
- 신규 레코드: `status='active'`, `transfer_status='pending'`, `transfer_date` 설정

#### 2. 이관 설정 시 동작 (TransferStudentModal)
1. 신규 강사 레코드 생성 (`transfer_status: 'pending'`, `transfer_from_id: 기존레코드ID`)
2. 기존 레코드는 **그대로 active 유지** (end_date만 이관일로 설정)
3. 이관일 이후의 기존 강사 미시작/노트없는 세션만 삭제
4. `autoGenerateSessions()` 호출하여 신규 강사의 이관일 이후 세션 자동 생성

#### 3. 접근 권한 처리
- 신규 강사 (`transfer_status='pending'`): 해당 학생의 모든 세션 노트 **읽기 전용** 접근 가능
- 이관일 이전 세션: 기존 강사만 수정 가능
- 이관일 이후 세션: 신규 강사만 수정 가능

#### 4. 이관일 도래 시 처리
- 수동 또는 자동으로 `transfer_status`를 `completed`로 전환
- 기존 레코드: `status='inactive'` 전환
- 실질적으로는 이관일이 지나면 세션이 이미 신규 강사 명의로 생성되어 있으므로, 상태 전환은 정리 차원

#### 5. 피드백 귀속
- 이관일 기준 자동 분리 (기존 로직 유지 — `instructor_name` 기반)
- 이미 구현된 "세션 수 기준 피드백 대상 강사 자동 지정" 로직과 호환

### 영향받는 파일
- `supabase/migrations/` — 새 컬럼 3개 추가
- `TransferStudentModal.tsx` — 이관 로직 수정
- `InstructorDashboard.tsx` — pending 이관 학생 노트 읽기 권한
- `autoGenerateSessions.ts` — 이관 후 자동 호출
- `generate-sessions` edge function — 이관일 기준 필터링
