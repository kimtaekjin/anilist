# Spring 백엔드 전환

Java 21 / Spring Boot 3.4.0. 기존 Node API 경로와 MongoDB 컬렉션을 유지한다.
운영 트래픽의 연결 대상은 이 저장소 변경만으로 전환되지 않는다.

## 실행

PowerShell에서 환경변수를 설정한 뒤 실행한다. Spring은 `backend/.env`를 자동으로 읽지 않는다.

```powershell
cd backend-spring
$env:MONGO_URI = 'mongodb://127.0.0.1:27017/anilist'
$env:JWT_SECRET = '<32바이트 이상의 기존 JWT 비밀키>'
$env:CLIENT_URL = 'http://localhost:3000'
.\gradlew.bat bootRun --no-daemon
```

프런트는 `REACT_APP_CLIENT_URL=http://localhost:8080`으로 실행한다. 환경변수 변경 후 프런트 재시작/재빌드가 필요하다.
Node와 같은 포트를 쓰므로 로컬에서 동시에 실행할 경우 Spring의 `PORT`를 별도로 지정한다.

## 설정

| 변수 | 기본값 / 의미 |
| --- | --- |
| `MONGO_URI` | 로컬 `anilist`; 운영 시 기존 DB 연결 문자열 |
| `JWT_SECRET` | 필수 인증 설정, 32바이트 이상. 기존 HS256 JWT와 bcrypt 해시 사용 가능 |
| `CLIENT_URL` | `http://localhost:3000`; CORS 허용 출처 및 재설정 링크 |
| `CORS_ORIGINS` | 추가 허용 출처, 쉼표 구분 |
| `NODE_ENV` | `development`; 운영은 `production`으로 지정해야 Secure/SameSite=None 쿠키 적용 |
| `PORT` | 8080 |
| `REDIS_ENABLED` | false; Redis 사용 시 명시적으로 true |
| `REDIS_URL` | `redis://localhost:6379` |
| `MAIL_HOST`, `MAIL_PORT` | smtp.gmail.com, 587 |
| `MAIL_USER`, `MAIL_PASS` | 비밀번호 재설정 메일 발송 설정 |
| `translationAPI` | Google Cloud Translation API 키. Ollama 실패 시 대체 번역에 사용하며, 키가 없으면 원문 유지 |
| `LOCAL_LLM_ENABLED` | false; Ollama 번역 활성화 |
| `OLLAMA_ENDPOINT` | `http://localhost:11434/api/generate` |
| `OLLAMA_MODEL` | `qwen2.5:7b` |
| `OLLAMA_TIMEOUT_MS` | 5000; 요청 제한시간, 최소 1000ms |
| `OLLAMA_FAILURE_COOLDOWN_MS` | 60000; 오류 후 호출 중단 시간, 최소 1000ms |
| `ANIME_DETAIL_PRELOAD_ENABLED` | true; 목록 조회 후 백그라운드 상세 준비 |
| `ANIME_SYNC_ENABLED` | false; true이면 KST 자정 동기화 |
| `ANIME_SYNC_CRON` | `0 0 0 * * *`; 기존 `ANIME_SYNC_INTERVAL_MS` 대신 사용 |
| `ANIME_GENRE_PRECACHE_YEARS_BACK/AHEAD` | 5 / 0 |
| `ANIME_LIST_CACHE_TTL_SECONDS` | 86400 |
| `ANIME_DETAIL_CACHE_TTL_SECONDS` | 86400 |
| `ANIME_GENRE_CACHE_TTL_SECONDS` | 2592000 |
| `MONGO_INITIALIZE_INDEXES` | true; 시작 시 회원/추천 등 기존 인덱스 보장. 읽기 전용 진단은 false |

Node와 Spring을 동시에 실행하지 않는 운영 방식에서는 `worker` 프로필로 Spring 자체 스케줄러를 실행한다.
이 프로필은 웹 포트를 열지 않고 동기화만 수행하며, `ANIME_SYNC_ENABLED` 기본값은 true다.

