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
    // The visible reservation page now redirects campground clicks to login.
    // Its availability fragment remains a public POST endpoint, so read that
    // fragment directly instead of trying to automate a logged-in reservation.
    const response = await context.request.post(
      "https://reservation.knps.or.kr/reservation/campsiteList.do",
      {
        form: {
          dept_id: "B101001",
          dept_name: config.target.campground,
          parent_dept_name: config.target.park,
          prd_ctg_id: "",
          isGreenpoint: "N"
        },
        headers: { Referer: config.reservationUrl },
        timeout: 90_000
      }
    );
    if (!response.ok()) {
      throw new Error(`KNPS availability request failed: ${response.status()}`);
    }
    await page.setContent(await response.text(), {
      waitUntil: "domcontentloaded",
      timeout: 90_000
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

function availabilityMessage(target, matches) {
  const list = matches.map((item) => `- ${item.category} ${item.name}`).join("\n");
  const stayText = target.nights.length === 1 ? "1\ubc15" : `${target.nights.length}\ubc15 \uc5f0\uc18d`;
  return [
    `[\uad6c\ub8e1\uc57c\uc601\uc7a5] ${stayText} \ube48\uc790\ub9ac \ubc1c\uacac!`,
    "",
    `\uc77c\uc815: ${target.label}`,
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
    const previous = getState().monitor;
    const previousKeys = previous.notificationKeys ?? {};
    const notificationKeys = {};
    const targetResults = [];

    for (const target of config.targets) {
      const result = findConsecutiveAvailability(facilities, target);
      const matchingFacilities = result.matches.map(
        (item) => `${item.category} ${item.name}`
      );
      const notificationKey = matchingFacilities.slice().sort().join("|");
      notificationKeys[target.id] = matchingFacilities.length ? notificationKey : null;
      targetResults.push({ target, result, matchingFacilities });

      if (matchingFacilities.length && notificationKey !== previousKeys[target.id]) {
        await sendKakaoMessage(availabilityMessage(target, result.matches));
      }
    }

    const matchingFacilities = targetResults.flatMap(({ target, matchingFacilities }) =>
      matchingFacilities.map((facility) => `${target.label}: ${facility}`)
    );
    const scheduleOpen = targetResults.some(({ result }) => result.scheduleOpen);

    await patchState({
      monitor: {
        running: false,
        lastSuccessAt: new Date().toISOString(),
        lastError: null,
        scheduleOpen,
        matchingFacilities,
        lastNotificationKey: matchingFacilities.length
          ? matchingFacilities.slice().sort().join("|")
          : null,
        notificationKeys
      }
    });
    return {
      scheduleOpen,
      matches: targetResults.flatMap(({ result }) => result.matches),
      targetResults
    };
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
