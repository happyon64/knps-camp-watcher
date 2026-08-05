import path from "node:path";
import "dotenv/config";

const numberEnv = (name, fallback) => {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive number`);
  }
  return value;
};

export const config = {
  port: numberEnv("PORT", 3000),
  appBaseUrl: (process.env.APP_BASE_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  dashboardUsername: process.env.DASHBOARD_USERNAME ?? "admin",
  dashboardPassword: process.env.DASHBOARD_PASSWORD ?? "",
  kakaoRestApiKey: process.env.KAKAO_REST_API_KEY ?? "",
  kakaoClientSecret: process.env.KAKAO_CLIENT_SECRET ?? "",
  kakaoRedirectUri:
    process.env.KAKAO_REDIRECT_URI ?? "http://localhost:3000/oauth/kakao/callback",
  dataDir: path.resolve(process.env.DATA_DIR ?? "./data"),
  headless: (process.env.HEADLESS ?? "true").toLowerCase() !== "false",
  intervalUnopenedMs: numberEnv("INTERVAL_UNOPENED_SECONDS", 900) * 1000,
  intervalOpenMs: numberEnv("INTERVAL_OPEN_SECONDS", 240) * 1000,
  jitterMs: numberEnv("JITTER_SECONDS", 90) * 1000,
  reservationUrl:
    "https://reservation.knps.or.kr/reservation/searchSimpleCampReservation.do",
  target: {
    park: "치악산",
    campground: "구룡",
    checkIn: "2026-09-04",
    checkOut: "2026-09-06",
    nights: ["2026-09-04", "2026-09-05"],
    categories: ["카라반", "특화야영장"]
  }
};

export function validateRuntimeConfig() {
  const errors = [];
  if (!config.dashboardPassword || config.dashboardPassword.length < 12) {
    errors.push("DASHBOARD_PASSWORD는 12자 이상으로 설정해야 합니다.");
  }
  if (!config.kakaoRestApiKey) errors.push("KAKAO_REST_API_KEY가 없습니다.");
  if (!/^https?:\/\//.test(config.kakaoRedirectUri)) {
    errors.push("KAKAO_REDIRECT_URI가 올바른 URL이 아닙니다.");
  }
  return errors;
}
