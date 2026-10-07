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

  // 計測中だけ出す小さな操作ボタン（開始は科目の ▷ から）
  let controls = [];
  if (timer.mode === "study") controls = [
    { label: "⏸ 一時停止", on: timerActions.pause },
    { label: "☕ 休憩", on: timerActions.startBreak },
    { label: "■ 終了", on: timerActions.stop },
  ];
  else if (timer.mode === "paused") controls = [
    { label: "▶ 再開", on: timerActions.resume },
    { label: "☕ すぐ休憩にする", on: timerActions.stop },
  ];
  else if (timer.mode === "break") controls = [
    { label: "▶ 勉強を再開", on: () => lastSubject && timerActions.toggleSubject(lastSubject) },
    { label: "■ 休憩を終える", on: timerActions.stop },
  ];

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
          <div className="nh-controls">
            {controls.map((c) => <button key={c.label} onClick={c.on}>{c.label}</button>)}
          </div>

          <DeskDoodle steaming={timer.mode === "study"} />

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

// 机の上の落書き（本・マグカップ・鉛筆・観葉植物）。勉強中はマグの湯気がゆらぐ
function DeskDoodle({ steaming }) {
  return (
    <svg className={"nh-doodle" + (steaming ? " steaming" : "")} viewBox="0 0 240 64" aria-hidden="true">
      <g fill="none" stroke="#2B2B2B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        {/* 積んだ本 */}
        <rect x="22" y="48" width="58" height="10" rx="1.5" fill="#E9D7B5" />
        <rect x="28" y="38" width="50" height="10" rx="1.5" fill="#C6D4AE" />
        <rect x="24" y="28" width="54" height="10" rx="1.5" fill="#D9E3EC" />
        <path d="M30 53h20M35 43h16M31 33h18" strokeWidth="1.1" />
        {/* 鉛筆 */}
        <path d="M86 57l38-8" />
        <path d="M86 57l3.2 2.6 36-7.6-1.2-3" fill="#F6C76B" />
        <path d="M86 57l-4 1.6 4.4 1.4" />
        {/* マグカップ */}
        <path d="M138 34h26v18a6 6 0 0 1-6 6h-14a6 6 0 0 1-6-6z" fill="#FBF8F1" />
        <path d="M164 38h4a5 5 0 0 1 0 10h-4" />
        <path d="M143 44h16" strokeWidth="1.1" />
        <g className="nh-steam">
          <path d="M145 28c-3-4 3-6 0-10" />
          <path d="M151 28c-3-4 3-6 0-10" />
          <path d="M157 28c-3-4 3-6 0-10" />
        </g>
        {/* 観葉植物 */}
        <path d="M190 44h24l-3 14h-18z" fill="#E9D7B5" />
        <path d="M202 44V26" />
        <path d="M202 34c-8 0-12-5-12-11 7 0 12 4 12 11z" fill="#C6D4AE" />
        <path d="M202 30c7 0 11-5 11-11-7 0-11 4-11 11z" fill="#C6D4AE" />
        <path d="M202 26c-3-5-1-10 0-12 2 3 3 8 0 12z" fill="#C6D4AE" />
        {/* 机の線 */}
        <path d="M8 60.5h224" strokeWidth="1.2" strokeDasharray="1 4" />
      </g>
    </svg>
  );
}
