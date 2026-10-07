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
  return { items: data.items || [], subjects: data.subjects || [], version: data.version || 0 };
}

// Content-Type を text/plain にすると CORS のプリフライトが発生しない
async function post(cfg, action, payload) {
  const res = await fetch(cfg.url, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ token: cfg.token, action, ...payload }),
  });
  return readJson(res);
}

export async function pushLogs(cfg, upsert, remove) {
  await post(cfg, "logs", { upsert, remove });
}

// ここから下はスクリプトの版 6 以上で使える
export const FEATURE_VERSION = 6;

// 予定を「終わった」にする／戻す（シートの達成 H列、または復習の済チェックだけを書き換える）
export async function pushDone(cfg, item, value) {
  await post(cfg, "done", { row: item.row, reviewIndex: item.review ? item.reviewIndex : null, date: item.date, content: item.src, value });
}

// レポートの「ひとこと」を「アプリメモ」タブに送る
export async function pushNotes(cfg, notes) {
  await post(cfg, "notes", { notes });
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
