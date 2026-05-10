---
name: Level Tests
description: 레벨별(A1 등) 객관식 자동 채점 테스트. 강사 수동 활성화, 80% 합격, 무제한 재응시
type: feature
---

# Level Tests

- 테이블: `level_tests`(정의), `level_test_questions`(문제 풀), `level_test_activations`(학생별 활성화), `level_test_attempts`(응시 이력)
- A1 시드 1건 자동 생성. 6개 시제 균형(현재/현재진행/미래/과거/현재완료 경험·계속), 작문·실사용 중심
- 문제 생성: edge function `generate-level-test` (gemini-2.5-flash + Tool Calling). 풀 재사용 → 응시당 토큰 0
- 객관식 채점은 클라이언트 즉시. 합격 시 `passed_at` 기록, 미합격 시 무제한 재응시
- 어드민: `자료 관리 > 레벨 테스트`에서 풀 관리·AI 생성·응시 이력
- 강사 클래스룸 우측 패널: 활성화/비활성화, 학생별 응시 결과 펼쳐 보기
- 학생 클래스룸: 활성화된 시험 카드에서 응시 (홈워크 패널 아래)
