# AI 코드 변경 기록

이 문서는 AI가 이 저장소에서 수행한 코드 변경을 사용자가 구조적으로 이해할 수 있도록 기록한다.
각 작업은 실제 변경 파일, 변경 목적, 처리 흐름, 설계 이유, 기존 코드와의 대응 관계 및 검증 결과를 포함한다.

---

## 2026-09-13 — Spring Boot 백엔드 기본 구조 생성

### 1. 작업 목적

기존 Node.js/Express 백엔드는 유지하면서 Spring 백엔드 구조를 단계적으로 학습할 수 있도록
독립된 `backend-spring` 애플리케이션을 생성했다. 첫 기능으로 서버 상태 확인 API인
`GET /healthz`를 구현했다.

### 2. 생성한 파일

| 파일 | 역할 |
| --- | --- |
| `backend-spring/settings.gradle` | Gradle 프로젝트 이름 정의 |
| `backend-spring/build.gradle` | Java, Spring Boot, 테스트 의존성과 빌드 설정 정의 |
| `backend-spring/gradlew`, `gradlew.bat` | Gradle 설치 없이 동일한 버전으로 빌드하기 위한 실행 파일 |
| `backend-spring/gradle/wrapper/*` | Gradle Wrapper 버전과 실행에 필요한 파일 |
| `backend-spring/.gitignore` | 빌드 결과물과 IDE별 파일을 Git 기록에서 제외 |
| `AnilistApplication.java` | Spring Boot 애플리케이션 시작점 |
| `HealthController.java` | `/healthz` HTTP 요청 처리 |
| `application.yml` | 애플리케이션 이름과 서버 포트 설정 |
| `HealthControllerTest.java` | 상태 확인 API의 응답을 검증하는 웹 계층 테스트 |

### 3. 요청 처리 흐름

```text
GET /healthz
    ↓
Spring MVC가 @GetMapping("/healthz") 탐색
    ↓
HealthController.health()
    ↓
ResponseEntity.ok("OK")
    ↓
HTTP 200 / 응답 본문 "OK"
```

### 4. 핵심 코드와 의미

```java
@SpringBootApplication
public class AnilistApplication {
    public static void main(String[] args) {
        SpringApplication.run(AnilistApplication.class, args);
    }
}
```

- `@SpringBootApplication`은 Spring 설정, 자동 설정, 컴포넌트 탐색을 활성화한다.
- 이 클래스가 최상위 패키지인 `com.anilist.server`에 있으므로 하위 패키지의 Controller 등을 자동으로 찾는다.

```java
@RestController
public class HealthController {
    @GetMapping("/healthz")
    public ResponseEntity<String> health() {
        return ResponseEntity.ok("OK");
    }
}
```

- `@RestController`는 반환값을 HTTP 응답 본문으로 전달하는 웹 계층 컴포넌트다.
- `@GetMapping`은 GET 요청 경로와 Java 메서드를 연결한다.
- `ResponseEntity`로 상태 코드와 응답 본문을 명시했다.

### 5. 기존 Node.js 코드와의 대응

기존 `backend/index.js`:

```js
app.get("/healthz", (req, res) => res.send("OK"));
```

새 Spring 코드:

```java
@GetMapping("/healthz")
public ResponseEntity<String> health() {
    return ResponseEntity.ok("OK");
}
```

Express에서는 애플리케이션 시작 파일에 라우트를 직접 등록했다. Spring에서는 HTTP 요청을 담당하는
Controller 클래스로 분리하고, 애너테이션으로 경로를 연결한다.

### 6. 설정 구조

```yaml
server:
  port: ${PORT:8080}
```

`PORT` 환경변수가 있으면 해당 값을 사용하고, 없으면 `8080`을 사용한다. 이는 기존 Node 서버의
`process.env.PORT || 8080`과 같은 의미다.

### 7. 테스트가 확인하는 동작

`@WebMvcTest(HealthController.class)`를 사용해 전체 데이터베이스 등을 실행하지 않고 웹 계층만 불러왔다.
MockMvc 요청으로 다음 두 조건을 확인했다.

1. `GET /healthz`의 상태 코드가 `200`인지 확인
2. 응답 본문이 정확히 `OK`인지 확인

### 8. 검증 결과

```text
명령: backend-spring/gradlew.bat test --no-daemon
결과: BUILD SUCCESSFUL
테스트: 1개 통과
```

