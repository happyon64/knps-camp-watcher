import { config } from "./config.js";
import { getState, patchState } from "./store.js";

let transientKakao = null;

function requireKakaoConfig() {
  if (!config.kakaoRestApiKey) throw new Error("KAKAO_REST_API_KEY is missing");
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
  if (!response.ok) {
    throw new Error(`Kakao token request failed: ${payload.error_description ?? payload.error}`);
  }
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
  return payload;
}

async function getAccessToken() {
  const useEnvironmentToken = Boolean(config.kakaoRefreshToken);
  const saved = useEnvironmentToken ? transientKakao : getState().kakao;
  const refreshToken = config.kakaoRefreshToken || saved?.refreshToken;
  if (!refreshToken) throw new Error("Kakao refresh token is missing");
  if (saved?.accessToken && Date.now() < saved.accessTokenExpiresAt) return saved.accessToken;

  const payload = await requestToken({
    grantType: "refresh_token",
    extra: { refresh_token: refreshToken }
  });
  const updated = {
    ...saved,
    accessToken: payload.access_token,
    accessTokenExpiresAt: Date.now() + payload.expires_in * 1000 - 60_000,
    refreshToken: payload.refresh_token ?? refreshToken,
    refreshTokenExpiresAt: payload.refresh_token_expires_in
      ? Date.now() + payload.refresh_token_expires_in * 1000
      : saved?.refreshTokenExpiresAt ?? null
  };
  if (useEnvironmentToken) transientKakao = updated;
  else await patchState({ kakao: updated });
  return updated.accessToken;
}

export async function sendKakaoMessage(text, link = config.reservationUrl) {
  const accessToken = await getAccessToken();
  const linkText = `\n\n\uc608\uc57d \ub9c1\ud06c: ${link}`;
  const messageText = `${text.slice(0, Math.max(0, 200 - linkText.length))}${linkText}`;
  const templateObject = {
    object_type: "text",
    text: messageText,
    link: { web_url: link, mobile_web_url: link },
    button_title: "\uc608\uc57d\ud558\ub7ec \uac00\uae30"
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
    throw new Error(`Kakao message failed: ${JSON.stringify(payload)}`);
  }
}
