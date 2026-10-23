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
    if (!it.content || isPrevDayReview(it)) return; // 前日の復習は「前日の復習(10/14分)」で計るので付け替えない
    const sub = matchSubject(it.subject);
    if (!sub) return;
    const k = it.date + "|" + sub.id;
    (byDay[k] = byDay[k] || []).push(it.content);
  });
  const changed = [];
  const next = logs.map((l) => {
    if (!l.task || isPrevDayReview({ content: l.task })) return l;
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

// 2026-10-15 から、同じ日の「前日の復習」の行はアプリでは1つの予定として扱う（シートは論点ごとの行のまま）。
// やることは「前日の復習(10/14分)」、計画は行の合計、✓ は全部の行に〇を付ける／外す、▶開始もこの名前で計る
const PREV_DAY_REVIEW_DATE = /^前日の復習\s*[（(]\s*(\d{1,2}\/\d{1,2})\s*分/;
export function prevDayReviewTask(content) {
  const m = String(content || "").trim().match(PREV_DAY_REVIEW_DATE);
  return m ? PREV_DAY_REVIEW + "(" + m[1] + "分)" : PREV_DAY_REVIEW;
}
// 予定の一覧の中で、同じ日の「前日の復習」の行を1つの予定にまとめる（最初の行の位置に置く）。
// まとめた予定は parts に元の行を持つ。終わった判定は「全部の行が済」
export function combinePrevDayReviews(items) {
  const byDate = {};
  items.forEach((it) => { if (!it.review && isPrevDayReview(it)) (byDate[it.date] = byDate[it.date] || []).push(it); });
  const out = [];
  items.forEach((it) => {
    if (it.review || !isPrevDayReview(it)) return out.push(it);
    const parts = byDate[it.date];
    if (parts[0] !== it) return;
    const plan = parts.reduce((s, p) => s + (parseFloat(p.plan) || 0), 0);
    out.push({
      date: it.date, category: it.category, subject: it.subject, content: prevDayReviewTask(it.content),
      plan: plan || "", achieved: parts.every(isTaskDone) ? "〇" : "", row: it.row, parts,
    });
  });
  return out;
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

// 遅れ：今日より前の日の予定で、まだ済でないもの（答練は除く。日付の古い順）。scheduleByDate は前日の復習を1件にまとめたもの。
// 今日の予定の上に「遅れ」のまとまりとして出し、今日の画面から ✓ や ▷ ができるようにする（2026-10-23 から。点数は今まで通り元の日に入る）
export function overdueItems(scheduleByDate, today, from) {
  return Object.keys(scheduleByDate).filter((k) => k < today && (!from || k >= from)).sort()
    .flatMap((k) => scheduleByDate[k].filter((it) => it.content && !isExamPlan(it) && !isTaskDone(it)));
}