### 9. 영향 범위

- 기존 `backend` Node.js 코드는 변경하지 않았다.
- 기존 React 프런트엔드는 변경하지 않았다.
- MongoDB, Redis, JWT는 아직 Spring 애플리케이션에 연결하지 않았다.
- 현재 Spring 애플리케이션이 제공하는 기능은 `/healthz` 하나뿐이다.

### 10. 다음 학습 단계

애니 조회 기능을 대상으로 `Controller → Service → Repository` 계층을 추가하면 Spring의 핵심 백엔드 구조를
학습할 수 있다. 이때 기존 MongoDB의 `anime` 모델과 실제 저장 데이터 구조를 먼저 비교해야 한다.

---

## 2026-09-13 — 애니 상세 조회 계층 구현

### 1. 작업 목적

기존 Node.js가 MongoDB에서 조회하던 애니 데이터를 Spring의 계층형 구조로 읽는 첫 기능을 구현했다.
기존 프런트엔드를 나중에 그대로 연결할 수 있도록 요청 경로 `/service/anime/detail/{id}`와 응답의 `_id` 필드를 유지했다.

### 2. 이번 단계에서 학습하는 Spring 개념

- Controller, Service, Repository의 책임 분리
- 생성자를 이용한 의존성 주입
- Spring Data MongoDB의 `MongoRepository`
- MongoDB 문서와 HTTP 응답 DTO 분리
- `@RestControllerAdvice`를 이용한 공통 예외 처리
- Controller 단위 테스트와 Service 단위 테스트

### 3. 생성·변경 파일

| 파일 | 역할 |
| --- | --- |
| `build.gradle` | Spring Data MongoDB 의존성 추가 |
| `application.yml` | `MONGO_URI` 환경변수와 기본 MongoDB 주소 설정 |
| `anime/domain/AnimeDocument.java` | 기존 `animes` 컬렉션 문서 구조 표현 |
| `anime/repository/AnimeRepository.java` | MongoDB 조회 담당 |
| `anime/service/AnimeService.java` | 조회 흐름과 문서→DTO 변환 담당 |
| `anime/controller/AnimeController.java` | 상세 조회 HTTP 요청과 응답 담당 |
| `anime/dto/AnimeDetailResponse.java` | 외부로 반환할 응답 형식 정의 |
| `anime/exception/AnimeNotFoundException.java` | 애니가 없을 때 발생시키는 도메인 예외 |
| `global/exception/ErrorResponse.java` | 공통 오류 응답 형식 정의 |
| `global/exception/GlobalExceptionHandler.java` | 예외를 HTTP 상태와 응답으로 변환 |
| `AnimeControllerTest.java` | 정상 응답과 404 오류 응답 검증 |
| `AnimeServiceTest.java` | Repository 결과 변환과 미존재 예외 검증 |

### 4. 정상 요청 처리 흐름

```text
GET /service/anime/detail/1
    ↓
AnimeController.findDetail(1)
    ↓
AnimeService.findDetail(1)
    ↓
AnimeRepository.findById(1)
    ↓
MongoDB의 animes 컬렉션
    ↓
AnimeDocument
    ↓
AnimeDetailResponse.from(document)
    ↓
HTTP 200 + JSON 응답
```

Controller는 HTTP 처리만 담당하고, Repository를 직접 호출하지 않는다. 이 덕분에 HTTP 계층과 데이터 접근 계층 사이에
Service가 비즈니스 규칙을 추가할 수 있는 자리가 생긴다.

### 5. 데이터가 없을 때의 흐름

```text
AnimeRepository.findById(id) → Optional.empty()
    ↓
AnimeService가 AnimeNotFoundException 발생
    ↓
GlobalExceptionHandler가 예외 처리
    ↓
HTTP 404
{
  "status": 404,
  "code": "ANIME_NOT_FOUND",
  "message": "애니를 찾을 수 없습니다. id=999",
  "timestamp": "..."
}
```

기존 Node 상세 API는 모든 오류를 `500`으로 반환했다. 이번 Spring 구현에서는 데이터가 없는 정상적인 실패 상황을
서버 장애와 구분하기 위해 `404 Not Found`로 표현했다.

### 6. 생성자 주입

```java
public AnimeController(AnimeService animeService) {
    this.animeService = animeService;
}
```

