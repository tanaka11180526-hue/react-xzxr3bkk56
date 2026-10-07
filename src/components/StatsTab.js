import React, { useState } from "react";
import { DAY_NAMES, addDays, fmtHM, keyToDate, todayKey } from "../lib/time";
import { STREAK_MIN_SECS } from "../lib/constants";

const RANGES = [7, 14, 30];

function calcStreak(days, today) {
  const has = (k) => days[k] && days[k].total >= STREAK_MIN_SECS;
  const todayDone = has(today);
  let streak = 0;
  for (let k = todayDone ? today : addDays(today, -1); has(k); k = addDays(k, -1)) streak++;
  const keys = Object.keys(days).filter(has).sort();
  let longest = 0, cur = 0;
  keys.forEach((k, i) => {
    cur = i > 0 && addDays(keys[i - 1], 1) === k ? cur + 1 : 1;
    longest = Math.max(longest, cur);
  });
  return { streak, longest, todayDone };
}

export default function StatsTab({ app }) {
  const { days, subjects, examDate, setExamDate, openReport } = app;
  const [range, setRange] = useState(7);
  const [editingExam, setEditingExam] = useState(false);
  const today = todayKey();
  const { streak, longest, todayDone } = calcStreak(days, today);
  const graphDays = Array.from({ length: range }, (_, i) => addDays(today, i - range + 1));
  const max = Math.max(1, ...graphDays.map((k) => (days[k] ? days[k].total : 0)));
  const rangeTotal = graphDays.reduce((sum, k) => sum + (days[k] ? days[k].total : 0), 0);
  const daysLeft = examDate ? Math.ceil((keyToDate(examDate) - keyToDate(today)) / 86400000) : null;

  return (
    <div className="page">
      <button className="report-cta" onClick={() => openReport(today)}>
        <span>📓</span><span><b>今日のレポート</b><small>ノート風にまとめて見る</small></span><span>›</span>
      </button>
      <div className="stat-grid">
        <div className={"card stat" + (streak > 0 ? " good" : "")}>
          <div className="stat-label">{streak > 0 ? "🔥 連続" : "💤 連続"}</div>
          <div className="stat-value">{streak}<small>日</small></div>
          <div className="stat-sub">{streak > 0 ? (todayDone ? "今日も継続中" : "今日10分やれば継続") : "今日から再スタート"}・最長 {longest}日<br />1日10分以上で連続に数えます</div>
        </div>
        <div className="card stat">
          <div className="stat-label">📝 試験日まで</div>
          {examDate && !editingExam ? (
            <button className="stat-btn" onClick={() => setEditingExam(true)}>
              <div className="stat-value">{daysLeft >= 0 ? daysLeft : "—"}<small>日</small></div>
              <div className="stat-sub">{examDate.replace(/-/g, "/")}・タップで変更</div>
            </button>
          ) : (
            <div className="exam-edit">
              <input type="date" defaultValue={examDate} onChange={(e) => e.target.value && setExamDate(e.target.value)} />
              {examDate && <button className="btn small" onClick={() => setEditingExam(false)}>OK</button>}
            </div>
          )}
        </div>
      </div>

      <section className="section">
        <div className="section-head">
          <div className="section-title">勉強時間<span className="muted">{range}日間で {fmtHM(rangeTotal)}</span></div>
          <div className="seg">
            {RANGES.map((n) => <button key={n} className={range === n ? "on" : ""} onClick={() => setRange(n)}>{n}日</button>)}
          </div>
        </div>
        <div className="card graph">
          <div className="bars" style={{ gap: range === 30 ? 2 : range === 14 ? 4 : 8 }}>
            {graphDays.map((k) => {
              const d = days[k] || { total: 0, by: {} };
              const dt = keyToDate(k), dow = dt.getDay();
              const label = range === 7 ? DAY_NAMES[dow] : range === 14 ? dt.getDate() : dt.getDate() % 5 === 0 ? dt.getDate() : "";
              return (
                <div key={k} className="bar-col" title={k + " " + fmtHM(d.total)}>
                  <div className="bar-area">
                    {d.total > 0 ? (
                      <div className="bar" style={{ height: Math.max(4, (d.total / max) * 100) + "%" }}>
                        {subjects.map((s) => d.by[s.id] ? <div key={s.id} style={{ flex: d.by[s.id], background: s.color }} /> : null)}
                      </div>
                    ) : <div className="bar-empty" />}
                  </div>
                  <div className={"bar-label" + (k === today ? " today" : dow === 0 ? " sun" : dow === 6 ? " sat" : "")}>{label}</div>
                </div>
              );
            })}
          </div>
          <div className="graph-foot">最大 {fmtHM(max)}／日</div>
          <div className="by-subject">
            {subjects.map((s) => {
              const total = graphDays.reduce((sum, k) => sum + ((days[k] && days[k].by[s.id]) || 0), 0);
              return total ? (
                <div key={s.id} className="by-subject-row"><i style={{ background: s.color }} /><span>{s.label}</span><b>{fmtHM(total)}</b></div>
              ) : null;
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
