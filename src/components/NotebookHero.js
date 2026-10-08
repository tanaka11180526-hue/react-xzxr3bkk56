import React, { useState } from "react";
import Sheet from "./Sheet";
import { isTaskDone } from "../lib/tasks";
import { dayMessage } from "../lib/dayMessage";
import { PAUSE_LIMIT_MS } from "../lib/constants";
import { fmtHMS, keyToDate, todayKey } from "../lib/time";

// タイマー画面の一番上。机の上のノート（写真）に、合計時間・科目ボタン・計測ボタンを手書き風に重ねる
export default function NotebookHero({ app, dateKey }) {
  const { subjects, timer, timerActions, now, days, logs, getSub, scheduleByDate, matchSubject } = app;
  const [picking, setPicking] = useState(null);
  // 合計と科目ごとの時間は、上の日付で選んだ日の分を出す（計測は常に今日）
  const isToday = !dateKey || dateKey === todayKey();
  const today = days[dateKey || todayKey()] || { total: 0, by: {} };
  const running = timer.mode === "study" || timer.mode === "paused" ? timer.subjectId : null;
  const lastSubject = running
    || (logs.length ? logs.reduce((a, b) => (b.end > a.end ? b : a)).subjectId : null)
    || (subjects[0] && subjects[0].id);
  const cols = subjects.length > 8 ? 3 : 2;

  // 科目の ▷：今日その科目の予定（終わってないもの）が1つならそれとして計る。2つ以上なら選ぶ
  function pressSubject(s) {
    if (running === s.id) return timer.mode === "study" ? timerActions.pause() : timerActions.resume();
    const plans = (scheduleByDate[todayKey()] || []).filter((it) => {
      const sub = matchSubject(it.subject);
      return sub && sub.id === s.id && it.content && !isTaskDone(it);
    });
    if (plans.length === 1) return timerActions.toggleSubject(s.id, plans[0].content);
    if (plans.length > 1) return setPicking({ sub: s, plans });
    timerActions.toggleSubject(s.id);
  }

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
          <CornerDoodle />
          <div className="nh-label">
            <Sparks />
            <span>{isToday ? "合計時間" : fmtMD(dateKey) + "の合計"}</span>
            <Sparks flip />
          </div>
          <div className="nh-oval">{fmtHMS(today.total)}</div>
          {/* 計測中の表示と操作は今日を見ているときだけ。ほかの日はその日のひとことを出す */}
          <div className={"nh-status" + (isToday ? "" : " nh-message")}>{isToday ? status : dayMessage(dateKey, today, getSub)}</div>
          <div className="nh-controls">
            {isToday && controls.map((c) => <button key={c.label} onClick={c.on}>{c.label}</button>)}
          </div>

          <div className={"nh-grid cols-" + cols}>
            {subjects.map((s) => {
              const active = running === s.id;
              const studying = active && timer.mode === "study";
              return (
                <button key={s.id} className={"nh-sub" + (active ? " active" : "")} onClick={() => pressSubject(s)}
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
          <div className="nh-bottom">
            <BooksDoodle steaming={timer.mode === "study"} />
            <CatDoodle awake={timer.mode === "study"} />
          </div>
        </div>
      </div>
    </div>
    {picking && (
      <Sheet title={picking.sub.label + "のどの予定をやる？"} onClose={() => setPicking(null)}>
        {picking.plans.map((p, i) => (
          <button key={i} className="pick-plan" style={{ "--c": picking.sub.color }}
            onClick={() => { timerActions.toggleSubject(picking.sub.id, p.content); setPicking(null); }}>
            {p.category && <span className="plan-cat">{p.category}</span>}
            <span>{p.content}</span>
          </button>
        ))}
        <button className="btn block" onClick={() => { timerActions.toggleSubject(picking.sub.id); setPicking(null); }}>予定なしで計る</button>
      </Sheet>
    )}
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

// 猫の左に積んだ本と、その上のマグカップ。色はわざと線からずらして塗る。勉強中はマグの湯気がゆらぐ
function BooksDoodle({ steaming }) {
  return (
    <svg className={"nh-books" + (steaming ? " steaming" : "")} viewBox="4 -8 56 68" aria-hidden="true">
      <g stroke="none" opacity="0.85">
        <path d="M11 51l45-1 1 8-46 1z" fill="#EBD9B4" />
        <path d="M16 42l39 0 0 8-39 1z" fill="#C9D7B0" />
        <path d="M13 33l42-1 1 8-43 1z" fill="#D5E0EA" />
      </g>
      <g fill="none" stroke="#2F2F2F" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 49.5c14-.6 32-.4 48 .2 M8.5 57.8c16 .4 31 .2 47.5-.4 M9 49.8c-.6 2.6-.5 5.2-.2 8 M55.6 49.4c.5 2.8.4 5.6-.1 8.4" />
        <path d="M13 40.8c13-.4 27-.3 41 .3 M13.2 49.4l-.3-8.3 M54 41c.4 2.6.3 5.6 0 8.6" />
        <path d="M10 31.6c15-.5 30-.5 45 .2 M10.3 40.6c-.4-2.8-.4-5.8-.2-8.8 M55 31.8c.5 2.9.4 5.9 0 8.9" />
        <path d="M16 54h14 M19 45.3h11 M15 36h12" strokeWidth="1" />
        <path d="M5 59.4c18 .2 36 .2 54-.1" strokeWidth="1" />
      </g>
      <g transform="translate(-45.5 -12.4) scale(0.75)">
        <path d="M108 37l20 0-1 17c-1 4-3 5-7 5h-7c-4 0-5-2-5-6z" fill="#FFFDF7" opacity="0.95" />
        <g fill="none" stroke="#2F2F2F" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M105 35.4c8-.4 15-.4 22 .2 M105.4 35.6c-.4 6-.3 12 .4 17.4 .6 3.4 3 5.2 6.4 5.4 3.6.2 7 .2 9.6-.4 3-.8 4.6-3 4.8-6.4.2-5.4.2-10.8.1-16.2" />
          <path d="M127 39.6c5-.6 7.8 1.8 7.6 5-.2 3.2-3.4 5.2-7.6 4.8" />
          <g className="nh-steam" strokeWidth="1.1">
            <path d="M110.5 30c-2.6-3.4 2.4-5.4.2-9" />
            <path d="M116 29c-2.6-3.4 2.4-5.4.2-9" />
            <path d="M121.5 30c-2.6-3.4 2.4-5.4.2-9" />
          </g>
        </g>
      </g>
    </svg>
  );
}

// ノートの左上の落書き（「合格!」の付箋）
function CornerDoodle() {
  return (
    <svg className="nh-corner" viewBox="0 0 60 50" aria-hidden="true">
      <path d="M9 9l36-2 2 32-35 3z" fill="#F7E6A0" stroke="none" transform="translate(1.6 1.4)" />
      <g fill="none" stroke="#2F2F2F" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8.6 8.6c12-.8 24-1.4 36.2-1.8 .6 10.6 1.2 21.4 1.6 32-11.6 .8-23 1.6-34.6 2.6-1-11-2-22-3.2-32.8" />
        <path d="M33.6 40.4c1.4-3.6 4.6-5.4 12.6-1.2" />
      </g>
      <text x="27" y="28.5" textAnchor="middle" fontSize="11.5" fontFamily="Klee One, sans-serif" fill="#2F2F2F" transform="rotate(-4 27 25)">合格!</text>
    </svg>
  );
}

// ノートの右下の猫。ふだんは丸まって寝ていて（Zzz・寝息）、勉強中は起きて目を開け、しっぽを振る
const INK = "#2F2F2F";
const CATS = {
  // 黒白のハチワレ猫。本やマグと同じ描き方（細い黒の手描き線、色は線から少しずらして塗る）
  tuxedo: {
    zzz: { x: 44, y: 14, fill: INK },
    tail: { origin: "78px 56px", el: (
      <g fill="none" strokeLinecap="round">
        <path d="M77 57c9 1 14-3 14.4-10 .2-3.4-1-6-3-7.6" stroke="#3B4560" strokeWidth="4" />
        <path d="M76 55.4c9.4.6 13.6-3.6 14-10 .2-3-1-5.4-2.8-7 M76.4 58.6c10 .6 16.6-4 16.6-12 0-4-1.6-7-4.4-8.8" stroke={INK} strokeWidth="1.3" />
      </g>
    ) },
    body: (
      <>
        <g fill="#3B4560" transform="translate(1.4 1.2)">
          <path d="M40 30c6-5 14-7 22-6 14 2 22 12 21 23-.6 7-4 11-9 12H40z" />
          <path d="M14 46c-1-8 2-14 5-17l1-13 9 8c3-1 7-1 10 0l9-8 1 13c3 3 6 9 5 17-.8 6-5 11-12 12H26c-7-1-11.4-6-12-12z" />
        </g>
        <path d="M21.4 27l.6-6.4 4.4 4z M41.6 24.6l4.4-4 .6 6.4z" fill="#F4A9B4" />
        <path d="M24 48c1.6-3 4.4-4.6 7.6-4.6s6 1.6 7.6 4.6c1.4 3 .6 6-1.6 8.2H25.6c-2.2-2.2-3-5.2-1.6-8.2z" fill="#FFFFFF" />
        <g fill="none" stroke={INK} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M45 28.4c5-3.4 11.4-4.8 17.6-4.2 13.6 1.4 21.4 11.4 20.6 22.4-.6 7.2-4.2 11.6-9.4 12.4H52" />
          <path d="M14.4 46.6c-1.2-8 1.8-14 4.8-17.2l1.2-12.8 8.6 7.6c3.2-1 6.8-1 10.2 0l8.8-7.8.8 13c3.2 3.2 6 9 5 17.2-.8 6.2-5 11-12 12H26.4c-6.8-1-11.4-5.6-12-12z" />
          <path d="M29.6 49c.6 1 1.4 1 2 0 .6 1 1.4 1 2 0" strokeWidth="1.1" />
        </g>
        <path d="M14.6 44.4h5 M43.6 44.4h5 M15 47.2l4.6-.6 M43.6 46.6l4.6.6" stroke="#FFFFFF" strokeWidth="1.1" strokeLinecap="round" />
        {/* 前足：顔の下から少しはみ出す丸い足。指の線を2本 */}
        <g stroke={INK} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16.8 59.2c-.6-3.2 1.4-5.4 4.6-5.4 3.4 0 5.4 2.4 4.8 5.4z M37 59.2c-.6-3.2 1.4-5.4 4.6-5.4 3.4 0 5.4 2.4 4.8 5.4z" fill="#FFFFFF" />
          <path d="M20.2 59v-1.8 M23 59v-1.8 M40.4 59v-1.8 M43.2 59v-1.8" fill="none" strokeWidth=".9" />
        </g>
      </>
    ),
    eyesClosed: <path d="M21 42.4c1.6 1 4.4 1 6 0 M36.4 42.4c1.6 1 4.4 1 6 0" fill="none" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />,
    eyesOpen: <g fill="#FFFFFF"><ellipse cx="24" cy="41.6" rx="1.5" ry="1.9" /><ellipse cx="39.4" cy="41.6" rx="1.5" ry="1.9" /></g>,
  },
};

function CatDoodle({ awake }) {
  const cat = CATS.tuxedo;
  const z = cat.zzz;
  return (
    <svg className={"nh-cat" + (awake ? " awake" : " asleep")} viewBox="0 -12 100 72" aria-hidden="true">
      <g className="cat-body">
        <g className="cat-tail" style={{ transformOrigin: cat.tail.origin }}>{cat.tail.el}</g>
        {cat.body}
        <g className="cat-eyes-closed">{cat.eyesClosed}</g>
        <g className="cat-eyes-open">{cat.eyesOpen}</g>
      </g>
      <g className="cat-zzz" fill={z.fill} fontFamily="Caveat, Klee One, sans-serif" fontWeight="700">
        <text x={z.x} y={z.y} fontSize="8">z</text>
        <text x={z.x + 6} y={z.y - 6} fontSize="10">z</text>
        <text x={z.x + 13} y={z.y - 13} fontSize="12">Z</text>
      </g>
      <path d="M2 59.6c26 .2 56 .2 86-.1" fill="none" stroke={INK} strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}