Spring이 생성해 둔 `AnimeService` 객체를 Controller 생성자에 전달한다. Controller가 필요한 의존성을 명시적으로
보여주며, 테스트에서는 가짜 Service로 교체할 수 있다. `AnimeService`도 같은 방법으로 `AnimeRepository`를 주입받는다.

### 7. 기존 Node.js 코드와의 대응

| Node.js/Express | Spring Boot |
| --- | --- |
| `router.get("/anime/detail/:id")` | `@GetMapping("/detail/{id}")` |
| `req.params.id` | `@PathVariable Integer id` |
| `Anime.findOne(...)` | `AnimeRepository.findById(...)` |
| 라우트 내부 데이터 처리 | `AnimeService.findDetail(...)` |
| Mongoose schema | `@Document AnimeDocument` |
| `res.status(200).json(...)` | `ResponseEntity.ok(...)` |
| 라우트의 `try/catch` | `@RestControllerAdvice` |

### 8. MongoDB 연결 설정

```yaml
spring:
  data:
    mongodb:
      uri: ${MONGO_URI:mongodb://127.0.0.1:27017/anilist}
```

- 실행 환경에 `MONGO_URI`가 있으면 해당 값을 사용한다.
- 환경변수가 없으면 로컬 `anilist` 데이터베이스에 연결한다.
- Mongoose의 `Anime` 모델이 사용하는 기존 `animes` 컬렉션을 `@Document(collection = "animes")`로 명시했다.

### 9. DTO를 분리한 이유

`AnimeDocument`는 MongoDB 저장 구조이고 `AnimeDetailResponse`는 API 계약이다. 두 객체를 분리하면 DB 필드가 추가되더라도
모든 내부 데이터를 사용자에게 노출하지 않을 수 있고, API 응답 이름을 독립적으로 유지할 수 있다. Java 필드 `id`는
`@JsonProperty("_id")`를 사용해 기존 프런트엔드가 기대하는 `_id`로 반환한다.

### 10. 현재 구현 범위와 남은 작업

- 기존 MongoDB에 이미 저장된 애니 상세 정보만 조회한다.
- 데이터가 없을 때 AniList API에서 가져오는 기능은 아직 이전하지 않았다.
- 번역, Redis 상세 캐시, 데이터 갱신 기능은 아직 이전하지 않았다.
- 실제 MongoDB를 연결하는 통합 테스트는 아직 추가하지 않았다.

### 11. 검증 결과

```text
명령: backend-spring/gradlew.bat test --no-daemon
결과: BUILD SUCCESSFUL
전체 테스트: 5개 통과
```

검증한 조건:

1. `/healthz`가 `200 OK` 반환
2. 애니 상세 조회가 `_id`, 제목, 원제의 `native` 필드를 기존 응답 이름으로 반환
3. 애니 미존재 시 `404`와 `ANIME_NOT_FOUND` 반환
4. Service가 Mongo 문서를 응답 DTO로 변환
5. Service가 데이터 미존재 시 도메인 예외 발생

---

## 2026-09-13 — 애니 목록 조회 계층 구현

### 1. 작업 목적

기존 Express의 `/service/anime/:type` 목록 API를 Spring 계층 구조로 이전했다. 프런트엔드 요청 경로와 주요
쿼리 파라미터를 유지하면서 HTTP 입력 처리, 목록 규칙, MongoDB 조회 책임을 서로 다른 계층에 배치했다.

### 2. 요청 처리 흐름

```text
GET /service/anime/trending?limit=10&exclude=1,2
    ↓
AnimeController: 경로와 쿼리 파라미터 수신
    ↓
AnimeService: 타입 및 limit 검증, 제외 ID와 제한 적용
    ↓
AnimeRepository: contentTypes 조건과 정렬로 MongoDB 조회
    ↓
AnimeDocument → AnimeListResponse 변환
    ↓
HTTP 200 + JSON 배열
```

### 3. 계층별 책임

- Controller는 `type`, `season`, `year`, `limit`, `exclude`를 받고 `exclude=1,2`를 숫자 집합으로 변환한다.
- Service는 타입, limit, 시즌과 연도를 검증하고 정렬, 제외 ID, 반환 개수, DTO 변환을 처리한다.
- Repository는 `contentTypes` 또는 시즌 조건을 이용한 MongoDB 조회를 담당한다.

### 4. 추가한 주요 타입

