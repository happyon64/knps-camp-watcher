# 구룡야영장 카카오톡 빈자리 알림기

치악산 구룡야영장의 아래 조건을 클라우드에서 감시합니다.

- 체크인: 2026-09-04
- 체크아웃: 2026-09-06 (2박)
- 카라반: 1~14호 전체
- 특화야영장: 하우스 1~3 전체
- 같은 시설에서 9월 4일과 5일이 모두 `예약가능`일 때만 알림
- 자동 예약이나 결제는 하지 않음

## 동작 방식

1. 9월 일정이 열리기 전에는 15분 + 무작위 지연 간격으로 확인합니다.
2. 일정 공개 후에는 4분 + 최대 90초 무작위 지연 간격으로 확인합니다.
3. 새로운 2박 연속 빈자리가 발견되면 카카오톡 `나와의 채팅`으로 보냅니다.
4. 메시지의 `예약하러 가기` 버튼을 누르면 공식 예약 페이지가 열립니다.
5. 사용자가 로그인하고 예약·결제를 마무리합니다.

## 1. 카카오 개발자 앱 준비

1. <https://developers.kakao.com>에서 내 애플리케이션을 만듭니다.
2. 제품 설정에서 `카카오 로그인`을 활성화합니다.
3. 동의항목에서 `카카오톡 메시지 전송(talk_message)`을 설정합니다.
4. Web 플랫폼에 배포할 도메인을 등록합니다.
5. Redirect URI에 `https://배포주소/oauth/kakao/callback`을 등록합니다.
6. 앱의 REST API 키를 `.env`의 `KAKAO_REST_API_KEY`에 입력합니다.

## 2. 서버 설정

```bash
cp .env.example .env
```

`.env`에서 반드시 아래 값을 변경합니다.

- `APP_BASE_URL`: 배포된 HTTPS 주소
- `DASHBOARD_PASSWORD`: 12자 이상의 임의 비밀번호
- `KAKAO_REST_API_KEY`: 카카오 앱 REST API 키
- `KAKAO_REDIRECT_URI`: 카카오에 등록한 Callback 주소와 정확히 동일한 값
- `KAKAO_CLIENT_SECRET`: 카카오 앱에서 Client Secret을 사용하도록 설정한 경우 입력

## 3. Docker로 실행

```bash
docker build -t knps-camp-watcher .
docker run -d --name knps-camp-watcher \
  --restart unless-stopped \
  --env-file .env \
  -p 3000:3000 \
  -v knps-watcher-data:/app/data \
  knps-camp-watcher
```

클라우드 방화벽에서는 3000번 포트를 그대로 공개하지 말고, Caddy나 호스팅 서비스의 HTTPS 프록시 뒤에 두는 것을 권장합니다.

### 무료로 운영하기

Northflank의 Sandbox에는 상시 실행되는 무료 서비스가 제공됩니다. 이 프로젝트는 작은 무료 컨테이너에 맞춰 매 확인 시에만 Chromium을 실행하고 즉시 종료합니다.

1. <https://northflank.com>에 GitHub 계정으로 가입합니다.
2. Sandbox 프로젝트와 Combined Service를 생성합니다.
3. 이 폴더를 올린 GitHub 저장소를 소스로 선택하고 Dockerfile 빌드를 선택합니다.
4. `.env.example`의 항목들을 Secrets/Environment Variables로 등록합니다.
5. 서비스 포트는 `3000`, Health check 경로는 `/health`로 설정합니다.
6. `/app/data`에 영구 Volume을 연결합니다.

무료 플랜의 자원 및 제공 조건은 서비스 정책에 따라 변경될 수 있습니다. Chromium 실행 중 메모리 부족이 반복되면 유료 소형 컨테이너나 휴대폰 알림 앱 방식으로 전환해야 합니다.

## 4. 안드로이드에서 연결

1. Chrome으로 `APP_BASE_URL`을 엽니다.
2. Basic Auth 창에 `.env`의 관리 화면 아이디와 비밀번호를 입력합니다.
3. `카카오톡 연결`을 누르고 본인 카카오계정으로 동의합니다.
4. `카카오톡 시험 알림`을 눌러 나와의 채팅에 메시지가 오는지 확인합니다.
5. Chrome 메뉴에서 `홈 화면에 추가`를 선택하면 앱처럼 사용할 수 있습니다.

## 로컬 테스트

```bash
npm install
npx playwright install chromium
npm test
npm start
```

관리 화면: <http://localhost:3000>

## 운영상 주의사항

- 국립공원공단의 캡차, 접속 대기열 또는 접근 제한을 우회하지 않습니다.
- 화면 구조가 변경되면 감시기가 오류 상태를 표시할 수 있습니다.
- 카카오 토큰과 감시 상태는 `DATA_DIR/state.json`에 저장되므로 영구 볼륨과 접근 제한이 필요합니다.
- 예약 가능 알림 이후에도 다른 사용자가 먼저 예약할 수 있습니다.
- 공단 정책상 자동화가 허용되는지는 별도로 확인하고, 필요하면 감시 간격을 더 늘리세요.
