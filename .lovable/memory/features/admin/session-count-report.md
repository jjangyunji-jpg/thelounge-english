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

## 컬럼 구성
완료 / 보강완료 / 노쇼 / 당일 / 병결 / 강사취소 / 사전 / **이월(당월)** / **이월(전월)** / 예정 / 전체 / **결제대상**

## 핵심 개념: 이월(Carryover)
- DB 컬럼: `class_sessions.is_carryover` (boolean, default false)
- **취소 카테고리와 독립적인 플래그** — 어떤 cancellation_type이든 ON 가능
- 강사-학생 협의 결과를 표시하는 수동 토글 (프로그램 자동화 X)
- **다음 달 결제 1회 차감** 효과

## 결제대상 산출 공식
```
결제대상 = (완료 + 보강완료 + 노쇼) - 전월 이월 횟수
```
- 정산(settlement) 로직과 일치: 노쇼는 결제 포함, 사전/당일/병결/강사취소는 결제 제외
- 전월 이월 횟수는 직전 schedule_period(또는 직전 캘린더월)에서 `is_carryover=true`인 세션 수
- 음수 방지: `Math.max(0, ...)`

## 강사 그룹핑
- **이관 대기 학생 처리**: 학생 마스터 레코드가 아닌 **해당 기간 실제 진행 세션의 강사 다수결**로 그룹핑
- 4월 정산 시 4월에 장리원 강사가 진행한 학생은 5월 박윤정으로 이관 예정이어도 4월 리포트에서는 장리원으로 묶임

## 인라인 편집 (SessionEditModal)
- 수업 행의 ✏️ 아이콘 → 학생의 해당 기간 모든 세션 표시
- **상태 버튼**: 완료/예정/노쇼/당일취소/병결/강사취소/사전취소
- **이월 토글**: 별도 버튼 (ON/OFF) — 상태 변경과 독립
- 변경 항목만 일괄 저장

## PDF
- A4 가로, 강사별 서브테이블, 이월/결제대상 컬럼 강조 색상
- 헤더에 결제대상 공식 명시
- 폰트: SpoqaHanSansNeo
