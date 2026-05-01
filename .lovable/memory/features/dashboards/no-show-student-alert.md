---
name: 노쇼 처리 시 학생 자동 알림
description: 강사가 노쇼 클릭하면 admin_notifications에 target=student:이름으로 알림 생성, 학생 대시보드 인박스 팝업
type: feature
---
강사 대시보드 SessionCancellationModal에서 cancellation_type='no_show' 확정 시 InstructorDashboard.tsx의 onConfirm에서 admin_notifications에 INSERT.
- target 형식: `student:${student_name}` (개별 타겟)
- 본문: "오늘 [날짜] 수업은 30분 대기 후 노쇼로 처리되었습니다. 이에 수업료가 차감되며 보강은 진행되지 않습니다. 관련 문의는 개별적으로 연락 주시기 바랍니다."

NotificationInbox는 새 prop `studentName`을 받아 role==='student'일 때 `student:${name}` 타겟도 필터링에 포함. 학생 대시보드 헤더 우측 상단에 NotificationInbox 배치(authUserId+authStudent 필요).
