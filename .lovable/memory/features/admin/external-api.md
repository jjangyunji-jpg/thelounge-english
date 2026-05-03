---
name: External Public API
description: 외부 앱이 학생 본인 데이터를 읽을 수 있는 공개 REST API. API Key(SHA-256 해시 저장) 인증, 학생당 다중 키 발급, 어드민 사이드바 "외부 API 키" 탭에서 발급/폐기.
type: feature
---

## 인증
- 헤더 `x-api-key: tle_<base64url>` (32바이트 랜덤). 평문 키는 발급 직후 1회만 표시, DB엔 SHA-256 해시(`key_hash`)와 식별용 prefix 12자(`key_prefix`)만 저장.
- 키는 학생 1명에 귀속. 폐기 시 `active=false`, `revoked_at` 세팅.

## Endpoints (verify_jwt=false, edge function `public-api`)
- `GET /functions/v1/public-api/me` → instructor_students의 본인 행 (이름/레벨/강사/스케줄/목표)
- `GET /functions/v1/public-api/sessions?limit=50` → class_sessions 본인 세션 (최신순, 최대 200)

## 키 발급/관리
- Edge function `issue-api-key` (manager 이상만 호출 가능, JWT 검증). 평문 키 1회 반환.
- 어드민 UI: `src/components/admin/ApiKeysManagement.tsx` — 시스템 그룹 사이드바 "외부 API 키" 탭.

## RLS (`api_keys` 테이블)
- 매니저 이상: 전체 관리
- 학생 본인: 자신 키의 메타데이터(label/prefix/상태)만 SELECT — `key_hash`는 DB select로 학생이 볼 수 있으므로 UI에선 노출 X.

## Rate limit
- 현재 미구현. 백엔드 rate limit primitive 없음 — 요청 시 ad-hoc로만.
