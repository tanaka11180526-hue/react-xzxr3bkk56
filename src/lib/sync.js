// Google スプレッドシート（Apps Script ウェブアプリ）との通信
import { fmtClock, toKey } from "./time";

function withQuery(url, params) {
  const q = Object.entries(params).map(([k, v]) => k + "=" + encodeURIComponent(v)).join("&");
  return url + (url.includes("?") ? "&" : "?") + q;
}

async function readJson(res) {
  if (!res.ok) throw new Error("通信エラー（" + res.status + "）");
  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error("応答を読めませんでした。URLとデプロイ設定を確認してください");
  }
  if (!data.ok) throw new Error(data.error || "エラーが発生しました");
  return data;
}

export async function ping(cfg) {
  await readJson(await fetch(withQuery(cfg.url, { action: "ping", token: cfg.token })));
}

export async function fetchSchedule(cfg) {
  const data = await readJson(await fetch(withQuery(cfg.url, { action: "schedule", token: cfg.token, _: Date.now() }), { cache: "no-store" }));
  return { items: data.items || [], subjects: data.subjects || [] };
}

// Content-Type を text/plain にすると CORS のプリフライトが発生しない
export async function pushLogs(cfg, upsert, remove) {
  const res = await fetch(cfg.url, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ token: cfg.token, action: "logs", upsert, remove }),
  });
  await readJson(res);
}

export function toRow(log, type, subjects) {
  const sub = subjects.find((s) => s.id === log.subjectId);
  return {
    id: log.id,
    type,
    date: toKey(new Date(log.start)),
    start: fmtClock(log.start),
    end: fmtClock(log.end),
    minutes: Math.round((log.end - log.start) / 6000) / 10,
    subject: type === "break" ? "休憩" : sub ? sub.label : "（削除した科目）",
    subjectId: log.subjectId || "",
    task: log.task || "",
    manual: !!log.manual,
  };
}

export function isConfigured(cfg) {
  return !!(cfg && cfg.url && cfg.token);
}
