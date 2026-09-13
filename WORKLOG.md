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