```powershell
$env:SPRING_PROFILES_ACTIVE = 'worker'
$env:MONGO_URI = '<운영 MongoDB URI>'
$env:REDIS_URL = '<운영 Redis URI>'
$env:REDIS_ENABLED = 'true'
$env:ANIME_SYNC_ENABLED = 'true'
java -jar build/libs/anilist-backend-0.0.1-SNAPSHOT.jar
```

API 서버는 `SPRING_PROFILES_ACTIVE`를 지정하지 않고 실행하며, 기본적으로 스케줄러가 꺼져 있다.
운영에서는 API 프로세스와 worker 프로세스를 각각 한 개씩만 실행한다. `CatalogJobs`는 한 JVM 안에서 동시 실행을 막지만, 여러 worker를 실행하면 중복 수집될 수 있다.

JWT에 있던 관리자/닉네임을 그대로 신뢰하지 않고 매 요청마다 DB의 활성 상태, tokenVersion, 현재 권한을 확인한다.
로그아웃은 Node와 동일하게 쿠키 제거이며, 비밀번호 재설정은 tokenVersion을 증가시켜 이전 토큰을 무효화한다.
BCrypt의 바이트 제한 때문에 신규 비밀번호는 영문/숫자를 포함한 8자 이상, UTF-8 72바이트 이하로 제한한다.
프록시 헤더는 기본적으로 신뢰하지 않는다. 운영 프록시 환경의 실제 클라이언트 IP 전달은 배포 시 검증해야 한다.

회원 탈퇴는 이메일·비밀번호 등 계정 문서를 삭제하고, 기존 게시글·게시판 댓글·애니 댓글의 작성자를
`탈퇴한 사용자`로 익명화한다. 해당 사용자의 애니 댓글 추천 기록은 삭제하고 추천 수를 다시 계산한다.
이 작업은 MongoDB 트랜잭션으로 처리되므로 운영 및 로컬 MongoDB는 replica set이어야 한다.

## API

| 영역 | 경로 |
| --- | --- |
| 상태 | GET `/healthz` |
| 애니 | GET `/service/anime/home`, `/service/anime/detail/{id}`, `/service/anime/{type}` |
| 회원 | POST `/user/signup`, `/user/login`, `/user/logout`, `/user/forgot-password`, `/user/reset-password`; GET `/user/verify-token` |
| 게시판 | GET/POST `/post`; GET/PUT/DELETE `/post/{id}` |
| 게시판 댓글 | GET `/post/{id}/comments`; POST `/post/{id}/comment`; DELETE `/post/{postId}/comment/{commentId}` |
| 애니 댓글 | GET/POST `/anime-comments/{animeId}`; DELETE `/anime-comments/{animeId}/{commentId}` |
| 추천 | PUT/DELETE `/anime-comments/{animeId}/{commentId}/recommend` |

홈은 trending/completed/ova 배열을 반환하고, 완료 목록에서 반환된 인기 작품만 제외한다.
상세 응답에는 trailer/characters를 포함한다. 상세가 없거나 불완전하면 AniList에서 보완하며 외부 장애 시 기존 데이터가 있으면 사용한다.
일반 목록은 DB에서 조회하며 빈 결과가 외부 전체 수집을 자동으로 유발하지 않는다.

Redis 장애 시 DB 조회로 대체한다. 캐시 키는 `spring:anime:v1:*`로 Node 캐시와 분리하고 수집 후 세대 키를 갱신한다.
기존 Node 동기화 작업이 DB를 갱신하면 Spring 캐시를 직접 무효화하지 못하므로 운영 전환 시 스케줄러도 함께 전환한다.
댓글 추천 추가·취소는 추천 문서와 추천 카운터를 하나의 MongoDB 트랜잭션으로 변경한다.
댓글 삭제도 댓글 문서와 연결된 추천 문서를 같은 트랜잭션에서 삭제한다. 따라서 API 서버가 연결하는 MongoDB도 replica set이어야 한다.

