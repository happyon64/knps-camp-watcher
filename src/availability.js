const normalize = (value) => value.replace(/\s+/g, " ").trim();

export function parseFacilityRows(rowData) {
  let currentCategory = null;
  const facilities = [];

  for (const row of rowData) {
    const labels = row.labels.map(normalize).filter(Boolean);
    const combined = labels.join(" ");
    if (combined.includes("자동차야영장")) currentCategory = "자동차야영장";
    if (combined.includes("카라반")) currentCategory = "카라반";
    if (combined.includes("특화야영장")) currentCategory = "특화야영장";

    const name = labels
      .map((label) => label.replace(/^(자동차야영장|카라반|특화야영장)\s*/, ""))
      .find((label) => label && !["자동차야영장", "카라반", "특화야영장"].includes(label));

    if (!name || !currentCategory) continue;
    const states = Object.fromEntries(
      row.states.map(({ title, className }) => {
        const date = title.match(/(\d{4}-\d{2}-\d{2})/)?.[1];
        let status = "unknown";
        if (className.includes("icon-reservation")) status = "available";
        else if (className.includes("icon-waiting")) status = "waiting";
        else if (className.includes("icon-none-reservation")) status = "unavailable";
        else if (className.includes("icon-end")) status = "closed";
        return [date, status];
      }).filter(([date]) => date)
    );
    facilities.push({ category: currentCategory, name, states });
  }
  return facilities;
}

export function findConsecutiveAvailability(facilities, target) {
  const desired = facilities.filter((facility) => target.categories.includes(facility.category));
  const scheduleOpen = target.nights.every((date) =>
    desired.some((facility) => Object.hasOwn(facility.states, date))
  );
  const matches = scheduleOpen
    ? desired.filter((facility) =>
        target.nights.every((date) => facility.states[date] === "available")
      )
    : [];
  return { scheduleOpen, matches };
}