| 타입 | 역할 |
| --- | --- |
| `AnimeListType` | 지원하는 목록 타입을 문자열 대신 제한된 enum으로 표현 |
| `AnimeListResponse` | 목록 화면에 반환할 데이터 형식 정의 |
| `InvalidAnimeQueryException` | 잘못된 목록 요청을 나타내는 예외 |

`AnimeDocument`에는 실제 MongoDB 필터에 필요한 `contentTypes`와 `isCatalogActive` 필드를 추가했다.

### 5. 정렬 규칙

```text
completed → averageScore 내림차순 → popularity 내림차순
그 외      → popularity 내림차순 → averageScore 내림차순
```

### 6. genre 목록 규칙

- 시즌은 `WINTER`, `SPRING`, `SUMMER`, `FALL`만 허용한다.
- 연도는 2000년부터 현재 한국 시간 기준 연도까지만 허용한다.
- 값이 없으면 한국 시간 기준 현재 시즌과 연도를 사용한다.
- `isCatalogActive`가 명시적으로 `false`인 문서는 제외한다.

### 7. 잘못된 요청 흐름

```text
GET /service/anime/unknown
    ↓
AnimeListType.from("unknown") 실패
    ↓
InvalidAnimeQueryException
    ↓
GlobalExceptionHandler
    ↓
HTTP 400 / code: INVALID_ANIME_QUERY
```

### 8. 기존 Node.js 코드와의 대응

| Node.js/Express | Spring Boot |
| --- | --- |
| `SUPPORTED_LIST_TYPES` | `AnimeListType` enum |
| `normalizeListQuery()` | `AnimeService.findGenreList()` |
| `getListSort()` | `AnimeService.sortFor()` |
| `getExcludedAnimeIds()` | `AnimeController.parseExcludedIds()` |
| `Anime.find(dbFilter).sort(sort)` | `AnimeRepository`의 `@Query` 메서드 |
| `limitAnimeList()` | Service의 Stream `limit()` |

### 9. 현재 범위

- `trending`, `completed`, `upcoming`, `ova`, `airing`, `genre` 목록을 지원한다.
- 기존 오타인 `upcomming` 요청도 `upcoming`으로 정규화한다.
- Redis 캐시와 `/service/anime/home` 통합 응답은 아직 이전하지 않았다.
- 목록 데이터가 없을 때 AniList에서 새로 수집하는 기능은 아직 이전하지 않았다.

### 10. 검증 결과

```text
명령: backend-spring/gradlew.bat test --no-daemon
결과: BUILD SUCCESSFUL
전체 테스트: 9개 통과
```

추가로 목록 정상 응답, 잘못된 타입의 400 응답, 제외 ID 처리, limit 적용을 검증했다.

---

## 2026-09-16 — Spring 홈 통합 API 구현

### 변경 내용

- `GET /service/anime/home`과 `AnimeHomeResponse`를 추가했다.
- 기존 프런트 `fetchHomeAnime`가 사용하는 `trending`, `completed`, `ova` 배열 및 목록 DTO의 `_id` 형식을 유지했다.
- Service에서 기존 목록 조회를 재사용하고, 반환된 trending ID만 completed에서 제외한 다음 개수 제한을 적용한다. OVA 중복은 유지한다.
- 홈 limit은 기본 30개, 최대 30개이며 양수 소수는 내림한다. 잘못된 값, 1 미만, 무한대는 기본값을 사용한다. 일반 목록 API의 기존 검증은 유지한다.

### 검증

- `backend-spring/gradlew.bat test --no-daemon`: BUILD SUCCESSFUL.
- 기존 테스트 9개와 홈 API 테스트 12개, 총 21개 통과.
- 실제 Controller와 Service를 연결하고 Repository만 대체하여 라우팅, JSON 형식, 중복 제외 후 제한, 정렬 요청, 빈 목록 및 limit 경계 조건을 검증했다.
- 실제 MongoDB의 홈·목록·상세를 읽기만 하는 `AnimeMongoIntegrationTest`를 추가했다. `ANIME_MONGO_INTEGRATION=true` 및 `MONGO_URI` 설정 시 실행하며 기본 실행에서는 건너뛴다.
- 실제 DB 테스트 실행은 샌드박스 네트워크 차단 후 외부 실행 승인 요청이 거절되어 수행하지 못했다. 프런트 응답 계약은 소스로 확인했으며 브라우저 연결 검증은 미완료다.

