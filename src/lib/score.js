// 週と日の評価（スコアとランク）。基準は 2026-10-12 版（勉強時間によるランクの上限は 2026-10-13 に追加）。
// 週の基準は日曜21時の週次ふりかえり（定期タスク）と、方針メモ「CPA勉強方針メモ」の「週次スコア(2026-10-12版)」と同じ。
// 日の基準は学習計画の管理側（Claude）から届いたもの。どちらも本人は把握しない前提なので、勝手に変えない。
// 勉強時間は iPhone の記録（休憩は数えない）、予定と復習は「ToDo・実績」から読んだもので計算する。
// 済・〇は今の状態を使うので、あとから付けた分は過去の点数にも入る
import { addDays, dayStart, keyToDate } from "./time";
import { combinePrevDayReviews, isPrevDayReview, isTaskDone } from "./tasks";

export const RANKS = [
  { rank: "S", min: 90 },
  { rank: "A", min: 80 },
  { rank: "B", min: 70 },
  { rank: "C", min: 55 },
  { rank: "D", min: 40 },
  { rank: "E", min: -Infinity },
];
// 評価シールの色（メダル風：S プラチナ・A ゴールド・B シルバー・C ブロンズ・D レギュラー・E くすんだ灰色）。
// 斜めに明るいところと暗いところを入れて金属っぽく見せる。background にそのまま入れる
export const RANK_COLOR = {
  S: "linear-gradient(135deg, #E9F0FF 0%, #A9C1FF 30%, #8E86F0 62%, #6FA8F5 100%)",
  A: "linear-gradient(135deg, #FFF3B0 0%, #F4C93A 40%, #D69E12 75%, #F1CF55 100%)",
  B: "linear-gradient(135deg, #EEF6FB 0%, #B9CCDA 40%, #8EA6B8 75%, #C7D7E3 100%)",
  C: "linear-gradient(135deg, #F5C9A0 0%, #D08A4E 40%, #A8622E 75%, #D59866 100%)",
  D: "linear-gradient(135deg, #F2F2F2 0%, #C9C9C9 40%, #A6A6A6 75%, #D2D2D2 100%)",
  E: "linear-gradient(135deg, #B5ADA4 0%, #8E857B 45%, #6E665E 100%)",
};
export const rankOf = (score) => RANKS.find((r) => score >= r.min).rank;
// 予定が0件の日のランク（点数は出さない）
export const NO_PLAN_RANK = "ー";
RANK_COLOR[NO_PLAN_RANK] = "linear-gradient(135deg, #E4E1DC 0%, #C9C4BC 50%, #B3ADA4 100%)";

// スコアとランクは 2026-10-05 以降の日（と、その日を含む週以降）だけ出す。それより前は勉強時間だけ（2026-10-13 に本人が 10/12 から 10/05 に変えた）
export const SCORE_FROM = "2026-10-05";

// 勉強時間によるランクの上限（2026-10-13 決定）。最終ランクは、点数のランクと上限の低いほう
const DAY_CAP = (h) => (h >= 7 ? "S" : h >= 5 ? "A" : "B");
const WEEK_CAP = (h) => (h >= 49 ? "S" : h >= 35 ? "A" : "B");
const rankIndex = (r) => RANKS.findIndex((x) => x.rank === r);
function withCap(t, cap) {
  const rank = RANKS[Math.max(rankIndex(t.rank), rankIndex(cap))].rank;
  return { ...t, scoreRank: t.rank, cap, rank, capped: rank !== t.rank };
}

const H = 3600;
const STUDY_DAY_SECS = 60; // 休憩以外で1分以上の記録がある日を「勉強した日」とする（評価シールを貼るかどうか）
const RUN_GAP_MS = 60 * 1000; // この間隔以内で続いている勉強の記録は、ひと続き（休憩をはさまない1回分）とみなす

// 月曜はじまりの週の最初の日
export function weekStart(key) {
  return addDays(key, -((keyToDate(key).getDay() + 6) % 7));
}

// 休憩以外で1分以上の記録がある日（記録が全くない日には、日の評価シールを貼らない。週の評価には入れる）
export const studied = (days, k) => ((days[k] && days[k].total) || 0) >= STUDY_DAY_SECS;
const secsOf = (days, k) => (days[k] && days[k].total) || 0;
const planMin = (it) => { const n = parseFloat(it.plan); return n > 0 ? n : 0; };
const minOf = (k1, k2) => (k1 < k2 ? k1 : k2);

// その期間の予定（「ToDo・実績」で日付がその期間の行。復習①〜④は別に数える）
const rowsIn = (items, from, to) => items.filter((it) => !it.review && it.date && it.date >= from && it.date <= to);

// ②予定の消化（計画の分で数える）と③時間の裏付け。予定の計画が0なら null（この項目を除いて換算）
function digest(rows, studySecs) {
  const P = rows.reduce((a, it) => a + planMin(it), 0);
  const D = rows.filter(isTaskDone).reduce((a, it) => a + planMin(it), 0);
  if (!P) return { points: null, P, D, R: null };
  const base = (D / P) * 30;
  const R = D ? (studySecs / 60) / D : null;
  const coef = R === null || R >= 0.6 ? 1 : R / 0.6;
  return { points: base * coef, P, D, R };
}

