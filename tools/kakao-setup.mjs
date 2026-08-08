import http from "node:http";
import { execFile } from "node:child_process";

const restKey = process.env.KAKAO_REST_API_KEY?.trim();
const clientSecret = process.env.KAKAO_CLIENT_SECRET?.trim();
const redirectUri = "http://localhost:3765/oauth/kakao/callback";

if (!restKey) {
  console.error("KAKAO_REST_API_KEY가 없습니다.");
  process.exit(1);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, redirectUri);
  if (url.pathname !== "/oauth/kakao/callback") {
    res.writeHead(404).end();
    return;
  }
  try {
    const code = url.searchParams.get("code");
    if (!code) throw new Error(url.searchParams.get("error_description") || "인가 코드가 없습니다.");
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: restKey,
      redirect_uri: redirectUri,
      code
    });
    if (clientSecret) body.set("client_secret", clientSecret);
    const response = await fetch("https://kauth.kakao.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
      body
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error_description || payload.error);

    res.writeHead(200, { "Content-Type": "text/html;charset=utf-8" });
    res.end("<h2>카카오 연결 완료</h2><p>명령창으로 돌아가 안내를 계속하세요.</p>");
    console.log("\n연결 성공! 아래 refresh token을 GitHub Secret에 저장하세요.\n");
    console.log(payload.refresh_token);
    console.log("\n이 값은 누구에게도 보여주지 마세요. 창은 직접 닫아도 됩니다.\n");
    setTimeout(() => server.close(), 1000);
  } catch (error) {
    res.writeHead(500, { "Content-Type": "text/plain;charset=utf-8" });
    res.end(`카카오 연결 실패: ${error.message}`);
    console.error(error);
    setTimeout(() => server.close(), 1000);
  }
});

server.listen(3765, "127.0.0.1", () => {
  const params = new URLSearchParams({
    client_id: restKey,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "talk_message",
    state: crypto.randomUUID()
  });
  const authUrl = `https://kauth.kakao.com/oauth/authorize?${params}`;
  console.log("카카오 로그인 창을 엽니다. 동의 후 이 창으로 돌아오세요.");
  execFile("cmd.exe", ["/c", "start", "", authUrl]);
});
