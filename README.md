# 구룡야영장 카카오톡 빈자리 알림

치악산 구룡야영장의 다음 조건을 GitHub Actions가 약 5분 간격으로 확인합니다.

- 입실: 2026-09-04
- 퇴실: 2026-09-06 (2박)
- 카라반 1~14호 전체
- 특화야영장 하우스 1~3 전체
- 같은 시설이 9월 4일과 5일 모두 예약 가능할 때만 알림
- 카카오톡 `나와의 채팅`으로 알림
- 자동 예약·로그인·결제는 하지 않음

## 비용

공개 GitHub 저장소의 표준 GitHub Actions 실행을 사용하므로 카드 등록 없이 무료입니다. 예약 확인 작업은 GitHub 사정에 따라 몇 분 늦어질 수 있습니다.

## 1. 카카오 개발자 앱 준비

1. <https://developers.kakao.com>에서 `내 애플리케이션`을 만듭니다.
2. `카카오 로그인`을 활성화합니다.
3. Redirect URI에 아래 주소를 정확히 등록합니다.

   `http://localhost:3765/oauth/kakao/callback`

4. 동의항목에서 `카카오톡 메시지 전송(talk_message)`을 설정합니다.
5. REST API 키를 확인합니다.
6. REST API 키의 Client Secret이 활성화되어 있으면 Client Secret 코드도 확인합니다.

## 2. 카카오 Refresh Token 받기

1. 압축을 푼 폴더의 `카카오연결.cmd`를 더블클릭합니다.
2. REST API 키와 Client Secret을 입력합니다.
3. 열린 카카오 로그인 화면에서 본인 계정으로 동의합니다.
4. 명령창에 표시된 Refresh Token을 복사합니다.

REST API 키, Client Secret, Refresh Token은 누구에게도 보여주거나 GitHub 코드 파일에 입력하지 마세요.

## 3. GitHub에 최신 파일 올리기

GitHub의 `happyon64/knps-camp-watcher` 저장소에서 `Add file` → `Upload files`를 선택하고, 이 폴더의 파일과 폴더를 모두 올립니다. `.github/workflows/watch.yml`도 반드시 포함되어야 합니다.

## 4. GitHub Secrets 등록

저장소에서 `Settings` → `Secrets and variables` → `Actions` → `New repository secret`으로 이동하여 등록합니다.

- `KAKAO_REST_API_KEY`: 카카오 REST API 키
- `KAKAO_CLIENT_SECRET`: Client Secret을 활성화한 경우의 코드
- `KAKAO_REFRESH_TOKEN`: `카카오연결.cmd`가 표시한 Refresh Token

값은 GitHub 화면에서도 다시 확인할 수 없으므로 별도로 안전하게 보관하세요.

## 5. 작동 시험

1. 저장소의 `Actions` 탭을 엽니다.
2. 왼쪽에서 `Check Guryong campsite`를 선택합니다.
3. `Run workflow`를 눌러 한 번 실행합니다.
4. 초록색 체크가 뜨면 이후에는 자동 실행됩니다.

현재 빈자리가 없으면 카카오톡 메시지가 오지 않는 것이 정상입니다. 동일한 빈자리로 반복 알림하지 않도록 감시 상태를 저장합니다.

## 주의사항

- GitHub 예약 실행은 서버 혼잡 시 지연되거나 드물게 누락될 수 있습니다.
- 공개 저장소가 60일 동안 아무 활동이 없으면 예약 실행이 자동으로 중지될 수 있지만, 이번 감시 일정은 그보다 짧습니다.
- 화면 구조가 바뀌면 감시 작업이 실패할 수 있습니다.
- 알림을 받은 뒤 다른 사용자가 먼저 예약할 수 있습니다.
- 국립공원공단의 이용 정책을 준수하며 접속 제한이나 CAPTCHA를 우회하지 않습니다.
