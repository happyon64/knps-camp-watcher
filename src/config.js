import path from "node:path";
import "dotenv/config";

const numberEnv = (name, fallback) => {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be positive`);
  return value;
};

export const config = {
  port: numberEnv("PORT", 3000),
  appBaseUrl: (process.env.APP_BASE_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  dashboardUsername: process.env.DASHBOARD_USERNAME ?? "admin",
  dashboardPassword: process.env.DASHBOARD_PASSWORD ?? "",
  kakaoRestApiKey: process.env.KAKAO_REST_API_KEY ?? "",
  kakaoClientSecret: process.env.KAKAO_CLIENT_SECRET ?? "",
  kakaoRefreshToken: process.env.KAKAO_REFRESH_TOKEN ?? "",
  kakaoRedirectUri:
    process.env.KAKAO_REDIRECT_URI ?? "http://localhost:3765/oauth/kakao/callback",
  dataDir: path.resolve(process.env.DATA_DIR ?? "./data"),
  headless: (process.env.HEADLESS ?? "true").toLowerCase() !== "false",
  intervalUnopenedMs: numberEnv("INTERVAL_UNOPENED_SECONDS", 900) * 1000,
  intervalOpenMs: numberEnv("INTERVAL_OPEN_SECONDS", 240) * 1000,
  jitterMs: numberEnv("JITTER_SECONDS", 90) * 1000,
  reservationUrl:
    "https://reservation.knps.or.kr/reservation/searchSimpleCampReservation.do",
  target: {
    park: "\uce58\uc545\uc0b0",
    campground: "\uad6c\ub8e1"
  },
  targets: [
    {
      id: "2026-08-22-caravan",
      label: "2026\ub144 8\uc6d4 22\uc77c ~ 8\uc6d4 23\uc77c (1\ubc15)",
      nights: ["2026-08-22"],
      categories: ["\uce74\ub77c\ubc18"]
    },
    {
      id: "2026-08-29-caravan",
      label: "2026\ub144 8\uc6d4 29\uc77c ~ 8\uc6d4 30\uc77c (1\ubc15)",
      nights: ["2026-08-29"],
      categories: ["\uce74\ub77c\ubc18"]
    },
    {
      id: "2026-09-04-two-nights",
      label: "2026\ub144 9\uc6d4 4\uc77c ~ 9\uc6d4 6\uc77c (2\ubc15)",
      nights: ["2026-09-04", "2026-09-05"],
      categories: ["\uce74\ub77c\ubc18", "\ud2b9\ud654\uc57c\uc601\uc7a5"]
    }
  ]
};

export function validateRuntimeConfig() {
  const errors = [];
  if (!config.kakaoRestApiKey) errors.push("KAKAO_REST_API_KEY is missing");
  if (!config.kakaoRefreshToken) errors.push("KAKAO_REFRESH_TOKEN is missing");
  return errors;
}
