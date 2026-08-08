const normalize = (value) => value.replace(/\s+/g, " ").trim();
const categoryNames = ["\uc790\ub3d9\ucc28\uc57c\uc601\uc7a5", "\uce74\ub77c\ubc18", "\ud2b9\ud654\uc57c\uc601\uc7a5"];

export function parseFacilityRows(rowData) {
  let currentCategory = null;
  const facilities = [];

  for (const row of rowData) {
    const labels = row.labels.map(normalize).filter(Boolean);
    const combined = labels.join(" ");
    for (const category of categoryNames) {
      if (combined.includes(category)) currentCategory = category;
    }

    const name = labels
      .map((label) => {
        let value = label;
        for (const category of categoryNames) value = value.replace(category, "");
        return normalize(value);
      })
      .find((label) => label && !categoryNames.includes(label));

    if (!name || !currentCategory) continue;
    const states = Object.fromEntries(
      row.states
        .map(({ title = "", className = "" }) => {
          const date = title.match(/(\d{4}-\d{2}-\d{2})/)?.[1];
          let status = "unknown";
          if (/icon-none-reservation/.test(className)) status = "unavailable";
          else if (/icon-reservation/.test(className)) status = "available";
          else if (/icon-waiting/.test(className)) status = "waiting";
          else if (/icon-end/.test(className)) status = "closed";
          return [date, status];
        })
        .filter(([date]) => date)
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
