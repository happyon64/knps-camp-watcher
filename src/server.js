import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import express from "express";
import { config, validateRuntimeConfig } from "./config.js";
import { getAuthorizationUrl, connectWithCode, sendKakaoMessage } from "./kakao.js";
import { runNow, startMonitor, stopMonitor } from "./monitor.js";
import { getState, loadState } from "./store.js";

await loadState();
const app = express();
app.disable("x-powered-by");
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

function safeEqual(left, right) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function basicAuth(req, res, next) {
  if (req.path === "/health") return next();
  const token = req.headers.authorization?.match(/^Basic (.+)$/)?.[1];
  const [username = "", password = ""] = token
    ? Buffer.from(token, "base64").toString("utf8").split(":", 2)
    : [];
  if (
    !config.dashboardPassword ||
    !safeEqual(username, config.dashboardUsername) ||
    !safeEqual(password, config.dashboardPassword)
  ) {
    res.set("WWW-Authenticate", 'Basic realm="KNPS Watcher"');
    return res.status(401).send("로그인이 필요합니다.");
  }
  next();
}

app.use(basicAuth);
app.use(express.static(fileURLToPath(new URL("../public", import.meta.url))));

app.get("/health", (_req, res) => res.json({ ok: true }));
app.get("/api/status", (_req, res) => {
  const state = getState();
  res.json({
    target: config.target,
    kakaoConnected: Boolean(state.kakao?.refreshToken),
    monitor: state.monitor,
    configurationErrors: validateRuntimeConfig()
  });
});
const oauthStates = new Map();
app.get("/api/kakao/connect", (_req, res) => {
  const state = crypto.randomBytes(24).toString("hex");
  oauthStates.set(state, Date.now() + 10 * 60 * 1000);
  res.redirect(getAuthorizationUrl(state));
});
app.get("/oauth/kakao/callback", async (req, res, next) => {
  try {
    if (!req.query.code) throw new Error("카카오 인가 코드가 없습니다.");
    const expiresAt = oauthStates.get(req.query.state);
    oauthStates.delete(req.query.state);
    if (!expiresAt || Date.now() > expiresAt) {
      throw new Error("카카오 연결 요청이 만료되었거나 올바르지 않습니다.");
    }
    await connectWithCode(req.query.code);
    res.redirect("/?connected=1");
  } catch (error) {
    next(error);
  }
});
app.post("/api/test-kakao", async (_req, res, next) => {
  try {
    await sendKakaoMessage(
      "✅ 구룡야영장 감시기의 카카오톡 연결 테스트가 완료되었습니다."
    );
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});
app.post("/api/run", async (_req, res, next) => {
  try {
    const result = await runNow();
    res.json({ ok: true, ...result });
  } catch (error) {
    next(error);
  }
});
app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ ok: false, error: error.message ?? "알 수 없는 오류" });
});

const server = app.listen(config.port, () => {
  console.log(`KNPS watcher listening on ${config.appBaseUrl}`);
  const errors = validateRuntimeConfig();
  if (errors.length) console.warn("설정 확인 필요:", errors.join(" / "));
  startMonitor();
});

async function shutdown() {
  server.close();
  await stopMonitor();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
