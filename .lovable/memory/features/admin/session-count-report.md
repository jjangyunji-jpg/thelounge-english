---
name: 어드민 월별 수업 카운트
description: 결제확인 탭 상단 - 강사별 그룹핑된 학생 수업 상태 집계 + 인라인 편집 + PDF 다운로드
type: feature
---
어드민 → 결제 확인(CashReceipt) 탭 상단의 `SessionCountReport`.

## 표시 구조
- 정규 수강생 / 기업 수강생 2개 세그먼트로 분리
- 각 세그먼트 내부에서 **강사별로 묶어서** 별도 테이블 출력
- 컬럼: 학생명 | 완료 | 보강 | 노쇼 | 당일 | 병결 | 강사취소 | 사전 | 예정 | 전체 | 편집

## 기간 필터
- `정산 기간` (schedule_periods, ◀ ▶ 네비게이션) / `달력 월` (캘린더 popover) 두 모드 토글

## 인라인 편집 (`SessionEditModal`)
- 학생 행의 ✏️ 버튼 클릭 → 해당 기간 내 모든 세션 목록 모달
- 세션별로 상태 버튼 그룹: 완료 / 예정 / 노쇼 / 당일취소 / 병결 / 강사취소 / 사전취소
- 변경 시 `cancellation_type` + `ended_at` 업데이트 (완료 시 ended_at=now, 예정/취소 시 ended_at=null)
- 변경된 세션은 primary 보더로 표시. 저장 시 `loadData()` 재호출.

## PDF (`exportSessionCountPdf.ts`)
- 가로 A4, SpoqaHanSansNeo 폰트
- 정규/기업 세그먼트 → 강사별 ▸ 헤더 + 테이블 + 합계 footer

## 제외 규칙
- TEST_ACCOUNTS (`test`, `test 2`, `test2`) 제외
- `total === 0` 학생 숨김
- 학생 dedupe (transfer 중복 방지)

## 강사명 산정
- `instructor_students.instructor_name` 우선
- 없으면 첫 세션의 `instructor_name`
- 둘 다 없으면 `(미배정)`
