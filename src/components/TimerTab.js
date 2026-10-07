import React from "react";
import { addDays, dayStart, fmtClock, fmtDateJa, fmtHMS, todayKey } from "../lib/time";
import ScheduleItem from "./ScheduleItem";
import NotebookHero from "./NotebookHero";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const BLOCK_MS = 5 * 60000;

export default function TimerTab({ app }) {
  const { subjects, viewDate, setViewDate, days, breakDays, breakColor, scheduleByDate, setEditor } = app;
  const today = todayKey();
  const isToday = viewDate === today;
  const day = days[viewDate] || { total: 0, by: {} };
  const breakSecs = (breakDays[viewDate] || { total: 0 }).total;
  const todayPlans = scheduleByDate[today] || [];
  const dayPlans = isToday ? [] : scheduleByDate[viewDate] || [];
  const studied = subjects.filter((s) => day.by[s.id]).sort((a, b) => day.by[b.id] - day.by[a.id]);

  return (
    <div className="page">
      <div className="date-nav top-date-nav">
        <button className="nav-btn" onClick={() => setViewDate(addDays(viewDate, -1))} aria-label="前の日">‹</button>
        <div className="date-nav-center">
          <div className={"date-nav-label" + (isToday ? " today" : "")}>{fmtDateJa(viewDate)}</div>
          {!isToday && <button className="link-btn" onClick={() => setViewDate(today)}>今日に戻る</button>}
        </div>
        <button className="nav-btn" onClick={() => setViewDate(addDays(viewDate, 1))} disabled={isToday} aria-label="次の日">›</button>
      </div>

      <NotebookHero app={app} dateKey={viewDate} />

      {todayPlans.length > 0 && (
        <section className="card section">
          <div className="section-title">今日の予定<span className="muted">（スプレッドシート）</span></div>
          {todayPlans.map((p, i) => <ScheduleItem key={i} app={app} item={p} canStart />)}
        </section>
      )}

      <section className="card section">
        <div className="section-title">{isToday ? "今日" : fmtDateJa(viewDate)}の記録</div>
        <div className="day-total">合計 <b>{fmtHMS(day.total)}</b>{breakSecs > 0 && <span className="muted">・休憩 {fmtHMS(breakSecs)}</span>}</div>
        {day.total > 0 && (
          <div className="mix-bar">
            {studied.map((s) => <div key={s.id} style={{ background: s.color, flex: day.by[s.id] }} />)}
          </div>
        )}
        {studied.length > 0 && (
          <div className="by-subject">
            {studied.map((s) => (
              <div key={s.id} className="by-subject-row"><i style={{ background: s.color }} /><span>{s.label}</span><b>{fmtHMS(day.by[s.id])}</b></div>
            ))}
          </div>
        )}

        {dayPlans.length > 0 && (
          <>
            <div className="section-title">この日の予定</div>
            {dayPlans.map((p, i) => <ScheduleItem key={i} app={app} item={p} canStart={false} />)}
          </>
        )}

        <Timeline app={app} />
        {breakSecs > 0 && (
          <div className="legend"><span className="legend-item"><i style={{ background: breakColor, opacity: 0.6 }} />休憩</span></div>
        )}
        <button className="btn block" onClick={() => setEditor({ kind: "study", subjectId: subjects[0] && subjects[0].id, date: viewDate })}>＋ 時間を手動で追加</button>
      </section>
    </div>
  );
}

function Timeline({ app }) {
  const { logs, breaks, viewDate, getSub, breakColor, setEditor, timer, now, subjects } = app;
  const base = dayStart(viewDate);
  const end = base + 86400000;
  const dayLogs = logs.filter((l) => l.start < end && l.end > base);
  const dayBreaks = breaks.filter((l) => l.start < end && l.end > base);
  const live = timer.mode === "study" ? { subjectId: timer.subjectId, start: timer.start, end: now, live: true }
    : timer.mode === "paused" ? { subjectId: timer.subjectId, start: timer.start, end: timer.pausedAt, live: true } : null;
  const liveBreak = timer.mode === "break" ? { start: timer.start, end: now, live: true } : null;
  const currentHour = viewDate === todayKey() ? new Date(now).getHours() : -1;

  function blockAt(bs) {
    const be = bs + BLOCK_MS;
    const hit = (l) => l.start < be && l.end > bs;
    if (liveBreak && hit(liveBreak)) return { color: breakColor, isBreak: true, log: liveBreak };
    for (let i = dayBreaks.length - 1; i >= 0; i--) if (hit(dayBreaks[i])) return { color: breakColor, isBreak: true, log: dayBreaks[i] };
    if (live && hit(live)) return { color: getSub(live.subjectId).color, log: live };
    for (let i = dayLogs.length - 1; i >= 0; i--) if (hit(dayLogs[i])) return { color: getSub(dayLogs[i].subjectId).color, log: dayLogs[i] };
    return null;
  }

  function onBlock(b, bs) {
    if (b && b.log.live) return;
    if (b) setEditor({ kind: b.isBreak ? "break" : "study", id: b.log.id });
    else setEditor({ kind: "study", subjectId: subjects[0] && subjects[0].id, date: viewDate, start: fmtClock(bs) });
  }

  return (
    <section className="section">
      <div className="section-title">タイムライン<span className="muted">（1マス5分・タップで編集／追加）</span></div>
      <div className="timeline">
        {HOURS.map((h) => {
          const blocks = Array.from({ length: 12 }, (_, i) => base + h * 3600000 + i * BLOCK_MS);
          return (
            <div key={h} className={"tl-row" + (h === currentHour ? " current" : "")}>
              <div className="tl-hour">{h}</div>
              <div className="tl-blocks">
                {blocks.map((bs) => {
                  const b = blockAt(bs);
                  return <button key={bs} className={"tl-block" + (b ? " filled" : "")} onClick={() => onBlock(b, bs)}
                    style={b ? { background: b.isBreak ? b.color + "99" : b.color } : null} aria-label={fmtClock(bs)} />;
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
