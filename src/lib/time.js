export const DAY_NAMES = ["日", "月", "火", "水", "木", "金", "土"];
export const DAY_MS = 86400000;

const pad = (n) => String(n).padStart(2, "0");

export function toKey(date) {
  return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
}
export function todayKey() {
  return toKey(new Date());
}
export function keyToDate(key) {
  return new Date(key + "T00:00:00");
}
export function dayStart(key) {
  return keyToDate(key).getTime();
}
export function addDays(key, n) {
  const d = keyToDate(key);
  d.setDate(d.getDate() + n);
  return toKey(d);
}
export function fmtHMS(secs) {
  const s = Math.max(0, Math.floor(secs));
  return pad(Math.floor(s / 3600)) + ":" + pad(Math.floor((s % 3600) / 60)) + ":" + pad(s % 60);
}
export function fmtHM(secs) {
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60);
  return h > 0 ? h + "h" + pad(m) + "m" : m + "m";
}
export function fmtClock(ts) {
  const d = new Date(ts);
  return pad(d.getHours()) + ":" + pad(d.getMinutes());
}
export function fmtDateJa(key) {
  const d = keyToDate(key);
  return (d.getMonth() + 1) + "月" + d.getDate() + "日（" + DAY_NAMES[d.getDay()] + "）";
}

// "HH:mm" の開始・終了から時刻を作る。終了が開始以前なら翌日扱い
export function clockRange(dateKey, startClock, endClock) {
  if (!startClock || !endClock) return null;
  const base = dayStart(dateKey);
  const [sh, sm] = startClock.split(":").map(Number);
  const [eh, em] = endClock.split(":").map(Number);
  const start = base + (sh * 60 + sm) * 60000;
  let end = base + (eh * 60 + em) * 60000;
  if (end <= start) end += DAY_MS;
  return { start, end };
}

// 日付をまたぐ区間を日ごとに分割する
export function splitByDay(start, end) {
  const out = [];
  let s = start;
  while (s < end) {
    const next = dayStart(addDays(toKey(new Date(s)), 1));
    const e = Math.min(end, next);
    out.push([s, e]);
    s = e;
  }
  return out;
}

// その時刻の翌日 0:00
export function nextMidnight(ts) {
  return dayStart(addDays(toKey(new Date(ts)), 1));
}
