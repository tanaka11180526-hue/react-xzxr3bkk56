import React, { useState } from "react";
import { DAY_NAMES, addDays, fmtHM, keyToDate, toKey, todayKey } from "../lib/time";
import { combinePrevDayReviews, isTaskDone, prevDayReviewLast } from "../lib/tasks";

const LIST_MAX = 10;
const LISTS = [
  { id: "left", label: "これから" },
  { id: "late", label: "遅れ" },
  { id: "done", label: "終わった" },
];

function periodOf(kind, today) {
  const d = keyToDate(today);
  if (kind === "week") {
    const from = addDays(today, -((d.getDay() + 6) % 7)); // 月曜はじまり
    return { from, to: addDays(from, 6) };
  }
  return { from: toKey(new Date(d.getFullYear(), d.getMonth(), 1)), to: toKey(new Date(d.getFullYear(), d.getMonth() + 1, 0)) };
}

const md = (key) => { const d = keyToDate(key); return d.getMonth() + 1 + "/" + d.getDate(); };
const mdw = (key) => md(key) + "（" + DAY_NAMES[keyToDate(key).getDay()] + "）";

// 計画の時間ではなく、タスクが終わったかどうかで進み具合を見る
export default function ProgressCard({ app }) {
  const { schedule, logs, days, subjects, matchSubject, canMarkDone, markDone } = app;
  const [kind, setKind] = useState("week");
  const [list, setList] = useState("left");
  const [only, setOnly] = useState(null); // 科目で絞り込み
  const [more, setMore] = useState(false);
  const today = todayKey();
  const { from, to } = periodOf(kind, today);

  // 同じ日の「前日の復習」は1件（全部の行が済で「終わった」）
  const tasks = combinePrevDayReviews((schedule.items || []).filter((it) => it.date >= from && it.date <= to && it.content))
    .map((it) => ({ ...it, sub: matchSubject(it.subject), done: isTaskDone(it) }))
    .filter((t) => t.sub)
    .sort((a, b) => a.date.localeCompare(b.date) || prevDayReviewLast(a, b)); // 同じ日の「前日の復習」は一番下
  const done = tasks.filter((t) => t.done);
  const late = tasks.filter((t) => !t.done && t.date < today);
  const left = tasks.filter((t) => !t.done && t.date >= today);

  // その予定から計った時間（予定の「開始」で計った分）
  const spentOf = (t) => logs
    .filter((l) => l.subjectId === t.sub.id && l.task === t.content)
    .reduce((s, l) => s + (l.end - l.start) / 60000, 0);

  let studySecs = 0;
  const bySub = {};
  for (let k = from; k <= to; k = addDays(k, 1)) {
    const d = days[k];
    if (!d) continue;
    studySecs += d.total;
    Object.entries(d.by).forEach(([id, s]) => { bySub[id] = (bySub[id] || 0) + s; });
  }

  const rows = subjects.map((s) => {
    const mine = tasks.filter((t) => t.sub.id === s.id);
    return { s, total: mine.length, done: mine.filter((t) => t.done).length, secs: bySub[s.id] || 0 };
  }).filter((r) => r.total || r.secs);

  const pct = tasks.length ? Math.round((done.length / tasks.length) * 100) : 0;

  const pick = (arr) => (only ? arr.filter((t) => t.sub.id === only) : arr);
  // 終わったものは新しい日から。同じ日の中では「前日の復習」を一番下のままにする
  const lists = { left: pick(left), late: pick(late), done: pick(done).slice().sort((a, b) => b.date.localeCompare(a.date) || prevDayReviewLast(a, b)) };
  const current = lists[list];
  const units = current.map((t) => ({ date: t.date, t }));
  const shown = more ? units : units.slice(0, LIST_MAX);
  const shownCount = shown.length;

  return (
    <section className="section">
      <div className="section-head">
        <div className="section-title">進み具合<span className="muted">{md(from)}〜{md(to)}</span></div>
        <div className="seg">
          <button className={kind === "week" ? "on" : ""} onClick={() => setKind("week")}>今週</button>
          <button className={kind === "month" ? "on" : ""} onClick={() => setKind("month")}>今月</button>
        </div>
      </div>
      <div className="card progress">
        {tasks.length ? (
          <>
            <div className="pg-head">
              <div className="pg-count">終わったタスク <b>{done.length}</b><small> / {tasks.length}件</small></div>
              <div className="pg-pct">{pct}%</div>
            </div>
            <div className="pg-bar"><i style={{ width: pct + "%" }} /></div>
            <div className="pg-sub">
              {late.length > 0 && <span className="pg-late">遅れ {late.length}件</span>}
              <span>残り {left.length}件</span>
              <span>勉強時間 {fmtHM(studySecs)}</span>
            </div>
          </>
        ) : <p className="empty">この期間の予定はまだありません（勉強時間 {fmtHM(studySecs)}）</p>}

        {rows.length > 0 && (
          <div className="pg-subjects">
            {rows.map(({ s, total, done: n, secs }) => (
              <button key={s.id} className={"pg-row" + (only === s.id ? " on" : only ? " dim" : "")}
                onClick={() => { setOnly(only === s.id ? null : s.id); setMore(false); }}>
                <i style={{ background: s.color }} />
                <span className="pg-name">{s.label}</span>
                <span className="pg-mini">{total ? <><b>{n}</b>/{total}件</> : "予定なし"}</span>
                <span className="pg-time">{fmtHM(secs)}</span>
              </button>
            ))}
            <div className="pg-tip">{only ? "もう一回押すと全部の科目に戻ります" : "科目を押すと、その科目のタスクだけ出します"}</div>
          </div>
        )}

        {tasks.length > 0 && (
          <>
            <div className="seg pg-lists">
              {LISTS.map((l) => (
                <button key={l.id} className={list === l.id ? "on" : ""} onClick={() => { setList(l.id); setMore(false); }}>
                  {l.label} {lists[l.id].length}
                </button>
              ))}
            </div>
            {shown.length === 0 && <p className="empty">{list === "left" ? "これからのタスクはありません" : list === "late" ? "遅れてるタスクはありません" : "終わったタスクはまだありません"}</p>}
            {shown.map((u, i) => {
              const head = list !== "done" && (i === 0 || shown[i - 1].date !== u.date);
              const key = u.date + u.t.row + (u.t.reviewIndex ?? "") + u.t.content;
              return (
                <React.Fragment key={key}>
                  {head && <div className={"pg-day" + (u.date === today ? " today" : "")}>{u.date === today ? "今日・" + mdw(u.date) : mdw(u.date)}</div>}
                  <TaskRow t={u.t} list={list} spent={list === "done" ? spentOf(u.t) : 0} canMarkDone={canMarkDone} markDone={markDone} />
                </React.Fragment>
              );
            })}
            {current.length > shownCount && (
              <button className="pg-more" onClick={() => setMore(true)}>もっと見る（ほか {current.length - shownCount}件）</button>
            )}
          </>
        )}
        <p className="hint">終わったかどうかはシートの「達成」と復習の済チェックで数えます（予定の ✓ で付けられます）。時間がかからず終わったタスクも1件は1件です</p>
      </div>
    </section>
  );
}

