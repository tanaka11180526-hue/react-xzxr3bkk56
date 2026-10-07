import React from "react";
import { PAUSE_LIMIT_MS } from "../lib/constants";
import { addDays, dayStart, fmtClock, fmtDateJa, fmtHMS, todayKey } from "../lib/time";
import ScheduleItem from "./ScheduleItem";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const BLOCK_MS = 5 * 60000;

export default function TimerTab({ app }) {
  const { subjects, timer, timerActions, viewDate, setViewDate, days, breakDays, breakColor, scheduleByDate, setEditor } = app;
  const isToday = viewDate === todayKey();
  const day = days[viewDate] || { total: 0, by: {} };
  const breakSecs = (breakDays[viewDate] || { total: 0 }).total;
  const plans = scheduleByDate[viewDate] || [];
  const running = timer.mode === "study" || timer.mode === "paused" ? timer.subjectId : null;

  return (
    <div className="page">
      <div className="date-nav">
        <button className="nav-btn" onClick={() => setViewDate(addDays(viewDate, -1))} aria-label="前の日">‹</button>
        <div className="date-nav-center">
          <div className={"date-nav-label" + (isToday ? " today" : "")}>{fmtDateJa(viewDate)}</div>
          {!isToday && <button className="link-btn" onClick={() => setViewDate(todayKey())}>今日に戻る</button>}
        </div>
        <button className="nav-btn" onClick={() => setViewDate(addDays(viewDate, 1))} disabled={isToday} aria-label="次の日">›</button>
      </div>

      {isToday ? <NowCard app={app} dayTotal={day.total} /> : (
        <div className="card now-card">
          <div className="now-label">この日の合計</div>
          <div className="now-time">{fmtHMS(day.total)}</div>
        </div>
      )}

      {day.total > 0 && (
        <div className="mix-bar">
          {subjects.map((s) => day.by[s.id] ? <div key={s.id} style={{ background: s.color, flex: day.by[s.id] }} /> : null)}
        </div>
      )}

      {plans.length > 0 && (
        <section className="section">
          <div className="section-title">{isToday ? "今日の予定" : "この日の予定"}<span className="muted">（スプレッドシート）</span></div>
          {plans.map((p, i) => <ScheduleItem key={i} app={app} item={p} canStart={isToday} />)}
        </section>
      )}

      <section className="section flush">
        <div className="section-title pad">科目</div>
        {subjects.map((s) => {
          const isRunning = isToday && running === s.id;
          const isPaused = isRunning && timer.mode === "paused";
          const secs = day.by[s.id] || 0;
          return (
            <div key={s.id} className={"subject-row" + (isRunning ? " running" : "")} style={isRunning ? { "--c": s.color } : null}>
              {isToday ? (
                <button className="play-btn" style={{ background: isRunning && !isPaused ? "var(--surface-2)" : s.color }}
                  onClick={() => (isRunning ? (isPaused ? timerActions.resume() : timerActions.pause()) : timerActions.toggleSubject(s.id))} aria-label={(isRunning && !isPaused ? "一時停止 " : "開始 ") + s.label}>
                  {isRunning && !isPaused ? <span className="pause-icon" style={{ borderColor: s.color }} /> : <span className="play-icon" />}
                </button>
              ) : (
                <div className="play-btn static"><span className="dot" style={{ background: secs ? s.color : "var(--border)" }} /></div>
              )}
              <div className="subject-name" style={{ color: isRunning ? s.color : secs ? "var(--text)" : "var(--text-2)" }}>
                {s.label}{isPaused && <span className="tag">一時停止中</span>}
              </div>
              <div className="subject-time" style={{ color: isRunning ? s.color : secs ? "var(--text)" : "var(--muted)" }}>{fmtHMS(secs)}</div>
              <button className="btn ghost small" onClick={() => setEditor({ kind: "study", subjectId: s.id, date: viewDate })} aria-label={s.label + "の時間を手動で追加"}>＋</button>
            </div>
          );
        })}
      </section>

      <Timeline app={app} />

      <div className="legend">
        {subjects.filter((s) => day.by[s.id]).map((s) => (
          <span key={s.id} className="legend-item"><i style={{ background: s.color }} />{s.label}</span>
        ))}
        {breakSecs > 0 && <span className="legend-item"><i style={{ background: breakColor, opacity: 0.6 }} />休憩 {fmtHMS(breakSecs)}</span>}
      </div>
      {isToday && running == null && timer.mode !== "break" && day.total === 0 && (
        <p className="hint">科目の ▶ を押すと計測が始まります。過去の分はタイムラインの空きをタップして追加できます。</p>
      )}
    </div>
  );
}

function NowCard({ app, dayTotal }) {
  const { timer, timerActions, getSub, now, breakColor } = app;
  if (timer.mode === "study") {
    const s = getSub(timer.subjectId);
    return (
      <div className="card now-card" style={{ "--c": s.color }}>
        <div className="now-label accent">計測中・{s.label}</div>
        {timer.task && <div className="now-task">{timer.task}</div>}
        <div className="now-time accent">{fmtHMS((now - timer.start) / 1000)}</div>
        <div className="now-sub">今日の合計 {fmtHMS(dayTotal)}</div>
        <div className="now-actions">
          <button className="btn" onClick={timerActions.pause}>⏸ 一時停止</button>
          <button className="btn" onClick={timerActions.startBreak}>☕ 休憩</button>
          <button className="btn" onClick={timerActions.stop}>■ 終了</button>
        </div>
      </div>
    );
  }
  if (timer.mode === "paused") {
    const s = getSub(timer.subjectId);
    const left = Math.max(0, Math.ceil((PAUSE_LIMIT_MS - (now - timer.pausedAt)) / 1000));
    return (
      <div className="card now-card" style={{ "--c": breakColor }}>
        <div className="now-label accent">一時停止中・{s.label}</div>
        {timer.task && <div className="now-task">{timer.task}</div>}
        <div className="now-time accent">{fmtHMS((timer.pausedAt - timer.start) / 1000)}</div>
        <div className="now-sub">あと{left}秒以内に再開すれば続きとして記録。過ぎると休憩に切り替わります</div>
        <div className="now-actions">
          <button className="btn primary" onClick={timerActions.resume}>▶ 再開</button>
          <button className="btn" onClick={timerActions.stop}>■ 終了</button>
        </div>
      </div>
    );
  }
  if (timer.mode === "break") {
    return (
      <div className="card now-card" style={{ "--c": breakColor }}>
        <div className="now-label accent">☕ 休憩中</div>
        <div className="now-time accent">{fmtHMS((now - timer.start) / 1000)}</div>
        <div className="now-sub">今日の合計 {fmtHMS(dayTotal)}・科目の ▶ で勉強を再開<br />3時間たつと休憩は自動で終わります</div>
        <div className="now-actions">
          <button className="btn" onClick={timerActions.stop}>休憩を終える</button>
        </div>
      </div>
    );
  }
  return (
    <div className="card now-card">
      <div className="now-label">今日の合計</div>
      <div className="now-time">{fmtHMS(dayTotal)}</div>
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
