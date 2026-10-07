import React, { useRef, useState } from "react";
import { DAY_NAMES, fmtDateJa, fmtHM, toKey, todayKey } from "../lib/time";
import { UNKNOWN_COLOR } from "../lib/constants";
import Sheet from "./Sheet";
import ScheduleItem from "./ScheduleItem";

const MAX_CHIPS = 3;

export default function CalendarTab({ app }) {
  const { days, scheduleByDate, matchSubject, configured, schedule, scheduleState, refreshSchedule } = app;
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [selected, setSelected] = useState(null);
  const touch = useRef(null);
  const year = month.getFullYear(), m = month.getMonth();
  const firstDow = new Date(year, m, 1).getDay();
  const daysInMonth = new Date(year, m + 1, 0).getDate();
  const today = todayKey();
  const move = (dir) => setMonth(new Date(year, m + dir, 1));

  function onTouchStart(e) {
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY };
  }
  function onTouchEnd(e) {
    if (!touch.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touch.current.x, dy = t.clientY - touch.current.y;
    touch.current = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) move(dx < 0 ? 1 : -1);
  }

  return (
    <div className="page">
      <SyncStatus configured={configured} schedule={schedule} state={scheduleState} onRefresh={refreshSchedule} />

      <div className="date-nav">
        <button className="nav-btn" onClick={() => move(-1)} aria-label="前の月">‹</button>
        <div className="date-nav-center">
          <div className="date-nav-label">{year}年 {m + 1}月</div>
        </div>
        <button className="nav-btn" onClick={() => move(1)} aria-label="次の月">›</button>
      </div>

      <div className="cal" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {DAY_NAMES.map((d, i) => <div key={d} className={"cal-dow" + (i === 0 ? " sun" : i === 6 ? " sat" : "")}>{d}</div>)}
        {Array.from({ length: firstDow }, (_, i) => <div key={"e" + i} />)}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const key = toKey(new Date(year, m, i + 1));
          const dow = (firstDow + i) % 7;
          const plans = scheduleByDate[key] || [];
          const secs = (days[key] || { total: 0 }).total;
          return (
            <button key={key} className={"cal-cell" + (key === today ? " today" : "")} onClick={() => setSelected(key)}>
              <span className={"cal-day" + (dow === 0 ? " sun" : dow === 6 ? " sat" : "")}>{i + 1}</span>
              {secs > 0 && <span className="cal-secs">{fmtHM(secs)}</span>}
              {plans.slice(0, MAX_CHIPS).map((p, j) => {
                const sub = matchSubject(p.subject);
                return <span key={j} className="cal-chip" style={{ background: sub ? sub.color : UNKNOWN_COLOR }}>{p.content || p.subject}</span>;
              })}
              {plans.length > MAX_CHIPS && <span className="cal-more">+{plans.length - MAX_CHIPS}</span>}
            </button>
          );
        })}
      </div>
      <p className="hint center">左右にスワイプで月を移動・日付をタップで詳細</p>

      {selected && <DaySheet app={app} dateKey={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function SyncStatus({ configured, schedule, state, onRefresh }) {
  if (!configured) {
    return <div className="banner">予定を表示するには ⚙️ 設定から スプレッドシートとつないでください</div>;
  }
  const at = schedule.at ? new Date(schedule.at) : null;
  return (
    <div className={"banner" + (state.status === "error" ? " error" : "")}>
      <span>
        {state.status === "loading" ? "予定を読み込み中…"
          : state.status === "error" ? "予定を読み込めませんでした：" + state.message
          : at ? "予定の更新：" + (at.getMonth() + 1) + "/" + at.getDate() + " " + String(at.getHours()).padStart(2, "0") + ":" + String(at.getMinutes()).padStart(2, "0")
          : "予定はまだ読み込んでいません"}
      </span>
      <button className="btn small" onClick={onRefresh} disabled={state.status === "loading"}>↻ 更新</button>
    </div>
  );
}

function DaySheet({ app, dateKey, onClose }) {
  const { scheduleByDate, days, subjects, openDay } = app;
  const plans = scheduleByDate[dateKey] || [];
  const day = days[dateKey] || { total: 0, by: {} };
  const canStart = dateKey === todayKey();
  return (
    <Sheet title={fmtDateJa(dateKey)} onClose={onClose}>
      <div className="section-title">予定</div>
      {plans.length ? plans.map((p, i) => <ScheduleItem key={i} app={app} item={p} canStart={canStart} />)
        : <p className="empty">この日の予定はありません</p>}

      <div className="section-title">勉強した時間<span className="muted">合計 {fmtHM(day.total)}</span></div>
      {day.total > 0 ? (
        <div className="by-subject">
          {subjects.filter((s) => day.by[s.id]).map((s) => (
            <div key={s.id} className="by-subject-row"><i style={{ background: s.color }} /><span>{s.label}</span><b>{fmtHM(day.by[s.id])}</b></div>
          ))}
        </div>
      ) : <p className="empty">記録はありません</p>}

      <button className="btn block" onClick={() => { openDay(dateKey); onClose(); }}>この日のタイムラインを開く</button>
    </Sheet>
  );
}
