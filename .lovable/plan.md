# 숙제 제출 Write 경로 통일

## 목표
같은 회차 숙제(쌍둥이 assignment rows)에 대한 모든 draft/insert/update가 **항상 동일한 assignment_id**로 기록되도록 강제. 재발 차단.

## 핵심 결정: "canonical assignment id" 산출 규칙

다음 우선순위로 1개 row만 선택:

1. **이미 제출본이 존재하는 sibling이 있으면 그 row의 assignment_id 사용**
   (가장 강한 status: submitted > draft, 동률이면 최신 submitted_at)
2. 없으면 prop으로 받은 assignment row 그대로 사용

이 규칙의 장점:
- 기존 데이터를 **이동시키지 않음** → 마이그레이션 불필요
- FK가 `ON DELETE CASCADE`라서, "다른 row로 옮기기"는 데이터 손실 위험이 있는데 이 방식은 그 위험을 회피
- 진입 경로가 바뀌어도 첫 제출본이 있던 row로 항상 합류 → 분산 멈춤

## 변경 파일

### 1. `src/lib/homeworkSubmissionLookup.ts`
새 헬퍼 추가:
```ts
export function resolveCanonicalAssignmentId(
  a: HwAssignmentLite,
  allAssignments: HwAssignmentLite[],
  submissions: HwSubmissionLite[]
): string
```
- sibling pool 산출 (기존 findSubmissionForAssignment 와 동일 로직 재사용)
- pool 안의 submissions 중 best 1건의 assignment_id 반환
- 없으면 `a.id` 반환

### 2. `src/components/dashboard/HomeworkSubmitModal.tsx`
- 모달이 열릴 때 sibling assignments + 모든 submissions를 한 번 fetch
- `resolveCanonicalAssignmentId`로 **canonicalId**를 계산하여 state로 고정
- 이후 모든 write 지점(`performAutoSave`, `saveOrSubmit`의 insert/update, 기존 submission 조회)에서 `assignment.id` 대신 **canonicalId** 사용
- Storage path도 canonicalId 기반(`${canonicalId}/...`)으로 변경

### 3. `src/components/classroom/StudentHomeworkPanel.tsx`
동일하게 canonicalId 결정 후 write 시 사용.

### 4. (선택) `src/pages/Classroom.tsx` 강사 측 view
write 경로 없음 (강사가 학생 제출은 안 함). 다만 새 sibling row를 만드는 로직 (line 1076)은 손대지 않음 — 그건 "이 회차에 이 숙제가 배정됐다"는 메타데이터라서 유지 필요.

---

## 예상 부작용 및 사전 검토

### ✅ 안전한 변화
1. **기존 분산 데이터** — 그대로 남아도 read-side merger(이미 반영)가 best submission을 보여줌. 표시상 문제 없음.
2. **동일 학생이 다른 경로로 진입** — 항상 같은 canonicalId 해석 → 같은 row 업데이트.
3. **수업 회차마다 한 번씩 제출** — preset이 매 회차마다 새 session-copy row를 만드는 구조는 유지. 매 회차의 첫 제출은 그 회차의 row에 들어가고 그 이후엔 canonical 유지.

### ⚠️ 주의 / 트레이드오프
1. **FK ON DELETE CASCADE**
   - canonical로 선택된 row(예: 과거 세션 복사본)가 어떤 사유로 삭제되면 submission도 cascade 삭제됨.
   - **기존에도 동일한 위험이 존재**. 이번 변경으로 위험이 증가하지는 않음(어차피 submission은 1개 row에만 매달려 있었음).
   - 별건이지만 권장: `ON DELETE SET NULL`로 완화하거나, session-copy 삭제 트리거 추가 검토. → **이번 작업 범위에는 포함하지 않음** (사용자 승인 시 별도 진행).

2. **첫 제출의 race condition**
   - 학생이 두 탭에서 동시에 첫 제출 → 두 row에 동시에 insert 가능. 매우 드물지만 가능.
   - read-side merger가 best를 보여줘서 사용자 체감은 없음. 데이터만 1건 dead-weight.
   - 추가 보호 원하면 DB unique constraint `(assignment_id, student_name)` + sibling 키 정규화 필요한데, 이번 범위에서는 생략.

3. **기존에 잘못된 row에 제출본이 들어간 학생들(조민혜 4회 등)**
   - 4회는 양쪽 모두 draft → canonical은 "best draft" 1개로 결정됨. 다른 draft는 read에서 무시되지만 DB엔 남음.
   - 사용자가 새로 입력하면 canonical row 1개만 갱신됨 → 깨끗해짐.
   - **다른 쪽 draft의 내용은 자동 마이그레이션 안 함** (덮어쓰기 위험). 필요하면 별도 SQL로 수동 통합.

4. **강사 대시보드 미확인 카운트**
   - read-side가 이미 sibling pool로 best를 보므로 영향 없음. 오히려 정확해짐.

5. **임시저장 인디케이터**
   - 모달이 canonical로 통일되므로 "임시저장됨" 표시가 일관됨. 변동 없음.

### 🟢 회귀 검증 포인트
- [ ] 일기쓰기 신규 제출 (대시보드 진입)
- [ ] 일기쓰기 신규 제출 (수업방 진입)  
- [ ] draft 자동저장 후 다른 경로 재진입 시 같은 내용 보임
- [ ] 강사 대시보드 미확인 숙제 카운트
- [ ] 강사 코멘트 후 reviewed 상태 표시
- [ ] file/audio 업로드형 숙제 (writing 외)

---

## 마이그레이션 없음
- DB 스키마 변경 없음
- 기존 데이터 이동 없음
- 코드 변경만으로 완료

승인하시면 위 3개 파일 수정으로 진행하겠습니다.
