// 週と日の評価（スコアとランク）。週の基準は 2026-10-11 に決めたもの（日曜21時の週次ふりかえりと同じ）。
// 勉強時間は iPhone の記録（休憩は数えない）、タスクと復習は「ToDo・実績」から読んだ予定で計算する。
// 済・〇は今の状態を使うので、あとから付けた分は過去の点数にも入る
import { addDays, keyToDate } from "./time";
import { isTaskDone } from "./tasks";

export const RANKS = [
  { rank: "S", min: 90 },
  { rank: "A", min: 80 },
  { rank: "B", min: 65 },
  { rank: "C", min: 50 },
  { rank: "D", min: 35 },
  { rank: "E", min: -Infinity },
];
// 評価シールの色（S は虹色）。background にそのまま入れる
export const RANK_COLOR = {
  S: "linear-gradient(135deg, #E5484D 0%, #F5A524 22%, #F2D43D 40%, #5DB55B 58%, #3E8EDE 76%, #8B5CF6 100%)",
  A: "#D9443B",
  B: "#3E7CC9",
  C: "#8CBF3F",
  D: "#EE8A2E",
  E: "#8B5A3C",
};
export const rankOf = (score) => RANKS.find((r) => score >= r.min).rank;

const STUDY_DAY_SECS = 60; // 休憩以外で1分以上の記録がある日を「勉強した日」とする
const H = 3600;

// 月曜はじまりの週の最初の日
export function weekStart(key) {
  return addDays(key, -((keyToDate(key).getDay() + 6) % 7));
}

const studied = (days, k) => ((days[k] && days[k].total) || 0) >= STUDY_DAY_SECS;

// その期間の予定（「やること」が入っている行。科目は問わない。復習は別に数える）
function tasksIn(items, from, to) {
  const rows = items.filter((it) => !it.review && it.content && it.date >= from && it.date <= to);
  return { total: rows.length, done: rows.filter(isTaskDone).length };
}

// その日の終わりの時点で、期限が来ているのに済になっていない復習の数
function missedReviews(items, asOf) {
  return items.filter((it) => it.review && it.date && it.date <= asOf && !it.done).length;
}
const reviewPoints = (n) => (n === 0 ? 10 : n === 1 ? 5 : 0);

// 4項目を足す。予定が0件なら、タスクを除いた60点満点を100点に換算する
function total(parts) {
  const { time, task, review, streak } = parts;
  const raw = task === null ? ((time + review + streak) / 60) * 100 : time + task + review + streak;
  const score = Math.round(raw);
  return { score, rank: rankOf(score) };
}

export function weekScore(mondayKey, { days, items, today }) {
  const sunday = addDays(mondayKey, 6);
  let secs = 0, studiedDays = 0;
  for (let k = mondayKey; k <= sunday; k = addDays(k, 1)) {
    secs += (days[k] && days[k].total) || 0;
    if (studied(days, k)) studiedDays++;
  }
  const T = secs / H;
  const time = T >= 42 ? 40 : T >= 35 ? 33 + ((T - 35) / 7) * 7 : (T / 35) * 33;
  const tasks = tasksIn(items, mondayKey, sunday);
  const task = tasks.total ? (tasks.done / tasks.total) * 40 : null;
  const missed = missedReviews(items, sunday);
  const review = reviewPoints(missed);
  const streak = studiedDays >= 7 ? 10 : studiedDays === 6 ? 7 : studiedDays === 5 ? 4 : 0;
  return {
    ...total({ time, task, review, streak }),
    parts: { time, task, review, streak },
    detail: { hours: T, tasks, missed, studiedDays },
    inProgress: today <= sunday,
    from: mondayKey,
    to: sunday,
  };
}

export function dayScore(key, { days, items, today }) {
  const t = ((days[key] && days[key].total) || 0) / H;
  const time = t >= 6 ? 40 : t >= 5 ? 33 + (t - 5) * 7 : (t / 5) * 33;
  const tasks = tasksIn(items, key, key);
  const task = tasks.total ? (tasks.done / tasks.total) * 40 : null;
  const missed = missedReviews(items, key);
  const review = reviewPoints(missed);
  let run = 0;
  for (let k = key; studied(days, k); k = addDays(k, -1)) run++;
  const streak = run >= 7 ? 10 : run >= 3 ? 5 : 0;
  return {
    ...total({ time, task, review, streak }),
    parts: { time, task, review, streak },
    detail: { hours: t, tasks, missed, run },
    inProgress: key === today,
  };
}

// 最初に勉強を記録した日（これより前の日には評価を出さない）
export function firstStudyDay(days) {
  const keys = Object.keys(days).filter((k) => studied(days, k)).sort();
  return keys[0] || null;
}
