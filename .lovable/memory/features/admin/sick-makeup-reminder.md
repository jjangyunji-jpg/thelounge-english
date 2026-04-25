---
name: Sick Makeup Reminder
description: 매월 15일·22일 09:00 KST에 병결 보강 미신청 학생/강사에게 자동으로 공지 팝업 발송
type: feature
---

# 병결 보강 신청 자동 리마인더

## 트리거
- pg_cron `sick-makeup-reminder` (`0 0 15,22 * *` UTC = 매월 15일·22일 09:00 KST)
- Edge Function: `supabase/functions/send-sick-makeup-reminder/index.ts`

## 로직
1. 이번 달(KST) `class_sessions` 중 `cancellation_type='sick' AND cancellation_resolution='makeup'` 조회
2. 각 세션에 대한 `makeup_requests` (status='pending'|'approved') 존재 여부 확인
3. **미신청 세션만** 추려서 (학생, 강사) 페어로 그룹핑 (한 학생 여러 병결 → 한 알림에 합쳐서 표시)
4. `admin_notifications`에 `target='all'` + `subject='[N월] 병결 보강신청 안내 (cycleKey)'` 형식으로 일괄 insert
5. 본문 첫 줄 `[[KEY:학생|강사]]` 마커로 같은 사이클 중복 발송 방지

## 발송 대상
- `target='all'` (학생·강사·어드민 모두 메시지함에 노출). 본문에 학생명/강사명을 명시해 본인이 자신의 건임을 인지

## 메시지 본문 예시
```
**김춘호** 수강생 / **장리원** 강사

4월 중 병결로 결석한 수업(4/3)에 대한 보강 신청이 아직 접수되지 않았습니다.
병결로 인한 결석은 보강이 가능하지만, 다음 달로 이월되지 않습니다.
반드시 4월 안에 보강 신청을 완료해 주세요.

⚠️ 4월 마지막 주에 발생한 병결의 경우 다음 달 첫 주까지만 보강이 허용됩니다.
```

## 예외 처리 정책
- `cancellation_resolution='refund'` 병결은 알림 대상에서 제외 (환불 확정)
- 병결 → 보강신청 완료 → 보강 진행 시: 원본 세션은 `cancellation_type='sick'` 유지, 새 세션이 `actual_lessons`로 카운트됨 (이중 표시이지만 결제대상 4회에서 차감되지 않음)