### 남은 범위

- 실제 MongoDB와 브라우저를 통한 홈·목록·상세 연결 검증.
- 별도 프런트 출처에서 연결하기 위한 CORS 설정 검토.

---

## 2026-09-18 — Spring 이전 범위 마무리 점검

### 완료한 이전 범위

- 회원가입·로그인·로그아웃·토큰 검증·비밀번호 재설정 이전.
- 기존 bcrypt 비밀번호와 HS256 JWT 구조를 호환하고, `tokenVersion` 및 DB의 활성·관리자 상태를 매 요청 확인.
- 로그인 실패 잠금, 요청 출처 검증, 보안 헤더, JSON 본문 제한, IP 기반 rate limit 추가.
- 게시글 목록·작성·수정·상세·삭제와 게시글 댓글 CRUD 이전.
- 애니 댓글 목록·작성·삭제·추천·추천 취소 및 사용자별 추천 상태 이전.
- MongoDB 원자 갱신, 카운터, 고유 인덱스, Redis 기반 조회수 중복 방지 추가.
- Redis 장애 시 DB로 돌아가는 캐시·조회 구조 추가. Spring 캐시는 Node 캐시와 별도 namespace를 사용한다.
- AniList 목록·상세 수집, 재시도·간격 제한, 번역 캐시, DeepL 번역, Wikidata 한국어 제목 점검, 제목 복구 작업과 KST 스케줄러 추가.
- 실행 문서, Dockerfile, 일회성 작업 명령, 격리된 로컬 Preview 서버 추가.

### 검증 결과

```text
backend-spring/gradlew.bat test bootJar --no-daemon
BUILD SUCCESSFUL
```

- 통합 테스트에서 메모리 MongoDB를 사용해 회원가입→로그인→토큰 무효화, 게시판 권한, 댓글 추천 멱등성, CORS·본문 제한, 외부 상세 보완을 검증했다.
- 최신 테스트 결과: **총 38개 실행, 실패 0개, 오류 0개**, 실제 운영 MongoDB 읽기 테스트는 환경변수 미설정으로 1개 건너뜀.
- `bootJar` 생성 완료: `backend-spring/build/libs/anilist-backend-0.0.1-SNAPSHOT.jar`.
- React 개발 서버는 `http://localhost:3000`, 독립 Spring Preview는 `http://localhost:8081`로 기동 확인했다. Browser 자동화는 페이지 열기까지 성공했지만, 세션 출력이 반환되지 않아 DOM 상호작용 결과는 별도로 확정하지 못했다.

### 실제 운영 전 남은 확인

- 운영 MongoDB에 읽기 전용 통합 테스트 실행.
- 실제 Redis·SMTP·AniList·DeepL·Wikidata 연결 확인.
- 운영 HTTPS 출처와 쿠키 설정 확인 후 프런트 `REACT_APP_CLIENT_URL`을 Spring 주소로 변경.
- Spring 스케줄러와 Node 스케줄러 중 하나만 활성화해 중복 수집을 방지.
- 실제 트래픽 전환은 기존 Node 서버를 유지한 채 점진적으로 진행하고, 문제 시 API 주소를 Node로 되돌린다.

---

## 2026-09-18 — Spring 단독 운영 스케줄러 정리

- Node와 Spring을 동시에 실행하지 않는 운영 전제를 반영했다.
- `application-worker.yml`을 추가해 Spring worker가 웹 포트 없이 동기화 스케줄러만 실행하도록 했다.
- worker 프로필에서는 동기화를 기본 활성화하고, 일반 API 프로필에서는 기존처럼 비활성화한다.
- `SchedulingConfiguration`을 별도 설정 클래스로 분리해 `@Scheduled` 활성화를 명확히 했다.
- 단일 JVM에서 스케줄러가 겹쳐 실행되지 않도록 하는 `AtomicBoolean` 동작을 테스트했다.
- 수동 명령(`--catalog-sync`, `--catalog-backfill`)과 정기 cron 실행 경로를 함께 유지했다.

검증:

```text
backend-spring/gradlew.bat cleanTest test bootJar --no-daemon
BUILD SUCCESSFUL
총 40개 테스트 통과, 실패 0개
```
- Redis 홈 캐시, 누락 데이터 수집, 번역·동기화 이전.
