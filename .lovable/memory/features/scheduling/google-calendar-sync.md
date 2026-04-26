---
name: Google Calendar Sync (보강 자동 동기화)
description: handle-makeup-request에서 보강 승인/거절/취소 시 강사별 매핑 캘린더에 자동 반영
type: feature
---

## 개요
- 연동: Lovable Google Calendar 커넥터 (Reina 워크스페이스 OAuth)
- 트리거: 강사가 `handle-makeup-request` 호출 시 즉시 동기화
- 트랜스포트: `connector-gateway.lovable.dev/google_calendar/calendar/v3` (직접 Google API 호출 금지)
- 사용 시크릿: `LOVABLE_API_KEY`, `GOOGLE_CALENDAR_API_KEY`
- 필요 스코프: `https://www.googleapis.com/auth/calendar` (이벤트 쓰기/삭제)

## 캘린더 라우팅 (강사별 분리)
- 매핑 테이블: `public.instructor_calendar_mapping(instructor_name UNIQUE, gcal_calendar_id, display_name)`
- `display_name`은 캘린더 이벤트 제목용 표시 이름 (예: 장리원 → "Reina"). 없으면 instructor_name을 그대로 사용
- `handle-makeup-request`가 강사명으로 매핑을 조회해 `createCalendarEvent({ calendarId })`로 전달하고, 제목에는 `display_name`을 사용
- 매핑이 없으면 기본 캘린더 `reina@thelounge-english.co.kr` (Organizer)로 폴백
- 초기 매핑:
  - `장리원 → Class-Reina` (`c_b613a8fa91...@group.calendar.google.com`), display_name = `Reina`
- 새 강사 추가는 매니저가 매핑 테이블에 row 추가 (Lovable에서 직접 INSERT 또는 추후 어드민 UI)

## DB
- `class_sessions.gcal_event_id text` — `"<calendarId>::<eventId>"` 형식 토큰 저장
  - 한 컬럼만으로 어느 캘린더에서 삭제할지 알 수 있도록 인코딩
  - 레거시(`::` 없는 값)는 기본 캘린더에서 삭제 시도

## 이벤트 제목 규칙 (`gcal.ts` formatEventTitle)
- 보강: `(보) 강사영어이름_학생한글이름`
- 예: `(보) Reina_장현민`

## 동작 (action별)
### approve · reschedule
1. 원본 세션의 `gcal_event_id` 캘린더에서 삭제 (토큰의 calendarId 사용)
2. 원본을 sick + makeup_completed 마커로 갱신, `gcal_event_id`=null
3. 새 시간으로 강사 매핑 캘린더에 이벤트 생성 (60분, KST, 학생 고정 meet_link 포함)
4. 새 보강 `class_sessions`에 `gcal_event_id` 토큰 저장

### approve · extra
1. 강사 매핑 캘린더에 보강 세션 이벤트 생성 후 토큰 저장
2. 원본 노트/주제/비고는 새 세션으로 이전 후 원본 클리어

### reject
- 캘린더 변경 없음 (승인 전이므로 이벤트 자체가 없음)

### cancel (승인 취소)
- reschedule: 보강 이벤트 삭제 → 원본 시간에 이벤트 재생성하고 원본 행에 토큰 저장
- extra: 보강 이벤트 삭제 + 보강 세션 삭제

## 정책
- 이벤트 길이: **60분** (정규 수업 시간)
- 시간대: `Asia/Seoul`
- Meet 링크: 학생 `instructor_students.meet_link` 고정 사용 (Calendar 자동 생성 X)
- 캘린더 호출 실패는 로그만 남기고 DB 작업은 계속 진행 (eventId=null 허용)
