import React, { useState } from "react";
import { DAY_NAMES, addDays, keyToDate, todayKey } from "../lib/time";
import { useSwipe } from "../lib/swipe";
import { SCORE_FROM, dayScore, firstStudyDay, RANK_COLOR, studied, weekScore, weekStart } from "../lib/score";
import { ClockDoodle, SubjectTimes, SunDoodle, fmtSpaced } from "./DailyReport";
import RankStamp from "./RankStamp";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const short = (key) => { const d = keyToDate(key); return MONTHS[d.getMonth()] + " " + d.getDate(); };

// 今週のレポート（月曜〜日曜）。今日のレポートと同じノート風で、週の評価・毎日の時間・科目のトップ3を出す
export default function WeeklyReport({ app, onClose }) {
  const { days, breakDays, subjects, schedule } = app;
  const today = todayKey();
  const thisWeek = weekStart(today);
  const [from, setFrom] = useState(thisWeek);
  const isThisWeek = from === thisWeek;
  const go = (n) => { const next = addDays(from, 7 * n); if (next <= thisWeek) setFrom(next); };
  const swipe = useSwipe(() => go(-1), () => go(1));

  const keys = Array.from({ length: 7 }, (_, i) => addDays(from, i));
  const ctx = { days, items: schedule.items || [], logs: app.scoreLogs, today };
  const first = firstStudyDay(days);
  const rated = (k) => first && k >= first && k >= SCORE_FROM && k <= today && studied(days, k);
  const score = first && addDays(from, 6) >= first && from >= SCORE_FROM ? weekScore(from, ctx) : null;

  let total = 0, breakSecs = 0;
  const bySub = {};
  keys.forEach((k) => {
    const d = days[k];
    breakSecs += (breakDays[k] && breakDays[k].total) || 0;
    if (!d) return;
    total += d.total;
    Object.entries(d.by).forEach(([id, s]) => { bySub[id] = (bySub[id] || 0) + s; });
  });
  const max = Math.max(1, ...keys.map((k) => (days[k] ? days[k].total : 0)));
  const ranked = subjects.filter((s) => bySub[s.id]).sort((a, b) => bySub[b.id] - bySub[a.id]);

  return (
    <div className="report-overlay" onClick={onClose}>
      <div className="report-wrap" onClick={(e) => e.stopPropagation()} ref={swipe}>
        <div className="report-nav">
          <button className="nav-btn" onClick={() => go(-1)} aria-label="前の週">‹</button>
          <button className="btn small ghost" onClick={onClose}>閉じる</button>
          <button className="nav-btn" onClick={() => go(1)} disabled={isThisWeek} aria-label="次の週">›</button>
        </div>

        <div className="desk">
          <div className="notebook">
            <div className="page-paper rp-weekly">
              <div className="rp-head">
                <SunDoodle />
                <h2 className="rp-title">WEEKLY REPORT</h2>
              </div>
              <div className="rp-date">{short(from)} – {short(keys[6])}</div>

              <div className="rp-total">
                <ClockDoodle />
                <div>
                  <div className="rp-label">TOTAL STUDY TIME</div>
                  <div className="rp-big"><span className="marker">{fmtSpaced(total)}</span></div>
                </div>
                {score && <RankStamp score={score} />}
              </div>

              <span className="rp-tag tag-blue">EVERY DAY</span>
              <div className="rw-days">
                {keys.map((k) => {
                  const secs = days[k] ? days[k].total : 0;
                  const s = rated(k) ? dayScore(k, ctx) : null;
                  const dow = keyToDate(k).getDay();
                  return (
                    <div key={k} className="rw-day">
                      <div className="rw-bar-area">
                        {secs > 0 && <div className="rw-bar" style={{ height: Math.max(4, (secs / max) * 100) + "%" }} />}
                      </div>
                      <span className={"rw-dow" + (dow === 0 ? " sun" : dow === 6 ? " sat" : "")}>{DAY_NAMES[dow]}</span>
                      <span className="rw-time">{secs > 0 ? (secs / 3600).toFixed(1) + "h" : "—"}</span>
                      {s ? <span className={"rw-rank" + (s.inProgress ? " now" : "")} style={{ "--c": RANK_COLOR[s.rank] }}>{s.rank}</span> : <span className="rw-rank none" />}
                    </div>
                  );
                })}
              </div>

            </div>
          </div>
        </div>

        <div className="report-extra">
          <div className="report-stats">
            {score && <div><span>2時間以上の日</span><b>{score.detail.stableDays}日</b></div>}
            {score && <div><span>終わったタスク</span><b>{score.detail.tasks.total ? score.detail.tasks.done + "/" + score.detail.tasks.total + "件" : "予定なし"}</b></div>}
            {score && <div><span>取りこぼした復習</span><b>{score.detail.missed}件</b></div>}
            <div><span>休憩</span><b>{fmtSpaced(breakSecs)}</b></div>
          </div>
          <SubjectTimes list={ranked.map((s) => ({ s, secs: bySub[s.id] }))} />
        </div>
      </div>
    </div>
  );
}
