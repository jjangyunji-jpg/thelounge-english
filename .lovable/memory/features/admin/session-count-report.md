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
완료 / 보강 / 노쇼 / 당일 / 병결 / 강사취소 / 사전 / 미체크 / **이월(당월)** / **이월(전월)** / **전월차감** / 예정 / **전체** / **실수업** / **결제대상** / 편집

### 이월 컬럼 분류 규칙
- **이월(당월)** = `carryover_direction = 'next'` 카운트 (이번 달 → 다음 달 이월)
- **이월(전월)** = `carryover_direction = 'prev'` 카운트 (전월 → 이번 달). 진행 여부와 무관하게 카운트
- **전월차감** = 직전 schedule_period의 `next` + `instructor_cancel` 합산 (음수 표시)

## 핵심 카운팅 룰 (2026-04 변경)

### 더블카운트 정책
- **보강 완료**: `ended_at` 있고 isMakeup → **완료 +1, 보강 +1** (둘 다 카운트)
- **이월(전월) 완료**: `direction='prev'` 이고 `ended_at` 있음 → **완료 +1, 이월(전월) +1**
- **이월(전월) 미진행**: `direction='prev'` 이고 미진행 → **이월(전월) +1만**, 완료/실수업/예정/미체크 모두 0
- **노쇼는 cancellation_type 우선** — `direction='prev'` + no_show 면 노쇼 +1, 이월(전월) +1 (완료엔 미카운트)

### 핵심 공식
- **전체 (total)** = `완료 + 노쇼 + 당일 − 이월(전월)`
- **실수업 (actual_lessons)** = `완료` (보강 완료, 이월(전월) 완료가 모두 포함된 값)
- **결제대상 (billable)** = `Math.max(0, 4 − 전월차감)`
  - 전월차감 = 직전 period의 `carryover_direction='next'` + `cancellation_type='instructor_cancel'` 합

### 일치성 검증
- **전체 = 결제대상이 정상**. 다르면 셀에 `⚠` 표시 + warning 색상으로 강조
- 작으면 → 미진행분 남아있음. 크면 → 무료 보너스 수업이 있었음

## 이월(Carryover) 토글
- DB 컬럼: `class_sessions.is_carryover` (boolean), `carryover_direction` (`prev` | `next` | null)
- 강사-학생 협의 결과를 표시하는 수동 토글
- **이월 설정 시 cancellation_type 자동 해제** (`SessionEditModal`에서 처리) — 중복 카운트 방지

## 강사 그룹핑
- **이관 대기 학생 처리**: 학생 마스터 레코드가 아닌 **해당 기간 실제 진행 세션의 강사 다수결**로 그룹핑

## 인라인 편집 (SessionEditModal)
- 수업 행의 ✏️ 아이콘 → 학생의 해당 기간 모든 세션 표시
- **상태 버튼**: 완료/예정/노쇼/당일취소/병결/강사취소/사전취소
- **이월 방향 분리**: `prev`/`next` 토글, 같은 버튼 재클릭 시 해제
- **결제대상 수동 오버라이드**: `billable_overrides` 테이블

## 학생명 옆 링크
- ExternalLink 아이콘 클릭 → 강사 수업노트(`/my/classnote?name=...&sidebar=open`) 새 탭 열림

## PDF
- A4 가로, 강사별 서브테이블, 실수업/결제대상 컬럼 강조 색상
- 폰트: SpoqaHanSansNeo
