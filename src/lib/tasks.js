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
const PREV_DAY_REVIEW = "前日の復習";
export function isPrevDayReview(it) {
  return String(it.content || "").trim().startsWith(PREV_DAY_REVIEW);
}
// 同じ日の中で「前日の復習」を後ろに回す並べ方（ほかは元の順のまま）
export const prevDayReviewLast = (a, b) => isPrevDayReview(a) - isPrevDayReview(b);
