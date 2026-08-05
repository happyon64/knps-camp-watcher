import { chromium } from "playwright";
import { config } from "./config.js";
import { findConsecutiveAvailability, parseFacilityRows } from "./availability.js";
import { sendKakaoMessage } from "./kakao.js";
import { getState, patchState } from "./store.js";

let timer;
let activeRun;

async function scrape() {
  // 무료 512MB급 컨테이너에서도 유휴 메모리를 쓰지 않도록 매 확인 후 브라우저를 종료한다.
  const instance = await chromium.launch({
    headless: config.headless,
    args: ["--disable-dev-shm-usage", "--no-sandbox"]
  });
  const context = await instance.newContext({
    locale: "ko-KR",
    timezoneId: "Asia/Seoul",
    userAgent:
      "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36"
  });
  const page = await context.newPage();
  try {
    await page.goto(config.reservationUrl, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.getByText(config.target.park, { exact: false }).first().click();
    await page.getByText(config.target.campground, { exact: true }).click();
    await page.getByText(`${config.target.campground} 야영장 예약현황`, { exact: false }).waitFor({
      timeout: 30_000
    });

    return await page.evaluate(() => {
      const tables = [...document.querySelectorAll("table")];
      const nameTable = tables.find((table) =>
        table.querySelector("caption")?.innerText.includes("시설명 및 영지 명")
      );
      const statusTable = tables.find((table) =>
        table.querySelector("caption")?.innerText.includes("시설 예약 현황")
      );
      if (!nameTable || !statusTable) throw new Error("예약현황 표를 찾지 못했습니다.");
      const nameRows = [...nameTable.rows];
      const statusRows = [...statusTable.rows].slice(-nameRows.length);
      return nameRows.map((row, index) => ({
        labels: [...row.querySelectorAll("th")].map((cell) => cell.innerText),
        states: [...statusRows[index].querySelectorAll("i")].map((icon) => ({
          title: icon.title,
          className: icon.className
        }))
      }));
    });
  } finally {
    await context.close();
    await instance.close();
  }
}

function availabilityMessage(matches) {
  const list = matches.map((item) => `• ${item.category} ${item.name}`).join("\n");
  return [
    "🏕 구룡야영장 2박 연속 빈자리 발견!",
    "",
    "일정: 2026년 9월 4일 → 9월 6일 (2박)",
    list,
    "",
    "아래 버튼을 눌러 로그인 후 즉시 예약하세요."
  ].join("\n");
}

async function performRun() {
  const checkedAt = new Date().toISOString();
  await patchState({ monitor: { running: true, lastCheckedAt: checkedAt, lastError: null } });
  try {
    const facilities = parseFacilityRows(await scrape());
    const result = findConsecutiveAvailability(facilities, config.target);
    const matchingFacilities = result.matches.map((item) => `${item.category} ${item.name}`);
    const notificationKey = matchingFacilities.slice().sort().join("|");
    const previous = getState().monitor;

    if (result.scheduleOpen && !previous.scheduleOpen && getState().kakao) {
      await sendKakaoMessage(
        "📅 구룡야영장 2026년 9월 일정이 예약 화면에 공개되었습니다.\n9월 4~6일 빈자리를 계속 감시합니다."
      );
    }
    if (matchingFacilities.length && notificationKey !== previous.lastNotificationKey) {
      await sendKakaoMessage(availabilityMessage(result.matches));
    }

    await patchState({
      monitor: {
        running: false,
        lastSuccessAt: new Date().toISOString(),
        lastError: null,
        scheduleOpen: result.scheduleOpen,
        matchingFacilities,
        lastNotificationKey: matchingFacilities.length
          ? notificationKey
          : null
      }
    });
    return result;
  } catch (error) {
    await patchState({
      monitor: { running: false, lastError: error.message ?? String(error) }
    });
    throw error;
  }
}

export function runNow() {
  if (!activeRun) activeRun = performRun().finally(() => (activeRun = null));
  return activeRun;
}

function scheduleNext() {
  clearTimeout(timer);
  const base = getState().monitor.scheduleOpen
    ? config.intervalOpenMs
    : config.intervalUnopenedMs;
  const delay = base + Math.floor(Math.random() * config.jitterMs);
  const nextCheckAt = new Date(Date.now() + delay).toISOString();
  patchState({ monitor: { nextCheckAt } }).catch(console.error);
  timer = setTimeout(async () => {
    try {
      await runNow();
    } catch (error) {
      console.error(new Date().toISOString(), error);
    } finally {
      scheduleNext();
    }
  }, delay);
}

export async function startMonitor() {
  try {
    await runNow();
  } catch (error) {
    console.error(new Date().toISOString(), error);
  }
  scheduleNext();
}

export async function stopMonitor() {
  clearTimeout(timer);
  if (activeRun) await activeRun.catch(() => {});
}
