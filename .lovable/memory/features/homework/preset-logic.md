---
name: Homework Presets
description: 정기 숙제(preset)는 템플릿-복사 모델. 클래스룸 진입 시 세션 복사본 자동 생성. 단 preset.created_at < session.scheduled_at 인 경우만 복사/표시되어 신규 등록 preset이 과거 세션에 소급 노출되지 않음.
type: feature
---

## 모델
- `homework_assignments.is_preset = true` → 학생별 템플릿(원본). session_id NULL.
- 클래스룸 진입 시 해당 세션용 복사본(`is_preset=false`, `preset_origin_id=원본id`, `session_id=현재세션`) 자동 생성.
- 학생 대시보드/지난 숙제 현황 등 모든 표시는 복사본 기준.

## 시간 가드 (CRITICAL)
**preset의 `created_at`이 해당 세션의 `scheduled_at`보다 이후이면 복사도, 표시도 하지 않음.**

이유: 강사가 4/24에 새 정기 숙제(예: "Dialogue 외우기")를 등록했는데, 4/19 과거 세션 노트를 다시 열면 그 preset이 4/19 "지난 숙제 현황"에도 표시되는 버그 방지.

적용 위치 (`src/pages/Classroom.tsx`):
1. **현재 세션 자동 복사** (`presetsNeedingCopy`): `new Date(d.created_at).getTime() < session.scheduledAt.getTime()`
2. **prev 세션 표시** (`filteredPrev`): preset 템플릿 후보가 `created_at >= prevSession.scheduled_at`이면 제외

## 중복 제거
- 같은 세션에 동일 title의 manual 숙제 + preset 복사본이 공존하면 manual 숙제를 숨김.
- `preset_origin_id` 매칭으로 템플릿 자체는 항상 숨김.

## 데이터 정리
잘못 자동 생성된 과거 복사본은 다음 SQL로 안전하게 제거 가능 (제출 기록 있는 항목 보존):
```sql
DELETE FROM homework_assignments ha USING class_sessions cs
WHERE ha.session_id = cs.id
  AND ha.preset_origin_id IS NOT NULL
  AND ha.created_at > cs.scheduled_at
  AND NOT EXISTS (SELECT 1 FROM homework_submissions hs WHERE hs.assignment_id = ha.id);
```
