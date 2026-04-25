---
name: Session Count Report
description: 어드민 결제확인 탭의 학생별 월별 수업 카운트 리포트 — 강사별 그룹핑, 인라인 편집, 이월(carryover) 시스템, 결제대상 자동 산출
type: feature
---

# 월별 수업 카운트 리포트

## 위치
- 어드민 → 결제확인 탭 상단의 `SessionCountReport` 섹션
- 컴포넌트: `src/components/admin/SessionCountReport.tsx`
- 편집 모달: `src/components/admin/SessionEditModal.tsx`
- PDF: `src/lib/exportSessionCountPdf.ts`

## 컬럼 구성 (좌→우)
완료 / 보강 / 노쇼 / 당일 / 병결 / 강사취소 / 사전 / 미체크 / **이월(당월)** / **이월(전월)** / **전월차감** / 예정 / 전체 / **실수업** / **결제대상** / 편집

### 이월 컬럼 분류 규칙
- **이월(당월)** = `carryover_direction = 'next'` 카운트 (이번 달 → 다음 달 이월)
- **이월(전월)** = `carryover_direction = 'prev'` 카운트 (전월 → 이번 달 이월). 미체크/예정/완료에서 제외되고 별도 컬럼만 차지. **실수업에는 포함**, **전체(total)에서는 제외**.
- **전월차감** = 직전 schedule_period의 `next` + `instructor_cancel` 합산 (음수 표시). 결제대상 산출용.

## 핵심 비즈니스 룰: 결제대상 = 4 - 전월차감
- **모든 학생은 월 4회 결제가 기본** (`BASE_MONTHLY_COUNT = 4`).
- **결제대상(billable)** = `4 - 전월차감(prev_carryover_in)`. 실수업 횟수와 완전 무관.
- **실수업(actual_lessons)** = 완료 + 보강완료 + 노쇼. 강사 정산 기준과 동일하지만 결제대상과는 별도 컬럼으로 분리 표시.
- 음수 방지: `Math.max(0, ...)`

## 전월차감(prev_carryover_in)에 포함되는 항목
직전 schedule_period(또는 직전 캘린더월)에서 다음 두 가지를 합산:
1. `is_carryover = true` (수동 이월 토글)
2. `cancellation_type = 'instructor_cancel'` (강사취소는 자동 다음달 이월)

**병결(sick)은 자동 이월 대상 아님**. 해당 월 내 보강 진행이 원칙이며, 마지막 주 발생 시 다음달 첫주까지만 허용.

### 예시 (이상욱 4월 → 5월)
- 4월: 결제대상 4 / 실수업 2 (강사취소 1, 이월 1 발생)
- 5월: 결제대상 4 - 2(전월 강사취소+이월) = **2** / 실수업 4 (정상 진행 시)

## 이월(Carryover) 토글
- DB 컬럼: `class_sessions.is_carryover` (boolean, default false)
- **취소 카테고리와 독립적인 플래그** — 어떤 cancellation_type이든 ON 가능
- 강사-학생 협의 결과를 표시하는 수동 토글 (프로그램 자동화 X)
- 강사취소는 토글 없이도 자동 차감됨

## 강사 그룹핑
- **이관 대기 학생 처리**: 학생 마스터 레코드가 아닌 **해당 기간 실제 진행 세션의 강사 다수결**로 그룹핑
- 4월 정산 시 4월에 장리원 강사가 진행한 학생은 5월 박윤정으로 이관 예정이어도 4월 리포트에서는 장리원으로 묶임

## 인라인 편집 (SessionEditModal)
- 수업 행의 ✏️ 아이콘 → 학생의 해당 기간 모든 세션 표시
- **상태 버튼**: 완료/예정/노쇼/당일취소/병결/강사취소/사전취소
- **이월 방향 분리**: `class_sessions.carryover_direction` 컬럼 — `prev`(전월에서 이월: 이번 달 카운트에 포함), `next`(당월 이월: 다음달 결제에서 1회 차감). 두 버튼 토글로 선택, 같은 버튼 재클릭 시 해제. 기존 `is_carryover=true`는 backfill로 모두 `prev` 처리됨.
- **결제대상 수동 오버라이드**: `billable_overrides` 테이블 (student_name + period_start + period_end 유니크). 빈 값으로 저장 시 자동 계산값으로 복원. 오버라이드 적용된 행은 결제대상 셀에 ✎ 표시 + warning 색상.
- 전월 차감 계산은 `carryover_direction = 'next'` 또는 `instructor_cancel`인 전월 세션만 카운트
- 변경 항목만 일괄 저장

## PDF
- A4 가로, 강사별 서브테이블, 실수업/결제대상 컬럼 강조 색상
- 헤더에 "결제대상 = 4회(기본 월결제) - 전월차감(이월+강사취소) · 실수업 = 완료+보강+노쇼" 명시
- 폰트: SpoqaHanSansNeo