## 일회성 작업

먼저 `.\gradlew.bat bootJar`로 빌드한다. 아래 작업은 완료 후 프로세스가 종료된다.

```powershell
java -jar build/libs/anilist-backend-0.0.1-SNAPSHOT.jar --catalog-sync
java -jar build/libs/anilist-backend-0.0.1-SNAPSHOT.jar --catalog-backfill --start=2000 --end=2026
java -jar build/libs/anilist-backend-0.0.1-SNAPSHOT.jar --localize-ko
java -jar build/libs/anilist-backend-0.0.1-SNAPSHOT.jar --localize-ko --apply
java -jar build/libs/anilist-backend-0.0.1-SNAPSHOT.jar --repair-titles
java -jar build/libs/anilist-backend-0.0.1-SNAPSHOT.jar --repair-titles --apply
```

한국어 제목 작업은 `--apply` 없이 애니 제목을 변경하지 않는다. 번역 복구의 미리보기에서도 번역 API 호출/번역 캐시 저장은 발생할 수 있다.
Wikidata의 AniList ID 매칭과 한국어 위키백과 링크를 이용한 기존 신뢰도 규칙을 유지한다.
검증된 `localization.title`은 AniList 재수집으로 덮어쓰지 않는다.
시즌 전체 수집에 실패하면 누락 작품을 비활성화하지 않는다. 전체 수집에는 시즌당 1000페이지 보호 한도가 있다.
일회성 작업과 웹 서버의 스케줄러를 여러 인스턴스에서 중복 실행하지 않도록 배포에서 단일 작업자를 지정한다.

## 검증

```powershell
.\gradlew.bat test bootJar --no-daemon
```

