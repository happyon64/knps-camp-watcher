import fs from "node:fs/promises";
import path from "node:path";
import { config } from "./config.js";

const statePath = path.join(config.dataDir, "state.json");

const initialState = {
  kakao: null,
  monitor: {
    running: false,
    lastCheckedAt: null,
    lastSuccessAt: null,
    lastError: null,
    scheduleOpen: false,
    matchingFacilities: [],
    lastNotificationKey: null,
    notificationKeys: {},
    nextCheckAt: null
  }
};

let state = structuredClone(initialState);
let writeQueue = Promise.resolve();

export async function loadState() {
  await fs.mkdir(config.dataDir, { recursive: true });
  try {
    const parsed = JSON.parse(await fs.readFile(statePath, "utf8"));
    state = {
      ...structuredClone(initialState),
      ...parsed,
      monitor: { ...initialState.monitor, ...(parsed.monitor ?? {}) }
    };
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    await saveState();
  }
  state.monitor.running = false;
  return state;
}

export function getState() {
  return state;
}

export async function patchState(patch) {
  state = {
    ...state,
    ...patch,
    monitor: patch.monitor ? { ...state.monitor, ...patch.monitor } : state.monitor
  };
  await saveState();
  return state;
}

export function saveState() {
  const snapshot = JSON.stringify(state, null, 2);
  writeQueue = writeQueue.then(async () => {
    const tempPath = `${statePath}.tmp`;
    await fs.writeFile(tempPath, snapshot, { mode: 0o600 });
    await fs.rename(tempPath, statePath);
  });
  return writeQueue;
}