// その日の終わりの時点で、期限が来ているのに済になっていない復習の数
const missedReviews = (items, asOf) => items.filter((it) => it.review && it.date && it.date <= asOf && !it.done).length;
const reviewPoints = (n) => (n === 0 ? 10 : n === 1 ? 7 : n === 2 ? 4 : 0);

// 項目ごとの点（null は「この項目なし」）を足し、なしの項目を除いた満点を100点に換算して四捨五入
function total(parts) {
  let got = 0, max = 0;
  parts.forEach(([v, m]) => { if (v !== null) { got += v; max += m; } });
  const score = Math.round(max ? (got / max) * 100 : 0);
  return { score, rank: rankOf(score) };
}

// 今週のレポートの「終わったタスク」（表示だけ。点数には使わない）。同じ日の「前日の復習」は1件と数える
function taskCount(rows) {
  const list = combinePrevDayReviews(rows.filter((it) => it.content));
  return { total: list.length, done: list.filter(isTaskDone).length };
}

// ── 週（月〜日）──
// ①勉強時間35 ②予定の消化30（③時間の裏付けを掛ける）④安定15 ⑤復習の取りこぼし10 ⑥遅れの持ち越し10
export function weekScore(mondayKey, { days, items, today }) {
  const sunday = addDays(mondayKey, 6);
  let secs = 0, stableDays = 0;
  for (let k = mondayKey; k <= sunday; k = addDays(k, 1)) {
    secs += secsOf(days, k);
    if (secsOf(days, k) >= 2 * H) stableDays++;
  }
  const T = secs / H;
  const time = Math.min(T / 36, 1) * 35;
  const rows = rowsIn(items, mondayKey, sunday);
  const dg = digest(rows, secs);
  const stable = [0, 0, 0, 3, 6, 10, 13, 15][stableDays];
  const missed = missedReviews(items, minOf(sunday, today));
  const carried = items.filter((it) => !it.review && it.date && it.date < mondayKey && it.content && !isTaskDone(it)).length;
  const carry = carried === 0 ? 10 : carried <= 2 ? 7 : carried <= 4 ? 4 : 0;
  return {
    ...withCap(total([[time, 35], [dg.points, 30], [stable, 15], [reviewPoints(missed), 10], [carry, 10]]), WEEK_CAP(T)),
    detail: { hours: T, P: dg.P, D: dg.D, R: dg.R, stableDays, missed, carried, tasks: taskCount(rows) },
    inProgress: today <= sunday,
    from: mondayKey,
    to: sunday,
  };
}

// その日の一番長いひと続きの勉強（分）。休憩をはさまずに続いている記録（科目を変えた直後など）はつなげて数える
export function longestRun(logs, key) {
  const from = dayStart(key), to = from + 86400000;
  const list = logs.filter((l) => l.start >= from && l.start < to).sort((a, b) => a.start - b.start);
  let best = 0, runStart = null, runEnd = null;
  list.forEach((l) => {
    if (runEnd !== null && l.start - runEnd <= RUN_GAP_MS) runEnd = Math.max(runEnd, l.end);
    else { runStart = l.start; runEnd = l.end; }
    best = Math.max(best, runEnd - runStart);
  });
  return best / 60000;
}

// ── 日 ──
// ①勉強時間35 ②予定の消化30（③時間の裏付けを掛ける）④集中15 ⑤復習の取りこぼし10 ⑥前日の復習10
export function dayScore(key, { days, items, logs = [], today }) {
  const secs = secsOf(days, key);
  const time = Math.min(secs / H / 6, 1) * 35;
  const rows = rowsIn(items, key, key);
  const dg = digest(rows, secs);
  const run = longestRun(logs, key);
  const focus = run >= 90 ? 15 : run >= 60 ? 11 : run >= 45 ? 7 : run >= 30 ? 4 : 0;
  const missed = missedReviews(items, minOf(key, today));
  const prev = rows.filter(isPrevDayReview);
  const prevPoints = prev.length ? (prev.every(isTaskDone) ? 10 : 0) : null;
  // その日の予定（「ToDo・実績」の行と復習①〜④）が0件なら、ランクは「ー」にして点数は出さない
  const noPlan = !items.some((it) => it.date === key);
  const t = withCap(total([[time, 35], [dg.points, 30], [focus, 15], [reviewPoints(missed), 10], [prevPoints, 10]]), DAY_CAP(secs / H));
  return {
    ...t,
    ...(noPlan ? { rank: NO_PLAN_RANK, capped: false, noPlan: true } : {}),
    detail: { hours: secs / H, P: dg.P, D: dg.D, R: dg.R, run, missed, prevDone: prevPoints === null ? null : prevPoints === 10 },
    inProgress: key === today,
  };
}

// 最初に勉強を記録した日（これより前の日には評価を出さない）
export function firstStudyDay(days) {
  const keys = Object.keys(days).filter((k) => studied(days, k)).sort();
  return keys[0] || null;
}
