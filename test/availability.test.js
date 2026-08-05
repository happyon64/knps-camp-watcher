import test from "node:test";
import assert from "node:assert/strict";
import { findConsecutiveAvailability, parseFacilityRows } from "../src/availability.js";

const target = {
  categories: ["카라반", "특화야영장"],
  nights: ["2026-09-04", "2026-09-05"]
};

test("같은 시설이 이틀 모두 예약 가능할 때만 일치한다", () => {
  const rows = [
    {
      labels: ["카라반", "1호(6인)"],
      states: [
        { title: "1호(6인) : 2026-09-04", className: "icon-reservation 20260904_N" },
        { title: "1호(6인) : 2026-09-05", className: "icon-reservation 20260905_N" }
      ]
    },
    {
      labels: ["2호(6인)"],
      states: [
        { title: "2호(6인) : 2026-09-04", className: "icon-reservation 20260904_N" },
        { title: "2호(6인) : 2026-09-05", className: "icon-none-reservation 20260905_C" }
      ]
    }
  ];
  const result = findConsecutiveAvailability(parseFacilityRows(rows), target);
  assert.equal(result.scheduleOpen, true);
  assert.deepEqual(result.matches.map((item) => item.name), ["1호(6인)"]);
});

test("목표 날짜가 없으면 일정 미공개로 판정한다", () => {
  const rows = [{
    labels: ["특화야영장", "하우스-1(4인)"],
    states: [{ title: "하우스-1(4인) : 2026-08-31", className: "icon-reservation" }]
  }];
  const result = findConsecutiveAvailability(parseFacilityRows(rows), target);
  assert.equal(result.scheduleOpen, false);
  assert.deepEqual(result.matches, []);
});
