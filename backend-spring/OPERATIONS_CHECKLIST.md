# Spring 운영 전환 체크리스트

## 1. 사전 검증

- [ ] 운영 MongoDB 백업을 만든다.
- [ ] `MONGO_URI`가 운영 DB를 가리키는지 확인한다.
- [ ] `JWT_SECRET`을 32바이트 이상으로 설정한다.
- [ ] `CLIENT_URL`을 실제 HTTPS 프런트 주소로 설정한다.
- [ ] `CORS_ORIGINS`에 필요한 HTTPS 출처만 입력한다.
- [ ] `MAIL_HOST`, `MAIL_USER`, `MAIL_PASS`로 테스트 메일을 발송한다.
- [ ] `REDIS_ENABLED=true`인 경우 운영 Redis 연결을 확인한다.

## 2. Spring API 확인

```powershell
$env:NODE_ENV = 'production'
$env:MONGO_URI = '<production-mongodb-uri>'
$env:JWT_SECRET = '<32-bytes-or-more-secret>'
$env:CLIENT_URL = 'https://<frontend-host>'
$env:CORS_ORIGINS = 'https://<frontend-host>'
.\gradlew.bat bootRun --no-daemon
```

- [ ] `GET /healthz`가 `200 OK`를 반환한다.
- [ ] 로그인 후 `token` 쿠키가 `Secure`, `HttpOnly`, `SameSite=None`으로 설정된다.
- [ ] 기존 사용자로 로그인할 수 있다.
- [ ] 애니 목록·상세·홈을 조회한다.
- [ ] 게시글, 게시글 댓글, 애니 댓글, 추천을 확인한다.
- [ ] 잘못된 Origin의 변경 요청이 `403`이다.
- [ ] 로그인·회원가입·비밀번호 재설정 rate limit이 `429`를 반환한다.

## 3. worker 전환

API와 worker를 별도 프로세스로 실행한다. Node 동기화 작업은 반드시 중지한다.

```powershell
$env:SPRING_PROFILES_ACTIVE = 'worker'
$env:ANIME_SYNC_ENABLED = 'true'
java -jar build/libs/anilist-backend-0.0.1-SNAPSHOT.jar
```

- [ ] AniList 수집이 정상 완료된다.
- [ ] 한국어 현지화 작업이 정상 완료된다.
- [ ] 번역/수집 실패 후 다음 실행에서 재시도된다.
- [ ] Spring worker와 Node worker가 동시에 실행되지 않는다.

## 4. 전환 및 rollback

- [ ] 프런트의 `REACT_APP_CLIENT_URL`을 Spring 주소로 변경한다.
- [ ] 브라우저에서 CORS와 쿠키를 확인한다.
- [ ] 오류 발생 시 프런트 API 주소를 기존 Node 서버로 되돌린다.
- [ ] Spring worker를 중지한 뒤 Node worker를 재개한다.
