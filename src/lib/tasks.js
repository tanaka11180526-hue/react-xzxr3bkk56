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
