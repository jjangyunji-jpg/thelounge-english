---
name: Makeup Period Boundary & Transfer-aware Instructor
description: 보강 신청은 원본 수업이 속한 schedule_periods 기간 + 원본 수업의 강사 슬롯에서만 가능 (이관 진행 학생 대응)
type: feature
---
보강 신청 슬롯 가시성 규칙:

1. **기간 제약(period boundary)**: 원본 수업이 속한 schedule_period 기간 내 슬롯만 표시. 4월 수업은 4월 안에서만 보강.

2. **강사 제약(transfer-aware)**: 원본 수업의 강사가 소유한 슬롯만 표시. 학생이 강사 이관 중인 경우(예: 4월=Reina, 5월=장다겸), 4월 수업의 보강은 Reina 슬롯에서, 5월 수업의 보강은 장다겸 슬롯에서 선택.
   - 모달은 학생의 모든 (현재+과거) 강사를 `instructor_students`에서 조회해 슬롯을 한 번에 fetch.
   - `targetInstructorName`은 reschedule/makeup의 경우 선택된 원본 수업의 instructor_name, extra의 경우 현재 담당 강사(prop) 사용.
   - `makeup_requests.instructor_name`은 슬롯 소유자 = 보강 진행 강사로 저장 → 강사 대시보드 매칭 정확.

3. **빈 캘린더 안내**: visibleSlots가 0이면 "{강사명} 강사님이 아직 이 기간에 가능한 시간을 등록하지 않았어요. 강사님께 문의해 주세요." 메시지 노출.

4. **booked 슬롯 표시**: open + booked 모두 fetch해 캘린더에 매진/잔여 카운트 표시, 시간 버튼은 "신청 완료"로 비활성. 다른 신청자 인기도 가시화.
