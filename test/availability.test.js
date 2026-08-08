import test from "node:test";
import assert from "node:assert/strict";
import { findConsecutiveAvailability, parseFacilityRows } from "../src/availability.js";

const target = {
  categories: ["\uce74\ub77c\ubc18", "\ud2b9\ud654\uc57c\uc601\uc7a5"],
  nights: ["2026-09-04", "2026-09-05"]
};

test("same facility must be available on both nights", () => {
  const rows = [
    {
      labels: ["\uce74\ub77c\ubc18", "1\ud638"],
      states: [
        { title: "1\ud638 : 2026-09-04", className: "icon-reservation 20260904_N" },
        { title: "1\ud638 : 2026-09-05", className: "icon-reservation 20260905_N" }
      ]
    },
    {
      labels: ["2\ud638"],
      states: [
        { title: "2\ud638 : 2026-09-04", className: "icon-reservation 20260904_N" },
        { title: "2\ud638 : 2026-09-05", className: "icon-none-reservation 20260905_C" }
      ]
    }
  ];
  const result = findConsecutiveAvailability(parseFacilityRows(rows), target);
  assert.equal(result.scheduleOpen, true);
  assert.deepEqual(result.matches.map((item) => item.name), ["1\ud638"]);
});

test("missing target dates means schedule is not open", () => {
  const rows = [
    {
      labels: ["\ud2b9\ud654\uc57c\uc601\uc7a5", "\ud558\uc6b0\uc2a4-1(4\uc778)"],
      states: [{ title: "\ud558\uc6b0\uc2a4-1(4\uc778) : 2026-08-31", className: "icon-reservation" }]
    }
  ];
  const result = findConsecutiveAvailability(parseFacilityRows(rows), target);
  assert.equal(result.scheduleOpen, false);
  assert.deepEqual(result.matches, []);
});
