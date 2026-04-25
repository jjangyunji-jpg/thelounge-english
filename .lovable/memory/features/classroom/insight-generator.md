---
name: Insight Generator
description: 클래스룸 헤더 'Insight' 버튼 — 학생 전문 분야(여러개 쉼표 구분 가능, 매번 1개 랜덤 선택) + 관심 주제 + CEFR 레벨 + 시간을 입력하면 그 분야의 SPECIFIC한 개념/기술/최신 이슈 1가지를 골라 전문가 스타일의 Concept(6-9문장) + Key Vocabulary 8개 + Discussion Questions 5개 HTML로 생성. 학생별 입력 기억(localStorage), temperature 0.95로 매번 다른 토픽.
type: feature
---

## 위치
- 클래스룸 노트 헤더, News Talk 버튼 옆 (보라색 outline 버튼)
- 컴포넌트: `src/components/classroom/InsightGeneratorModal.tsx`
- 백엔드: `supabase/functions/generate-insight/index.ts` (Lovable AI gemini-2.5-flash, temperature 0.95)

## 입력
- 전문 분야 / 직무 (필수, 최대 300자) — **쉼표/슬래시/세미콜론/" and "로 여러 분야 입력 가능. 백엔드에서 매 요청마다 1개를 랜덤 선택** (예: "AI technology, bond investing, ESG")
- 관심 주제 (선택, 최대 500자)
- CEFR 레벨 (A1~C2, 기본 세션 레벨)
- 수업 시간 (30/40/50/60분, 기본 40)

## 출력 정책 (Professional / Specific)
- 일반론 금지 ("AI는 빠르게 성장하는 분야..." 같은 개론 X)
- 분야 안의 **구체적이고 명명된 토픽 1개**를 골라 Economist/MIT Tech Review/HBR 스타일 explainer로 작성
  - 예: AI → "What an LLM actually is", "RAG", "Mixture-of-Experts", 최근 모델 출시
  - 예: Bond manager → "Duration risk in rising rates", "yield curve inversion"
- 가능하면 최근(2024-2025) 이슈/기술/트렌드 반영
- 매번 각도 변경: 핵심 개념 / 최근 사건 / 논쟁 / 도구·기법 / 케이스 스터디 등 로테이션
- 실제 회사명·프레임워크명·숫자·인물 등 구체적 디테일 포함

## 출력 HTML 섹션
1. 보라색 헤더 박스: 토픽 제목 + 시간 + Field 라벨
2. `💡 Concept` — 6-9문장 영어 단락 (전문 용어 보존하면서 inline 정의)
3. `📚 Key Vocabulary` — 8행 표 (선택된 토픽에 특화된 단어, 일반 분야 단어 X)
4. `💬 Discussion Questions` — 5개 ol 리스트, opinion/analysis 유형 (yes/no 금지)

## 기억 정책
`localStorage` 키: `insight_generator_last_input::<studentName>` — News Talk와 동일한 학생별 캐시 패턴.
