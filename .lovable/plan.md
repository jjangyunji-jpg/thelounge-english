# 일기 숙제 로직 종합 점검

## 발견된 문제

### 1. 진입한 세션 카드와 다른 회차로 제출이 날아감 (가장 큰 원인)
`resolveCanonicalSubmissionTarget`은 "학생의 다음 예정 세션"을 무조건 canonical target으로 잡는다.
- 학생이 **이번 주 카드(3회차)** 를 눌러 일기를 쓰는데, 다음 예정 세션이 4회차로 잡혀 있으면 제출/임시저장이 **4회차 행**에 기록된다.
- 그러면 3회차 카드에는 영영 "미제출"로 남고, 학생 본인은 "제출했는데 왜 안 뜨지?" 라고 보고하게 된다.
- 박하얀 사례, 황지예/조민혜의 "사라진 제출" 보고가 모두 이 한 가지 원인에서 파생됨.

**고침:** 진입한 assignment 자체가 이미 session_copy(`session_id != null` AND `is_preset = false`)면 그 row를 canonical로 쓴다. preset master로 진입한 경우에만 "다음 예정 세션"을 찾고, 그것도 없을 때만 최근 과거 세션으로 폴백.

### 2. 모달이 sibling 임시저장(draft) 내용을 보여주지 않음
WeeklyTasksSection / StudentDashboard 의 `getSub`는 `assignment_id` 정확히 일치만 본다. 그래서:
- preset_master에 저장된 draft가 있어도, 학생이 session_copy 카드를 누르면 **빈 textarea** 가 뜬다.
- 학생이 새 내용을 타이핑하면 autoSave가 sibling을 찾아서 update → **기존 draft 덮어씀**.
- "내용이 사라졌다" 민원의 직접 원인.

**고침:** 모달을 열 때만 sibling 풀에서 draft / 가장 최신 본을 끌어와 textarea 초기값으로 채운다. 카드 표시(미제출/완료/검토됨)는 지금처럼 strict-match 유지 (시각적 혼동 방지).

### 3. autoSave ↔ 수동 제출 race condition
- `performAutoSave`는 `inflightRef`로 자기 자신과의 동시실행만 막는다.
- 사용자가 입력 중 곧장 "제출하기" 누르면 `saveOrSubmit`은 동일한 lock을 확인/획득하지 않는다.
- 5초 인터벌 도중 클릭 시: autoSave가 insert 도중 → saveOrSubmit가 또 다른 canonical resolve → **draft + submitted 두 행 생성**.
- DB에서 실제로 한 학생의 같은 preset에 `draft + reviewed` 또는 `draft + submitted` 조합이 다수 발견됨.

**고침:**
- `inflightRef`를 autoSave와 submit이 공유하게 만든다.
- submit 시작 시 `inflightRef = true` 잡고, in-flight autoSave가 있다면 한번 더 await.
- 잡힌 동안에는 새 autoSave 트리거 무시.
- debounce timer / interval timer 도 submit 시작 시 즉시 clear.

### 4. 모달 닫을 때 debounce-pending 변경이 손실됨
1.5초 debounce 안에서 X 또는 바깥 클릭하면, 마지막 입력이 저장되기 전에 unmount되어 사라진다. "임시저장 안 됨" 보고의 일부 원인.

**고침:** `guardedClose` 진입 시 pending debounce를 즉시 flush (await performAutoSave) 후 close.

### 5. 두 개의 거의 동일한 제출 화면이 다른 로직으로 돌아감
- `HomeworkSubmitModal` (대시보드용) — autoSave, sibling lookup, 에러 표시 모두 구현
- `StudentHomeworkPanel`의 `SubmissionCard` (수업노트 인라인) — autoSave 없음, 임시저장 버튼 없음, sibling lookup만 부분 구현

**고침:** `SubmissionCard`에서도 동일 모달 컴포넌트를 호출하도록 통일하거나, 최소한 동일한 sibling-draft 프리필 로직을 추가. 이번 단계에서는 동일 모달로 통일.

### 6. `resolveCanonicalSubmissionTarget`이 새 session_copy 생성 시 제목·설명을 preset에서만 가져옴
`weekAssignments` 표시 로직(WeeklyTasksSection)은 "제출 전이면 master의 현재 description을 우선" 으로 하는데, 이미 생성된 카피의 description은 옛 값이 박혀있다. 카드 화면(master 덮어쓰기)과 실제 모달이 받는 assignment(카피의 옛 description)이 달라 강사가 수정한 지문이 모달에 반영되지 않는 경우가 있다.

**고침:** 모달 열 때 `assignment` prop 만들기 직전에도 동일하게 master description 머지 적용.

---

## 변경 파일

- `src/lib/homeworkSubmissionLookup.ts`
  - `resolveCanonicalSubmissionTarget`: self-row가 이미 valid session_copy면 그것을 canonical로 사용. 그 외 경우만 upcoming/past 폴백.
  - sibling pool에서 가장 최신 draft/submission을 반환하는 `findLatestSiblingDraft` 추가 (모달 프리필용).
- `src/components/dashboard/HomeworkSubmitModal.tsx`
  - 진입 시 prop submission이 null이면 비동기로 sibling draft를 끌어와 textarea/audio prefill.
  - `inflightRef`를 submit·autoSave가 공유. submit 시 timer clear + pending flush.
  - `guardedClose`에서 pending debounce flush.
- `src/components/dashboard/WeeklyTasksSection.tsx`
  - 모달에 넘기는 `assignment`에 master description 머지 (제출 전인 경우만, 기존 로직 일관성).
- `src/components/classroom/StudentHomeworkPanel.tsx`
  - 인라인 `SubmissionCard` 의 직접 submit 로직 제거하고 `HomeworkSubmitModal` 재사용.

## 검증 후 데이터 정리(별도 단계)
지금 DB에 있는 sibling draft + reviewed 중복은 코드 수정만으로는 정리되지 않음. 코드 배포 후, 한 student × preset 당:
- `reviewed` / `submitted` 가 있는 행이 있으면 → 나머지 동일 preset의 `draft` 행은 삭제
- 위 작업은 사용자 확인 후 일괄 실행 (별도 supabase--insert 호출)

## 비기능 영향
- 강사 대시보드 미확인 카운트는 read 쪽 strict-match를 유지하므로 변동 없음.
- 학생 카드 표시 상태도 strict-match 유지로 동일.
- 변경의 본질은 "어디에 쓰느냐(write target)"를 학생이 보고 있는 카드와 맞추는 것 + race 차단 + draft 프리필.
