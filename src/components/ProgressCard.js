import React, { useState } from "react";
import { addDays, fmtHM, keyToDate, toKey, todayKey } from "../lib/time";
import { isTaskDone } from "../lib/tasks";

const LIST_MAX = 8;

function periodOf(kind, today) {
  const d = keyToDate(today);
  if (kind === "week") {
    const from = addDays(today, -((d.getDay() + 6) % 7)); // 月曜はじまり
    return { from, to: addDays(from, 6) };
  }
  return { from: toKey(new Date(d.getFullYear(), d.getMonth(), 1)), to: toKey(new Date(d.getFullYear(), d.getMonth() + 1, 0)) };
}

const md = (key) => { const d = keyToDate(key); return d.getMonth() + 1 + "/" + d.getDate(); };

// 計画の時間ではなく、タスクが終わったかどうかで進み具合を見る
export default function ProgressCard({ app }) {
  const { schedule, logs, days, subjects, matchSubject, canMarkDone, markDone } = app;
  const [kind, setKind] = useState("week");
  const today = todayKey();
  const { from, to } = periodOf(kind, today);

  const tasks = (schedule.items || [])
    .filter((it) => it.date >= from && it.date <= to && it.content)
    .map((it) => ({ ...it, sub: matchSubject(it.subject), done: isTaskDone(it) }))
    .filter((t) => t.sub)
    .sort((a, b) => a.date.localeCompare(b.date));
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
              <div key={s.id} className="pg-row">
                <i style={{ background: s.color }} />
                <span className="pg-name">{s.label}</span>
                <span className="pg-mini">{total ? <><b>{n}</b>/{total}件</> : "予定なし"}</span>
                <span className="pg-time">{fmtHM(secs)}</span>
              </div>
            ))}
          </div>
        )}

        {late.length > 0 && (
          <>
            <div className="section-title pg-title">遅れてるタスク</div>
            {late.slice(0, LIST_MAX).map((t, i) => (
              <div key={i} className="pg-task">
                <span className="pg-date">{md(t.date)}</span>
                <i style={{ background: t.sub.color }} />
                <span className="pg-content">{t.content}</span>
                {canMarkDone && t.row && <button className="done-btn" onClick={() => markDone(t, true)} aria-label="終わった">✓</button>}
              </div>
            ))}
            {late.length > LIST_MAX && <div className="pg-more">ほか {late.length - LIST_MAX}件</div>}
          </>
        )}

        {done.length > 0 && (
          <>
            <div className="section-title pg-title">終わったタスク<span className="muted">計画 → かかった時間</span></div>
            {done.slice(-LIST_MAX).reverse().map((t, i) => {
              const plan = parseFloat(t.plan);
              const fromApp = Math.round(spentOf(t));
              const sheet = parseFloat(t.actual);
              const spent = fromApp || (sheet > 0 ? sheet : 0);
              const diff = plan > 0 && spent > 0 ? spent - plan : null;
              return (
                <div key={i} className="pg-task">
                  <span className="pg-date">{md(t.date)}</span>
                  <i style={{ background: t.sub.color }} />
                  <span className="pg-content">{t.content}</span>
                  <span className="pg-spent">
                    {plan > 0 ? plan + "分" : "—"} → {spent > 0 ? spent + "分" : "記録なし"}
                    {!fromApp && spent > 0 && <small>（シート）</small>}
                    {diff !== null && diff < 0 && <em className="pg-fast">{-diff}分早い</em>}
                  </span>
                </div>
              );
            })}
            {done.length > LIST_MAX && <div className="pg-more">ほか {done.length - LIST_MAX}件</div>}
          </>
        )}
        <p className="hint">終わったかどうかはシートの「達成」と復習の済チェックで数えます（予定の ✓ で付けられます）。時間がかからず終わったタスクも1件は1件です</p>
      </div>
    </section>
  );
}