`MigrationIntegrationTest`는 [mongo-java-server](https://github.com/bwaldvogel/mongo-java-server)의 메모리 MongoDB 프로토콜 구현을 사용한다.
HTTP 처리부터 실제 Spring Mongo 변환/쿼리까지 검증하지만 운영 MongoDB의 완전한 대체는 아니다. 외부 API와 메일 발송은 대체한다.

실제 DB의 읽기 전용 점검은 `MONGO_URI`, `ANIME_MONGO_INTEGRATION=true`를 설정한 후 실행한다.
이 테스트는 인덱스 생성, 스케줄러, 외부 상세 보완/번역을 비활성화한다.

브라우저 검증용 독립 서버:

```powershell
.\gradlew.bat migrationPreview --no-daemon
# 다른 터미널에서
cd ../prontend
$env:REACT_APP_CLIENT_URL = 'http://localhost:8081'
$env:BROWSER = 'none'
npm run dev
```

Preview는 포트 8081과 별도 메모리 DB를 사용한다. 외부 API와 메일은 호출하지 않고, 종료하면 작성한 데이터가 사라진다.
Preview 코드는 테스트 소스에 있으므로 배포 JAR에 포함되지 않는다.

## 운영 전환 시 확인할 사항

- 운영 MongoDB 스키마/인덱스와 기존 bcrypt/JWT 호환 확인.
- Redis 접속, 실제 SMTP 발송, AniList/Ollama/Google Translation/Wikidata 연결 검증.
- 운영 HTTPS 출처, 쿠키, CORS와 프록시 IP 처리 검증.
- Spring 배포 후 프런트 API 주소 전환 및 Node 스케줄러 중복 실행 방지.
- 문제 발생 시 프런트 API 주소를 기존 Node 서버로 되돌린다. 기존 Node 코드는 유지되어 있다.

구현 참고: [Spring 비밀번호 저장](https://docs.spring.io/spring-security/reference/features/authentication/password-storage.html),
[Spring MongoDB 원자적 갱신](https://docs.spring.io/spring-data/mongodb/reference/mongodb/template-crud-operations.html).

## Ollama·번역 캐시·동시성 설계

### 처리 순서와 의도

`TranslationService.translate()`는 번역이 필요한 문자열만 처리한다. 같은 JVM에서 동일 번역 요청이 겹치면 `CompletableFuture` 하나를 공유한다. 다른 문자열의 캐시 조회는 외부 번역 호출을 기다리지 않는다.

```text
번역 필요 여부 확인 → 동일 요청 진행 중이면 결과 공유
  → Redis → MongoDB translations
  → Ollama 활성화 시 추론 (단일 동시 호출)
  → 실패 시 Google 캐시 → Google Translation (단일 동시 호출)
  → 둘 다 사용할 수 없으면 원문 반환
```

Ollama는 제목·캐릭터·줄거리별 프롬프트를 사용한다. `/api/generate` 요청의 핵심 옵션은 다음과 같다.

```java
Map.of("model", localLlmModel, "prompt", prompt, "stream", false,
       "options", Map.of("temperature", 0.1, "num_predict", 1024));
```

캐릭터는 의미 번역 대신 음역, 줄거리는 요약 없이 문단을 유지하도록 지시한다. 기본 5초 제한시간은 전체 상세 API의 제한시간이 아니라 개별 Ollama HTTP 요청의 제한시간이다. 모델 로딩이 느리면 늘려야 한다. HTTP 오류·예외 후 기본 60초 동안 추론을 생략한다. 출력 검증 실패만으로는 이 대기 상태에 들어가지 않는다. 1024토큰 상한으로 긴 출력이 잘릴 수 있으며, 현재 검증은 완전한 번역 품질 평가가 아니다.

### Redis와 MongoDB가 공유하는 번역 버전

기존 MongoDB 고유 인덱스 `(provider, originalText, sourceLang, targetLang)`를 유지하면서 버전 충돌을 방지한다. `provider()`에서 공급자·도메인·모델·프롬프트 버전을 하나의 네임스페이스로 구성한다.

```java
String base = local ? "local-llm" : "google";
String revision = local ? TRANSLATION_PROMPT_VERSION + ":" + localLlmModel : "google-v1";
return base + ":" + domain + ":" + UserService.sha256(revision);
```

이 provider를 **MongoDB 조회·저장과 Redis 키에 모두** 사용한다. 따라서 Redis가 비어 있어도 다른 모델의 MongoDB 번역을 재사용하지 않는다. Google은 Ollama 모델과 독립된 버전을 사용한다. 프롬프트 의미를 변경할 때 `TRANSLATION_PROMPT_VERSION`을 올린다.

- Redis 번역 TTL은 기존과 동일하게 1일이다. MongoDB 결과가 있으면 Redis를 다시 채운다.
- 기존 provider의 데이터와 인덱스는 삭제하거나 변경하지 않는다. 이전 버전의 번역은 새 캐시로 자동 승격하지 않으며 첫 요청에서 다시 번역한다. 모델별 문서가 남으므로 저장 공간이 늘 수 있다.
- `translationConfidence`의 0.6/0.5는 정책상 고정값이며 실제 품질 확률이 아니다.
- 이미 한국어로 저장된 `animes` 문서나 기존 상세 응답 캐시를 일괄 재번역하지는 않는다. 모델 변경이 기존 전체 카탈로그의 재번역을 의미하지 않는다.

### 전체 잠금 대신 공급자별 잠금과 동일 요청 공유

```java
CompletableFuture<String> mine = new CompletableFuture<>();
CompletableFuture<String> existing = inFlight.putIfAbsent(identity, mine);
// existing이 있으면 해당 결과를 대기, 소유자만 캐시 조회·추론·저장
// finally에서 inFlight.remove(identity, mine)
```

`translate()`와 캐릭터 목록 전체의 `synchronized`를 제거했다. Ollama 호출은 `ollamaLock`, Google 호출·요청 간격·cooldown은 `googleLock`으로 각각 보호한다. 추론 동시 호출 수는 공급자당 1개를 유지해 갑작스러운 GPU/CPU 부하 증가를 피한다. Ollama 장애 시각은 `volatile`로 공유한다.

중복 요청 대기는 `OLLAMA_TIMEOUT_MS + 35000ms`로 제한하며, 시간 초과·실패 시 원문을 반환한다. 인터럽트는 보존한다. 대기 요청이 시간 초과해도 원래 작업을 취소하거나 진행 중 등록을 제거하지 않으므로 중복 추론을 새로 시작하지 않는다. 공급자 잠금 대기와 여러 텍스트 번역 때문에 전체 상세 요청 시간은 개별 HTTP 제한시간보다 길 수 있다.

이 제어는 **JVM 내부**에서만 유효하다. 여러 API/worker 인스턴스 전체의 호출 수 제한이나 분산 잠금은 제공하지 않는다. 사용자 요청의 우선순위도 별도로 보장하지 않는다.

### 상세 미리 불러오기의 중복 제거와 부하 제한

`AnimeReadService`는 홈·목록 조회 후 상세를 준비하되 다음 제한을 적용한다.

```java
new ThreadPoolExecutor(2, 2, 0L, TimeUnit.MILLISECONDS,
        new ArrayBlockingQueue<>(100), threadFactory,
        new ThreadPoolExecutor.AbortPolicy());
```

- 홈의 trending/completed/ova와 각 목록에서 작품 ID를 중복 제거한다.
- `pendingDetails.add(id)`에 성공한 요청만 제출한다. 같은 ID가 대기·실행 중이면 추가 제출하지 않는다.
- 스레드 2개와 대기열 100개로 실행 중·대기 작업을 제한한다.
- 포화 시 예외를 잡고 해당 준비 작업을 건너뛴다. `CallerRunsPolicy`를 사용하지 않아 홈 요청 스레드에서 상세 번역을 실행하지 않는다.
- 성공·실패·제출 거부 시 pending 등록을 해제한다. 이후 목록 요청에서 다시 시도할 수 있다.
- Spring 종료 시 `@PreDestroy`에서 실행기를 종료한다.

미리 준비되지 않은 작품도 실제 상세 API 요청으로 조회할 수 있다. 부하가 높을 때는 첫 상세 응답이 더 느릴 수 있다. `ANIME_DETAIL_PRELOAD_ENABLED=false`로 미리 불러오기를 끌 수 있다. 상세 캐시의 기존 TTL·세대 키·완전히 현지화된 결과만 저장하는 조건은 유지한다.

### 검증 명령

```bash
./gradlew test --tests '*TranslationConcurrencyTest' --tests '*AnimePrewarmTest' bootJar --no-daemon
./gradlew test --no-daemon
```

회귀 테스트는 모델별 MongoDB 캐시 분리, 추론 중 별도 캐시 요청 처리, 중복 추론 억제, Ollama 장애 대기, 반복 홈 요청의 상세 작업 중복 제거와 대기열 상한을 확인한다. 실제 Ollama 모델 추론 성능·운영 MongoDB/Redis의 부하 측정은 별도 검증이 필요하다.

이번 변경 검증 결과: 추가 회귀 테스트 4개 통과, `bootJar` 생성 성공. 전체 테스트는 총 44개 중 41개 통과·2개 실패·1개 건너뜀이다. 실패는 기존 `MigrationIntegrationTest`의 `animeRecommendationIsIdempotentAndScopedToAnime`, `postOwnershipCommentsAndPagination`이며, 메모리 MongoDB가 ClientSession/트랜잭션을 지원하지 않아 발생한다. 운영 MongoDB 읽기 테스트는 연결 설정이 없어 건너뛰었다. 실제 Ollama 서버를 통한 추론과 부하 측정은 이번 검증에 포함하지 않았다.
