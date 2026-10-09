import React, { useRef, useState } from "react";
import { DAY_NAMES, fmtDateJa, fmtHM, toKey, todayKey } from "../lib/time";
import { UNKNOWN_COLOR } from "../lib/constants";
import Sheet from "./Sheet";
import ScheduleItem from "./ScheduleItem";

const MAX_CHIPS = 3;
// この時間以上勉強した日に、カレンダーにシールを貼る
const STICKER_SECS = 7 * 3600;
const STICKERS = ["star", "hanamaru", "paw", "heart", "flower", "clover", "crown", "cat", "rainbow", "sun"];

// どのシールを何度傾けて貼るかは、日付から作った乱数で決める（同じ日はいつ開いても同じシール）
function stickerFor(key) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995) >>> 0;
  return { kind: STICKERS[h % STICKERS.length], tilt: ((h >>> 8) % 31) - 15 };
}
// 表示は日曜はじまり（記録タブの「今週」は月曜はじまりのまま）
const WEEK_ORDER = [0, 1, 2, 3, 4, 5, 6];

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
        {WEEK_ORDER.map((i) => <div key={i} className={"cal-dow" + (i === 0 ? " sun" : i === 6 ? " sat" : "")}>{DAY_NAMES[i]}</div>)}
        {Array.from({ length: firstDow }, (_, i) => <div key={"e" + i} />)}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const key = toKey(new Date(year, m, i + 1));
          const dow = (firstDow + i) % 7;
          const plans = scheduleByDate[key] || [];
          const secs = (days[key] || { total: 0 }).total;
          return (
            <button key={key} className={"cal-cell" + (key === today ? " today" : "")} onClick={() => setSelected(key)}>
              {secs >= STICKER_SECS && <Sticker {...stickerFor(key)} />}
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
  const { scheduleByDate, days, subjects, openDay, openReport } = app;
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
      <button className="btn block" onClick={() => { openReport(dateKey); onClose(); }}>📓 この日のレポートを見る</button>
    </Sheet>
  );
}

function Sticker({ kind, tilt }) {
  const ink = { stroke: "#2F2F2F", strokeWidth: 1.1, strokeLinejoin: "round", strokeLinecap: "round" };
  return (
    <svg className="cal-sticker" viewBox="0 0 24 24" style={{ transform: `rotate(${tilt}deg)` }} aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill="#FFFDF7" stroke="#E6DCCB" strokeWidth="1" />
      {kind === "star" && <path d="M12 4.4l2.2 4.6 5 .6-3.7 3.4 1 5-4.5-2.5-4.5 2.5 1-5L4.8 9.6l5-.6z" fill="#F6D58A" {...ink} />}
      {kind === "hanamaru" && <g fill="none" stroke="#E06666" strokeWidth="1.4" strokeLinecap="round"><path d="M7 12c0-3 2.4-5 5-5s5 2 5 5-2.4 5-5 5-5-2-5-5z" /><path d="M5 12c0-4.2 3.2-7.2 7-7.2s7.4 3 7 7.4c-.4 4-3.6 6.8-7.4 6.6" /></g>}
      {kind === "paw" && <g fill="#3B4560"><ellipse cx="12" cy="14.6" rx="4" ry="3.4" /><circle cx="7.6" cy="10" r="1.7" /><circle cx="10.4" cy="7.4" r="1.7" /><circle cx="13.6" cy="7.4" r="1.7" /><circle cx="16.4" cy="10" r="1.7" /></g>}
      {kind === "heart" && <path d="M12 18c-4-3-6.4-5.4-6.4-8 0-2 1.6-3.4 3.4-3.4 1.3 0 2.4.8 3 1.8.6-1 1.7-1.8 3-1.8 1.8 0 3.4 1.4 3.4 3.4 0 2.6-2.4 5-6.4 8z" fill="#F28B9B" {...ink} />}
      {kind === "clover" && <g {...ink} fill="#9CC98A">{[0, 90, 180, 270].map((a) => <path key={a} d="M12 12c-1.6-1.4-4.6-1.8-4.6-4.2 0-1.6 1.4-2.6 2.6-2.4 1 .2 1.6 1 2 2 .4-1 1-1.8 2-2 1.2-.2 2.6.8 2.6 2.4 0 2.4-3 2.8-4.6 4.2z" transform={`rotate(${a} 12 12)`} />)}<path d="M12 12c1 2.4 2.4 4.6 4.4 6.6" fill="none" /></g>}
      {kind === "crown" && <path d="M5.4 16.6l-1-8.4 4.4 3.6L12 6l3.2 5.8 4.4-3.6-1 8.4z M5.6 18.6h12.8" fill="#F6D58A" {...ink} />}
      {kind === "cat" && <g {...ink}><path d="M5.6 18.4c-1-3.4-.4-6.6 1.2-8.6L7 5l3.6 3c1-.3 2-.3 3 0L17 5l.2 4.8c1.6 2 2.2 5.2 1.2 8.6z" fill="#3B4560" /><path d="M9.4 18.4c.4-1.8 1.4-2.8 2.6-2.8s2.2 1 2.6 2.8z" fill="#FFFFFF" stroke="none" /><path d="M8.6 12.6h2 M13.4 12.6h2" stroke="#FFFFFF" strokeWidth="1.2" /><path d="M7.6 6.6l.2 2 1.4-.8z M16.4 6.6l-.2 2-1.4-.8z" fill="#F4A9B4" stroke="none" /></g>}
      {kind === "rainbow" && <g fill="none" strokeLinecap="round" strokeWidth="2"><path d="M4 16a8 8 0 0 1 16 0" stroke="#E06666" /><path d="M6.4 16a5.6 5.6 0 0 1 11.2 0" stroke="#F2C14E" /><path d="M8.8 16a3.2 3.2 0 0 1 6.4 0" stroke="#6CB6E0" /><path d="M3 16.8h5 M16 16.8h5" stroke="#B7C9DC" strokeWidth="2.4" /></g>}
      {kind === "sun" && <g {...ink}><circle cx="12" cy="12" r="4.2" fill="#F2B84B" /><path d="M12 3.4v2.4 M12 18.2v2.4 M3.4 12h2.4 M18.2 12h2.4 M5.9 5.9l1.7 1.7 M16.4 16.4l1.7 1.7 M5.9 18.1l1.7-1.7 M16.4 7.6l1.7-1.7" fill="none" /></g>}
      {kind === "flower" && <g {...ink} fill="#F6C1CC">{[0, 72, 144, 216, 288].map((a) => <ellipse key={a} cx="12" cy="7.6" rx="2.6" ry="3.4" transform={`rotate(${a} 12 12)`} />)}<circle cx="12" cy="12" r="2" fill="#F2C14E" /></g>}
    </svg>
  );
}
