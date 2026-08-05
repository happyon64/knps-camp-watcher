import { config } from "./config.js";
import { getState, patchState } from "./store.js";

function requireKakaoConfig() {
  if (!config.kakaoRestApiKey) throw new Error("KAKAO_REST_API_KEY가 설정되지 않았습니다.");
}

export function getAuthorizationUrl(state) {
  requireKakaoConfig();
  const params = new URLSearchParams({
    client_id: config.kakaoRestApiKey,
    redirect_uri: config.kakaoRedirectUri,
    response_type: "code",
    scope: "talk_message",
    state
  });
  return `https://kauth.kakao.com/oauth/authorize?${params}`;
}

async function requestToken(params) {
  requireKakaoConfig();
  const body = new URLSearchParams({
    grant_type: params.grantType,
    client_id: config.kakaoRestApiKey,
    ...params.extra
  });
  if (config.kakaoClientSecret) body.set("client_secret", config.kakaoClientSecret);
  const response = await fetch("https://kauth.kakao.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
    body
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(`카카오 토큰 요청 실패: ${payload.error_description ?? payload.error}`);
  return payload;
}

export async function connectWithCode(code) {
  const payload = await requestToken({
    grantType: "authorization_code",
    extra: { redirect_uri: config.kakaoRedirectUri, code }
  });
  const now = Date.now();
  await patchState({
    kakao: {
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token,
      accessTokenExpiresAt: now + payload.expires_in * 1000 - 60_000,
      refreshTokenExpiresAt: payload.refresh_token_expires_in
        ? now + payload.refresh_token_expires_in * 1000
        : null,
      connectedAt: new Date(now).toISOString()
    }
  });
}

async function getAccessToken() {
  const kakao = getState().kakao;
  if (!kakao?.refreshToken) throw new Error("카카오톡이 아직 연결되지 않았습니다.");
  if (kakao.accessToken && Date.now() < kakao.accessTokenExpiresAt) return kakao.accessToken;

  const payload = await requestToken({
    grantType: "refresh_token",
    extra: { refresh_token: kakao.refreshToken }
  });
  const updated = {
    ...kakao,
    accessToken: payload.access_token,
    accessTokenExpiresAt: Date.now() + payload.expires_in * 1000 - 60_000,
    refreshToken: payload.refresh_token ?? kakao.refreshToken,
    refreshTokenExpiresAt: payload.refresh_token_expires_in
      ? Date.now() + payload.refresh_token_expires_in * 1000
      : kakao.refreshTokenExpiresAt
  };
  await patchState({ kakao: updated });
  return updated.accessToken;
}

export async function sendKakaoMessage(text, link = config.reservationUrl) {
  const accessToken = await getAccessToken();
  const templateObject = {
    object_type: "text",
    text,
    link: { web_url: link, mobile_web_url: link },
    button_title: "예약하러 가기"
  };
  const response = await fetch("https://kapi.kakao.com/v2/api/talk/memo/default/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/x-www-form-urlencoded;charset=utf-8"
    },
    body: new URLSearchParams({ template_object: JSON.stringify(templateObject) })
  });
  const payload = await response.json();
  if (!response.ok || payload.result_code !== 0) {
    throw new Error(`카카오 메시지 발송 실패: ${JSON.stringify(payload)}`);
  }
}
