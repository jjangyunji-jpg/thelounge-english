---
name: Insight Generator
description: 클래스룸 헤더의 'Insight' 버튼 — 학생 직업/직무 + 관심 주제 + CEFR 레벨 + 수업 시간을 입력하면 Concept(1문단) + Key Vocabulary(8개) + Discussion Questions(5개)를 HTML로 생성해 노트 에디터에 삽입. 학생별 입력 기억(localStorage).
type: feature
---

## 위치
- 클래스룸 노트 헤더, News Talk 버튼 옆 (보라색 outline 버튼)
- 컴포넌트: `src/components/classroom/InsightGeneratorModal.tsx`
- 백엔드: `supabase/functions/generate-insight/index.ts` (Lovable AI gemini-2.5-flash)

## 입력
- 직업/직무 (필수, 최대 300자) — 예: "Bond manager at investment bank"
- 관심 주제 (선택, 최대 500자) — 예: "ESG investing"
- CEFR 레벨 (A1~C2, 기본 세션 레벨)
- 수업 시간 (30/40/50/60분, 기본 40)

## 출력 HTML 섹션
1. 보라색 헤더 박스 (Insight 제목 + 시간)
2. `💡 Concept` — 1문단 (5-7문장) 영어 설명 + 구체 예시
3. `📚 Key Vocabulary` — 8행 표 (No / Term / Meaning / 한국어 뜻)
4. `💬 Discussion Questions` — 5개 ol 리스트 (파란 링크색)

## 기억 정책
`localStorage` 키: `insight_generator_last_input::<studentName>` — News Talk와 동일한 학생별 캐시 패턴.
