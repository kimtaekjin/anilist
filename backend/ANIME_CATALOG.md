# 애니메이션 분기 카탈로그 운영

## 목적

장르/분기 화면의 사용자 요청에서는 AniList API와 번역 API를 호출하지 않습니다.

요청 흐름은 다음과 같습니다.

```text
브라우저 → Redis → MongoDB → 브라우저
```

Redis에 캐시가 없거나 Redis가 중단되어도 MongoDB에서 바로 조회합니다. AniList 수집과 번역은 별도 작업에서만 수행합니다.

## 최초 전체 적재

기본 범위는 2000년부터 실행 시점의 현재 연도까지입니다.

```bash
cd backend
npm run backfill:anime
```

범위를 직접 지정할 수도 있습니다.

```bash
npm run backfill:anime -- --start=2000 --end=2026
```

작업은 각 연도의 `WINTER`, `SPRING`, `SUMMER`, `FALL`을 순서대로 처리하며, 각 분기의 마지막 API 페이지까지 모두 읽습니다. 작품은 MongoDB에 upsert되므로 작업이 중단되면 같은 명령을 다시 실행해도 됩니다. 이미 최신인 작품은 제목 번역과 전체 DB 갱신을 생략합니다.

각 분기가 완료될 때마다 해당 Redis 캐시를 새 데이터로 교체합니다. Redis가 연결되지 않아도 MongoDB 적재는 계속됩니다.

## 반복 갱신

```bash
cd backend
npm run sync:anime
```

`ANIME_SYNC_ENABLED=true`이면 백엔드 서버가 한국시간 자정에 반복 동기화를 시작합니다. 기본적으로 최근 연도 범위를 다시 확인하고, `updatedAt`, 점수, 인기도, 방영 상태와 회차가 달라진 작품만 갱신합니다.

오래된 과거 작품의 수정 사항까지 다시 확인하려면 전체 적재 명령을 월 1회 정도 재실행할 수 있습니다. upsert와 변경 비교를 사용하므로 바뀌지 않은 작품의 전체 DB 갱신과 재번역은 생략됩니다.

## 관련 환경변수

```env
ANIME_CATALOG_START_YEAR=2000
ANIME_GENRE_CACHE_TTL_SECONDS=2592000
ANILIST_MIN_REQUEST_INTERVAL_MS=2200
ANILIST_REQUEST_TIMEOUT_MS=15000
ANILIST_MAX_RETRIES=5
```

- 분기 캐시는 기본 30일 보관합니다.
- AniList 호출은 기본 2.2초 간격으로 제한합니다.
- 여러 Node 프로세스가 실행되면 Redis의 공유 호출 슬롯으로 호출 간격을 함께 제한합니다.
- `429`, `5xx`, 네트워크 오류는 응답 헤더와 지수 백오프에 따라 재시도합니다.

## 수집 범위

분기 목록 화면에서 사용하는 제목, 이미지, 장르, 제작사, 연도, 분기, 상태, 점수, 인기도와 방영 회차를 수집합니다.

등장인물 전체, 리뷰, 추천과 같은 대용량 상세 연결 데이터는 모든 작품에 대해 일괄 수집하지 않습니다. 상세 화면 데이터는 기존 상세 조회 정책을 따릅니다. 이는 초기 작업 시간과 외부 API 부담을 줄이고 AniList API 사용 범위를 실제 화면에 필요한 정보로 제한하기 위한 것입니다.
