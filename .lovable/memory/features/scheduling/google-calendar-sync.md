---
name: Google Calendar Sync (보강 자동 동기화)
description: handle-makeup-request에서 보강 승인/거절/취소 시 Reina 관리자 Google Calendar에 자동 반영
type: feature
---

## 개요
- 연동: Lovable Google Calendar 커넥터 (단일 관리자 캘린더 = Reina의 primary)
- 트리거: 강사가 `handle-makeup-request` 호출 시 즉시 동기화
- 트랜스포트: `connector-gateway.lovable.dev/google_calendar/calendar/v3` (직접 Google API 호출 금지)
- 사용 시크릿: `LOVABLE_API_KEY`, `GOOGLE_CALENDAR_API_KEY`
- 필요 스코프: `https://www.googleapis.com/auth/calendar` (이벤트 쓰기/삭제)

## DB
- `class_sessions.gcal_event_id text` — 캘린더 이벤트 ID 저장(삭제·복원에 사용)

## 이벤트 제목 규칙 (`gcal.ts` formatEventTitle)
- 정규: `개인_홍길동` 또는 `개인_홍길동 / English`
- 기업(`instructor_students.student_type='corporate'`): `기업_홍길동`

## 동작 (action별)
### approve · reschedule
1. 원본 세션의 `gcal_event_id` 캘린더에서 삭제
2. 원본을 sick + makeup_completed 마커로 갱신, `gcal_event_id`=null
3. 새 시간으로 캘린더 이벤트 생성 (50분, KST, 학생 고정 meet_link 포함)
4. 새 보강 `class_sessions`에 `gcal_event_id` 저장

### approve · extra
1. 새 보강 세션용 캘린더 이벤트 생성 후 `gcal_event_id` 저장
2. 원본 노트/주제/비고는 새 세션으로 이전 후 원본 클리어

### reject
- 캘린더 변경 없음 (승인 전이므로 이벤트 자체가 없음)

### cancel (승인 취소)
- reschedule: 보강 이벤트 삭제 → 원본 시간에 이벤트 재생성하고 원본 행에 `gcal_event_id` 저장
- extra: 보강 이벤트 삭제 + 보강 세션 삭제

## 정책
- Meet 링크: 학생 `instructor_students.meet_link` 고정 사용 (Calendar 자동 생성 X)
- 캘린더 ID: `primary` (관리자 통합)
- 이벤트 시간대: `Asia/Seoul`, 길이 50분
- 캘린더 호출 실패는 로그만 남기고 DB 작업은 계속 진행 (eventId=null 허용)