// inGroup：「前日の復習」のまとまりの中（日付と科目は見出しでわかるので出さない）
function TaskRow({ t, list, spent, canMarkDone, markDone, label, inGroup }) {
  const plan = parseFloat(t.plan);
  const fromApp = Math.round(spent);
  const sheet = parseFloat(t.actual);
  const used = fromApp || (sheet > 0 ? sheet : 0);
  const diff = plan > 0 && used > 0 ? used - plan : null;
  return (
    <div className={"pg-task" + (t.done ? " is-done" : "")}>
      {list === "done" && !inGroup && <span className="pg-date">{md(t.date)}</span>}
      {canMarkDone && t.row ? (
        <button className={"done-btn" + (t.done ? " on" : "")} onClick={() => markDone(t, !t.done)}
          aria-label={t.done ? "終わったを取り消す" : "終わった"}>{t.done ? "✓" : ""}</button>
      ) : <i style={{ background: t.sub.color }} />}
      <span className="pg-content">
        {!inGroup && <span className="pg-subj" style={{ color: t.sub.color }}>{t.sub.label}</span>}{label || t.content}
      </span>
      {list === "done" ? (
        <span className="pg-spent">
          {plan > 0 ? plan + "分" : "—"} → {used > 0 ? used + "分" : "記録なし"}
          {!fromApp && used > 0 && <small>（シート）</small>}
          {diff !== null && diff < 0 && <em className="pg-fast">{-diff}分早い</em>}
        </span>
      ) : plan > 0 && <span className="pg-plan">{plan}分</span>}
    </div>
  );
}
