import { chromium } from "playwright";
import { config } from "./config.js";
import { findConsecutiveAvailability, parseFacilityRows } from "./availability.js";
import { sendKakaoMessage } from "./kakao.js";
import { getState, patchState } from "./store.js";

let timer;
let activeRun;

async function scrape() {
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
    await page.goto(config.reservationUrl, {
      waitUntil: "domcontentloaded",
      timeout: 90_000
    });
    await page.getByRole("link", { name: new RegExp(config.target.park) }).click();
    await page.getByRole("link", { name: config.target.campground, exact: true }).click();
    await page.locator("table").filter({ hasText: "\uc2dc\uc124 \uc608\uc57d \ud604\ud669" }).waitFor({
      timeout: 30_000
    });

    return await page.evaluate(() => {
      const tables = [...document.querySelectorAll("table")];
      const nameTable = tables.find((table) =>
        table.querySelector("caption")?.innerText.includes("\uc2dc\uc124\uba85 \ubc0f \uc601\uc9c0 \uba85")
      );
      const statusTable = tables.find((table) =>
        table.querySelector("caption")?.innerText.includes("\uc2dc\uc124 \uc608\uc57d \ud604\ud669")
      );
      if (!nameTable || !statusTable) throw new Error("Reservation tables were not found");
      const nameRows = [...nameTable.rows];
      const statusRows = [...statusTable.rows].slice(-nameRows.length);
      return nameRows.map((row, index) => ({
        labels: [...row.querySelectorAll("th,td")].map((cell) => cell.innerText),
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
  const list = matches.map((item) => `- ${item.category} ${item.name}`).join("\n");
  return [
    "[\uad6c\ub8e1\uc57c\uc601\uc7a5] 2\ubc15 \uc5f0\uc18d \ube48\uc790\ub9ac \ubc1c\uacac!",
    "",
    "\uc77c\uc815: 2026\ub144 9\uc6d4 4\uc77c ~ 9\uc6d4 6\uc77c (2\ubc15)",
    list,
    "",
    "\uc544\ub798 \ubc84\ud2bc\uc744 \ub20c\ub7ec \uacf5\uc2dd \uc608\uc57d \ud398\uc774\uc9c0\uc5d0\uc11c \uc9c1\uc811 \uc608\uc57d\ud558\uc138\uc694."
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
        lastNotificationKey: matchingFacilities.length ? notificationKey : null
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
  patchState({ monitor: { nextCheckAt: new Date(Date.now() + delay).toISOString() } }).catch(
    console.error
  );
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
