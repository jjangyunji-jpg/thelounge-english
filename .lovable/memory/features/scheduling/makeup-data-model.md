---
name: Makeup Session Data Model
description: 보강 신청 승인 시 원본 sick 세션 유지 + 별도 보강 세션 생성, 모달은 origin 매칭으로 통합 표시
type: feature
---
보강 신청(reschedule) 승인 시 데이터 구조:
- 원본 세션은 그대로 유지하되 cancellation_type='sick', cancellation_resolution='makeup_completed'로 표시
- 새 보강 세션을 별도 행으로 INSERT (scheduled_at=새 시각, reschedule_origin_dates=[원본 KST 날짜])
- notes/topic/remarks는 원본에서 새 세션으로 이전

승인 취소(cancel) 시:
- 새 보강 세션의 notes/topic/remarks를 원본으로 되돌리고 새 세션 삭제
- 원본의 cancellation 마커 해제

SessionEditModal:
- 같은 기간 내 보강 행은 숨기고, 원본 sick 행에 "보강 잡힘 → M/D HH:mm" 표기
- makeupByOriginDate 맵으로 페어링
- 매칭되는 원본 행이 같은 모달 내에 없는 보강 행은 기존처럼 별도 카드로 표시 (다른 달로 보강된 경우)

SessionCountReport:
- 두 행 모두 자연스럽게 카운트 (병결 +1, 보강 +1)
- 변경 불필요
