import React, { useState } from "react";
import Sheet from "./Sheet";
import { isTaskDone } from "../lib/tasks";
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
          <div className="nh-status">{status}</div>
          <div className="nh-controls">
            {controls.map((c) => <button key={c.label} onClick={c.on}>{c.label}</button>)}
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
            <CatDoodle awake={timer.mode === "study"} />
            <DeskDoodle steaming={timer.mode === "study"} />
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

// ノートの右下の落書き（本・鉛筆・マグカップ・観葉植物）。色はわざと線からずらして塗る。勉強中はマグの湯気がゆらぐ
function DeskDoodle({ steaming }) {
  return (
    <svg className={"nh-doodle" + (steaming ? " steaming" : "")} viewBox="0 0 180 64" aria-hidden="true">
      {/* 色（線から少しずらす） */}
      <g stroke="none" opacity="0.85">
        <path d="M11 51l45-1 1 8-46 1z" fill="#EBD9B4" />
        <path d="M16 42l39 0 0 8-39 1z" fill="#C9D7B0" />
        <path d="M13 33l42-1 1 8-43 1z" fill="#D5E0EA" />
        <path d="M66 58l27-6 1 3-27 6z" fill="#F4CB78" />
        <path d="M108 37l20 0-1 17c-1 4-3 5-7 5h-7c-4 0-5-2-5-6z" fill="#FFFDF7" />
        <path d="M146 47l20 0-3 12h-14z" fill="#EBD9B4" />
        <path d="M157 38c-6 0-9-4-9-9 6 0 9 3 9 9z M157 34c6 0 9-4 9-9-6 0-9 3-9 9z" fill="#C9D7B0" />
      </g>
      {/* 線（ちょっとはみ出す・すき間がある手描き風） */}
      <g fill="none" stroke="#2F2F2F" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 49.5c14-.6 32-.4 48 .2 M8.5 57.8c16 .4 31 .2 47.5-.4 M9 49.8c-.6 2.6-.5 5.2-.2 8 M55.6 49.4c.5 2.8.4 5.6-.1 8.4" />
        <path d="M13 40.8c13-.4 27-.3 41 .3 M13.2 49.4l-.3-8.3 M54 41c.4 2.6.3 5.6 0 8.6" />
        <path d="M10 31.6c15-.5 30-.5 45 .2 M10.3 40.6c-.4-2.8-.4-5.8-.2-8.8 M55 31.8c.5 2.9.4 5.9 0 8.9" />
        <path d="M16 54h14 M19 45.3h11 M15 36h12" strokeWidth="1" />
        <path d="M62 60.5l30-6.6 M63 57.2l29.4-6.4 M92.3 50.8c1 1 1.4 2.1.3 3.2 M62.6 57.2l-3.6 2.2 3.4 1.2" />
        <path d="M105 35.4c8-.4 15-.4 22 .2 M105.4 35.6c-.4 6-.3 12 .4 17.4 .6 3.4 3 5.2 6.4 5.4 3.6.2 7 .2 9.6-.4 3-.8 4.6-3 4.8-6.4.2-5.4.2-10.8.1-16.2" />
        <path d="M127 39.6c5-.6 7.8 1.8 7.6 5-.2 3.2-3.4 5.2-7.6 4.8" />
        <g className="nh-steam" strokeWidth="1.1">
          <path d="M110.5 30c-2.6-3.4 2.4-5.4.2-9" />
          <path d="M116 29c-2.6-3.4 2.4-5.4.2-9" />
          <path d="M121.5 30c-2.6-3.4 2.4-5.4.2-9" />
        </g>
        <path d="M143 45.6c8-.4 15.6-.4 23.6.3 M143.4 45.8l3.4 13.4c4.4.4 9 .4 13.4-.2l3.8-13.2" />
        <path d="M155 45.4c.4-5.4.2-11 0-17.6" />
        <path d="M155 37c-7 .6-10.6-4.2-10.4-9.4 6.4-.2 10.2 3.2 10.4 9.4z" />
        <path d="M155.2 32.6c6.6.4 10.4-4.2 10.2-9.6-6.2 0-10 3.4-10.2 9.6z" />
        <path d="M155 27.8c-2.6-4-1.4-8.6.2-11 1.8 2.6 2.4 7.4-.2 11z" />
        <path d="M4 61.6c20 .6 52 .2 80-.4 M98 61.4c26 .4 50 .2 72-.6" strokeWidth="1" />
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

// ノートの左下の猫。ふだんは丸まって寝ていて（Zzz・寝息）、勉強中は起きて目を開け、しっぽを振る
const INK = "#2F2F2F";
const CATS = {
  // 黒白のハチワレ猫（イラスト風の太めのグレーの線）
  tuxedo: {
    zzz: { x: 44, y: 14, fill: "#3A3F55" },
    tail: { origin: "62px 52px", el: <path d="M62 52c8 1 14-3 15-10 .6-4-1-7.4-3.6-9.4" fill="none" stroke="#8C8C8C" strokeWidth="2" strokeLinecap="round" /> },
    body: (
      <>
        <g fill="#28304A" stroke="#8C8C8C" strokeWidth="2.2" strokeLinejoin="round">
          <path d="M40 30c6-5 14-7 22-6 14 2 22 12 21 23-.6 7-4 11-9 12H40z" />
          <path d="M14 46c-1-8 2-14 5-17l1-13 9 8c3-1 7-1 10 0l9-8 1 13c3 3 6 9 5 17-.8 6-5 11-12 12H26c-7-1-11.4-6-12-12z" />
        </g>
        <path d="M21.4 27l.6-6.4 4.4 4z M41.6 24.6l4.4-4 .6 6.4z" fill="#F4A9B4" />
        <path d="M24 48c1.6-3 4.4-4.6 7.6-4.6s6 1.6 7.6 4.6c1.4 3 .6 6-1.6 8.2H25.6c-2.2-2.2-3-5.2-1.6-8.2z" fill="#FFFFFF" />
        <path d="M18 58.4c-.6-2.6 1-4.8 3.8-4.8s4.4 2.2 3.8 4.8 M38 58.4c-.6-2.6 1-4.8 3.8-4.8s4.4 2.2 3.8 4.8" fill="#FFFFFF" stroke="#8C8C8C" strokeWidth="1.6" />
        <path d="M29.6 49c.6 1 1.4 1 2 0 .6 1 1.4 1 2 0" fill="none" stroke="#3A3F55" strokeWidth="1.1" strokeLinecap="round" />
        <path d="M14.6 44.4h5 M43.6 44.4h5 M15 47.2l4.6-.6 M43.6 46.6l4.6.6" stroke="#FFFFFF" strokeWidth="1.1" strokeLinecap="round" />
      </>
    ),
    eyesClosed: <path d="M21 42.4h6 M36.4 42.4h6" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" />,
    eyesOpen: <g fill="#FFFFFF"><ellipse cx="24" cy="41.6" rx="1.6" ry="2" /><ellipse cx="39.4" cy="41.6" rx="1.6" ry="2" /></g>,
  },
};

function CatDoodle({ awake }) {
  const cat = CATS.tuxedo;
  const z = cat.zzz;
  return (
    <svg className={"nh-cat" + (awake ? " awake" : " asleep")} viewBox="0 -12 90 76" aria-hidden="true">
      <g className="cat-body">
        {cat.body}
        <g className="cat-eyes-closed">{cat.eyesClosed}</g>
        <g className="cat-eyes-open">{cat.eyesOpen}</g>
        <g className="cat-tail" style={{ transformOrigin: cat.tail.origin }}>{cat.tail.el}</g>
      </g>
      <g className="cat-zzz" fill={z.fill} fontFamily="Caveat, Klee One, sans-serif" fontWeight="700">
        <text x={z.x} y={z.y} fontSize="8">z</text>
        <text x={z.x + 6} y={z.y - 6} fontSize="10">z</text>
        <text x={z.x + 13} y={z.y - 13} fontSize="12">Z</text>
      </g>
      <path d="M2 61.4c26 .6 56 .4 86-.4" fill="none" stroke={INK} strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}
