import React, { useState } from "react";
import { DAY_NAMES, addDays, dayStart, fmtHM, keyToDate, todayKey } from "../lib/time";
import { RECORDS_FROM, STREAK_MIN_SECS } from "../lib/constants";
import ProgressCard from "./ProgressCard";
import RotationCard from "./RotationCard";
import ExamPage, { ExamButton } from "./ExamCard";
import WeeklyReport from "./WeeklyReport";

const RANGES = [7, 14, 30];
const fmtMD = (key) => { const d = keyToDate(key); return d.getMonth() + 1 + "/" + d.getDate(); };

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
  const { days, subjects, logs, openReport } = app;
  const [range, setRange] = useState(7);
  const [examsOpen, setExamsOpen] = useState(false);
  const [weekOpen, setWeekOpen] = useState(false);
  const today = todayKey();
  const { streak, longest, todayDone } = calcStreak(days, today);
  const graphDays = Array.from({ length: range }, (_, i) => addDays(today, i - range + 1));
  const max = Math.max(1, ...graphDays.map((k) => (days[k] ? days[k].total : 0)));
  const rangeTotal = graphDays.reduce((sum, k) => sum + (days[k] ? days[k].total : 0), 0);
  // 累計：止めた記録だけを足す（計測中の分は止めたときに増える）。平均は記録を始めた日から今日までの日数で割る
  const total = logs.reduce((sum, l) => sum + (l.start >= dayStart(RECORDS_FROM) ? Math.max(0, l.end - l.start) / 1000 : 0), 0);
  const sinceDays = Math.max(1, Math.round((keyToDate(today) - keyToDate(RECORDS_FROM)) / 86400000) + 1);

  return (
    <div className="page">
      <button className="report-cta" onClick={() => openReport(today)}>
        <span>📓</span><span><b>今日のレポート</b><small>ノート風にまとめて見る</small></span><span>›</span>
      </button>
      <button className="report-cta" onClick={() => setWeekOpen(true)}>
        <span>🗓️</span><span><b>今週のレポート</b><small>1週間（月〜日）をまとめて見る</small></span><span>›</span>
      </button>
      {weekOpen && <WeeklyReport app={app} onClose={() => setWeekOpen(false)} />}
      <ExamButton app={app} onOpen={() => setExamsOpen(true)} />
      {examsOpen && <ExamPage app={app} onClose={() => setExamsOpen(false)} />}
      <div className="stat-grid">
        <div className={"card stat" + (streak > 0 ? " good" : "")}>
          <div className="stat-label">{streak > 0 ? "🔥 連続" : "💤 連続"}</div>
          <div className="stat-value">{streak}<small>日</small></div>
          <div className="stat-sub">{streak > 0 ? (todayDone ? "今日も継続中" : "今日10分やれば継続") : "今日から再スタート"}・最長 {longest}日<br />1日10分以上で連続に数えます</div>
        </div>
        <div className="card stat">
          <div className="stat-label">⏱ 累計</div>
          <div className="stat-value">{Math.floor(total / 3600)}<small>時間</small>{Math.floor((total % 3600) / 60)}<small>分</small></div>
          <div className="stat-sub">{fmtMD(RECORDS_FROM)} から<br />1日平均 {(total / 3600 / sinceDays).toFixed(1)}時間</div>
        </div>
      </div>

      <RotationCard app={app} />

      <ProgressCard app={app} />

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
