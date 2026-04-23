---
name: Homework Listen Button
description: 읽기/외우기 숙제 모달 헤더의 듣기 버튼은 ElevenLabs(Sarah) TTS를 사용하며 homework-tts 엣지 함수가 텍스트 해시 기반으로 Storage에 mp3를 캐싱한다. cleanup-homework-tts cron이 6개월 이상 미사용 캐시를 매월 자동 정리한다.
type: feature
---

읽기(`reading`)/외우기(`memorizing`) 숙제 제출 모달(`HomeworkSubmitModal`) 헤더 X 버튼 옆에 '듣기' 토글 버튼을 둔다.

- TTS 엔진: ElevenLabs `eleven_multilingual_v2`, 보이스 Sarah(`EXAVITQu4vr4xnSDxMaL`).
- 엣지 함수: `supabase/functions/homework-tts` — JWT 인증 필수, 입력 텍스트를 strip+normalize 후 FNV-1a 해시로 캐시 키 생성.
- 캐시 저장소: `homework-tts` 공개 Storage 버킷, 경로 `descriptions/<hash>.mp3`. 같은 description은 두 번째 호출부터 ElevenLabs 호출 없이 바로 public URL 반환.
- 클라이언트: `supabase.functions.invoke("homework-tts", { body: { text } })` → `audio_url`로 `new Audio(url).play()`. 컴포넌트 마운트 동안 한 번 받아오면 ref에 캐시.
- UI 상태: `loadingTts`(생성중) / `speaking`(중지 버튼) / 기본(듣기). 모달 닫힘/언마운트 시 재생 중단.
- 비용 관리: description 텍스트는 4000자로 잘라 ElevenLabs 호출. 같은 숙제는 1회만 과금.
- 캐시 정리: `cleanup-homework-tts` 엣지 함수가 매월 1일 KST 03:00(pg_cron `cleanup-homework-tts-monthly`)에 실행되어 `homework-tts/descriptions/` 안의 180일(6개월) 이상 된 mp3를 일괄 삭제. 삭제된 파일은 다시 호출 시 자동 재생성되므로 안전함.
