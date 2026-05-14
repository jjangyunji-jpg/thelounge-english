---
name: Makeup Session Data Model
description: 보강 신청 승인 시 원본 sick 세션 유지 + 별도 보강 세션 생성, urgent_reason은 class_sessions.is_urgent_makeup으로 마킹
type: feature
---
보강 신청(reschedule/extra) 승인 시 데이터 구조:
- 원본 세션은 그대로 유지하되 cancellation_type='sick', cancellation_resolution='makeup_completed'로 표시 (extra의 경우)
- 새 보강 세션을 별도 행으로 INSERT (scheduled_at=새 시각, reschedule_origin_dates=[원본 KST 날짜])
- `is_urgent_makeup = !!makeup_requests.urgent_reason` — 예외(긴급) 사유 보강은 true
- notes/topic/remarks는 원본에서 새 세션으로 이전

승인 취소(cancel) 시:
- 새 보강 세션의 notes/topic/remarks를 원본으로 되돌리고 새 세션 삭제
- 원본의 cancellation 마커 해제

UI 표기 (모든 화면 공통, MakeupBadges 컴포넌트):
- reschedule_origin_dates가 있으면 "보강" 뱃지 + "(M월 D일에서 변경)" 문구 항상 표기
- is_urgent_makeup=true면 "예외보강" 뱃지 추가 (destructive 색)
- 적용 위치: SessionSidebar, InstructorDashboard (다음 수업/이번주/오늘), StudentDashboard (다음 수업 카드 2곳)

SessionEditModal:
- 같은 기간 내 보강 행은 숨기고, 원본 sick 행에 "보강 잡힘 → M/D HH:mm" 표기
- makeupByOriginDate 맵으로 페어링

SessionCountReport:
- 두 행 모두 자연스럽게 카운트 (병결 +1, 보강 +1)
