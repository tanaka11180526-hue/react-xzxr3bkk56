import React from "react";
import { PAUSE_LIMIT_MS } from "../lib/constants";
import { fmtHMS, keyToDate, todayKey } from "../lib/time";

// タイマー画面の一番上。机の上のノート（写真）に、合計時間・科目ボタン・計測ボタンを手書き風に重ねる
export default function NotebookHero({ app, dateKey }) {
  const { subjects, timer, timerActions, now, days, logs, getSub } = app;
  // 合計と科目ごとの時間は、上の日付で選んだ日の分を出す（計測は常に今日）
  const isToday = !dateKey || dateKey === todayKey();
  const today = days[dateKey || todayKey()] || { total: 0, by: {} };
  const running = timer.mode === "study" || timer.mode === "paused" ? timer.subjectId : null;
  const lastSubject = running
    || (logs.length ? logs.reduce((a, b) => (b.end > a.end ? b : a)).subjectId : null)
    || (subjects[0] && subjects[0].id);
  const cols = subjects.length > 8 ? 3 : 2;

  let status;
  if (timer.mode === "study") status = <><b>{getSub(timer.subjectId).label}</b> 計測中 {fmtHMS((now - timer.start) / 1000)}</>;
  else if (timer.mode === "paused") status = <>一時停止中・あと{Math.max(0, Math.ceil((PAUSE_LIMIT_MS - (now - timer.pausedAt)) / 1000))}秒で休憩に</>;
  else if (timer.mode === "break") status = <>☕ 休憩中 {fmtHMS((now - timer.start) / 1000)}</>;
  else status = <>科目の ▷ を押すと計測が始まるで</>;

  let main;
  if (timer.mode === "study") main = { icon: "pause", label: "一時停止", on: timerActions.pause };
  else if (timer.mode === "paused") main = { icon: "play", label: "再開", on: timerActions.resume };
  else main = { icon: "play", label: timer.mode === "break" ? "勉強を再開" : "計測スタート", on: () => lastSubject && timerActions.toggleSubject(lastSubject) };

  return (
    <div className="hero-frame">
    <div className="desk hero-desk">
      <div className="notebook">
        <div className="nh-frame">
          <div className="nh-label">
            <Sparks />
            <span>{isToday ? "合計時間" : fmtMD(dateKey) + "の合計"}</span>
            <Sparks flip />
          </div>
          <div className="nh-oval">{fmtHMS(today.total)}</div>
          <div className="nh-status">{status}</div>

          <div className={"nh-grid cols-" + cols}>
            {subjects.map((s) => {
              const active = running === s.id;
              const studying = active && timer.mode === "study";
              return (
                <button key={s.id} className={"nh-sub" + (active ? " active" : "")} onClick={() => timerActions.toggleSubject(s.id)}
                  aria-label={(studying ? "一時停止 " : "開始 ") + s.label}>
                  <span className="nh-circle" style={active ? { background: "#2B2B2B" } : null}>
                    {studying ? <PauseMark /> : <PlayMark filled={active} />}
                  </span>
                  <span className="nh-name">
                    <span className="nh-hl" style={{ "--hl": s.color + "8C" }}>{s.label}</span>
                    <small>{today.by[s.id] ? fmtShort(today.by[s.id]) : "\u00a0"}</small>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="nh-actions">
            <button className="nh-main" onClick={main.on} aria-label={main.label}>
              <Rays />
              <svg className="nh-main-icon" viewBox="0 0 20 20" aria-hidden="true">
                {main.icon === "pause"
                  ? <path d="M7 4.5 V15.5 M13 4.5 V15.5" stroke="#2B2B2B" strokeWidth="2.6" strokeLinecap="round" />
                  : <path d="M6 4 L16 10 L6 16 Z" fill="#2B2B2B" />}
              </svg>
              <span>{main.label}</span>
              <Rays flip />
            </button>
            {timer.mode !== "idle" && (
              <div className="nh-sublinks">
                {timer.mode === "study" && <button onClick={timerActions.startBreak}>☕ 休憩</button>}
                <button onClick={timerActions.stop}>■ 終了</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}

function fmtMD(key) {
  const d = keyToDate(key);
  return d.getMonth() + 1 + "/" + d.getDate();
}

function fmtShort(secs) {
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60);
  return h ? h + ":" + String(m).padStart(2, "0") : m + "分";
}

function PlayMark({ filled }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M7 5.5 L15 10 L7 14.5 Z" fill={filled ? "#FBF8F1" : "none"} stroke={filled ? "#FBF8F1" : "#2B2B2B"} strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

function PauseMark() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M7.5 5.5 V14.5 M12.5 5.5 V14.5" stroke="#FBF8F1" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

function Sparks({ flip }) {
  return (
    <svg className="nh-sparks" viewBox="0 0 20 20" style={flip ? { transform: "scaleX(-1)" } : null} aria-hidden="true">
      <path d="M4 5 L10 7 M2 11 H9 M4 17 L10 14" stroke="#2B2B2B" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function Rays({ flip }) {
  return (
    <svg className="nh-rays" viewBox="0 0 24 40" style={flip ? { transform: "scaleX(-1)" } : null} aria-hidden="true">
      <path d="M18 4 L8 10 M20 20 H4 M18 36 L8 30" stroke="#2B2B2B" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
