---
name: Teaching Material Access Control
description: teaching_materials는 폴더(카테고리) 단위로 강사 권한 지정. 매핑 없으면 비공개. 폴더는 A/B/C 레벨 태그와 보관함(is_archived) 지원. 보관 폴더는 강사 화면 숨김.
type: feature
---

수업 자료(teaching_materials) 접근은 폴더(카테고리) 단위로 제어합니다.

- 매핑 테이블 `teaching_category_instructors (category, instructor_id)`로 폴더↔강사 연결.
- 강사 RLS: 본인이 매핑된 폴더와 그 안의 활성 자료만 조회. 매핑 없으면 비공개.
- 매니저 이상은 매핑/보관/레벨 무관 모든 폴더·자료 접근.

### 폴더 메타
- `level`: A/B/C 또는 NULL. 어드민 상단 레벨 필터(전체/A/B/C/보관함) 및 폴더 탭 옆 레벨 배지로 노출.
- `is_archived`: true이면 강사 화면에서 폴더와 자료 모두 숨김. 어드민은 '보관함' 필터에서 확인·복원 가능.

### 어드민 UI
- 활성 폴더 탭 hover 시 노출되는 액션바: A/B/C 토글, 강사 권한, 이름 변경, 보관/복원, 삭제.
- 강사 수 배지: 0명이면 destructive 색상 경고.
