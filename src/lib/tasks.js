import { toKey } from "./time";

function commonPrefix(a, b) {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

// 計測したあとでシートの「やること」が書き換えられたとき、記録の「やること」も今のシートに合わせる。
// 同じ日・同じ科目の予定のうち、書き出しが4文字以上同じものが1つだけあるときだけ付け替える
export function syncTaskNames(logs, items, matchSubject) {
  const byDay = {};
  items.forEach((it) => {
    if (!it.content) return;
    const sub = matchSubject(it.subject);
    if (!sub) return;
    const k = it.date + "|" + sub.id;
    (byDay[k] = byDay[k] || []).push(it.content);
  });
  const changed = [];
  const next = logs.map((l) => {
    if (!l.task) return l;
    const cands = byDay[toKey(new Date(l.start)) + "|" + l.subjectId];
    if (!cands || cands.includes(l.task)) return l;
    const close = cands.filter((c) => commonPrefix(c, l.task) >= 4);
    if (close.length !== 1) return l;
    changed.push(l.id);
    return { ...l, task: close[0] };
  });
  return { next, changed };
}

// シートの「達成」列でこれが付いていたら終わったタスク（復習は済チェック）
const DONE_MARK = /^(〇|○|◯|済|✓|✔|完)/;
export function isTaskDone(it) {
  return it.review ? !!it.done : DONE_MARK.test(String(it.achieved || "").trim());
}

// 毎日入れている「前日の復習」の予定（「やること」の書き出しで見分ける。科目の「その他」はほかでも使うため）。
// その日の予定の一番下に並べる
export const PREV_DAY_REVIEW = "前日の復習";
export function isPrevDayReview(it) {
  return String(it.content || "").trim().startsWith(PREV_DAY_REVIEW);
}
// 同じ日の中で「前日の復習」を後ろに回す並べ方（ほかは元の順のまま）
export const prevDayReviewLast = (a, b) => isPrevDayReview(a) - isPrevDayReview(b);
// 2026-10-12 から論点ごとに1行ずつ入る（例：「前日の復習(10/11分): 財計 新リース 前半7割」）。
// アプリでは1つのまとまりにして出し、押すと中の論点が開く
const PREV_DAY_REVIEW_HEAD = /^前日の復習\s*(?:[（(]([^）)]*)[）)])?\s*[:：]?\s*/;
export function prevDayReviewTopic(it) {
  const s = String(it.content || "").trim();
  return s.replace(PREV_DAY_REVIEW_HEAD, "") || s;
}
export function prevDayReviewTitle(list) {
  const m = String((list[0] && list[0].content) || "").trim().match(PREV_DAY_REVIEW_HEAD);
  return PREV_DAY_REVIEW + (m && m[1] ? "（" + m[1] + "）" : "");
}

// 答練の予定（「ToDo・実績」の分類が「答練」の行）。カレンダーでは「答練」の切り替えのほうにだけ出す
export function isExamPlan(it) {
  return !it.review && String(it.category || "").trim() === "答練";
}
// カレンダーの札に出す短い名前（論文上級答練1 → 上級1、論文直前答練2 → 直前2、論文模擬試験1 → 模試1、レギュラー答練3 → レギュ3）
export function examShort(content) {
  const s = String(content || "").trim();
  const m = s.match(/(\d+)\s*$/);
  const n = m ? m[1] : "";
  if (s.includes("上級")) return "上級" + n;
  if (s.includes("直前")) return "直前" + n;
  if (s.includes("模擬") || s.includes("模試")) return "模試" + n;
  if (s.includes("レギュラー")) return "レギュ" + n;
  return s.slice(0, 4);
}
