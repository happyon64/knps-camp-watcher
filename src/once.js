import { validateRuntimeConfig } from "./config.js";
import { loadState } from "./store.js";
import { runNow } from "./monitor.js";

await loadState();
const errors = validateRuntimeConfig();
if (errors.length) throw new Error(errors.join(" / "));

const result = await runNow();
console.log(
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      scheduleOpen: result.scheduleOpen,
      matches: result.matches.map((item) => `${item.category} ${item.name}`)
    },
    null,
    2
  )
);
