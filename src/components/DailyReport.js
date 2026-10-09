import React, { useState } from "react";
import { DAY_NAMES, addDays, keyToDate, todayKey } from "../lib/time";
import { STREAK_MIN_SECS } from "../lib/constants";
import { useSwipe } from "../lib/swipe";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fmtSpaced(secs) {
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60);
  return h > 0 ? h + "h " + m + "m" : m + "m";
}

// その日を含めて、さかのぼって何日続いているか
function streakAt(days, key) {
  let n = 0;
  for (let k = key; days[k] && days[k].total >= STREAK_MIN_SECS; k = addDays(k, -1)) n++;
  return n;
}

// ノート風の1日のまとめ
export default function DailyReport({ app, dateKey, onClose }) {
  const { days, breakDays, subjects, getSub, logs, notes, setNote } = app;
  const [key, setKey] = useState(dateKey);
  const [editing, setEditing] = useState(false);
  const isToday = key === todayKey();
  const day = days[key] || { total: 0, by: {} };
  const breakSecs = (breakDays[key] || { total: 0 }).total;
  const d = keyToDate(key);
  const ranked = subjects.filter((s) => day.by[s.id]).sort((a, b) => day.by[b.id] - day.by[a.id]);
  const top = ranked.slice(0, 3);
  const streak = streakAt(days, key);

  // 予定から計った分（やったこと）
  const dayStart = d.getTime(), dayEnd = dayStart + 86400000;
  const taskMap = {};
  logs.filter((l) => l.task && l.start >= dayStart && l.start < dayEnd).forEach((l) => {
    const k = l.subjectId + "|" + l.task;
    taskMap[k] = taskMap[k] || { subjectId: l.subjectId, task: l.task, secs: 0 };
    taskMap[k].secs += Math.floor((l.end - l.start) / 1000);
  });
  const tasks = Object.values(taskMap).sort((a, b) => b.secs - a.secs);
  const note = notes[key] || "";
  // ページ全体で横にスライドすると日付を動かす（今日より先には行かない。ひとことを書いている間は動かさない）
  const swipe = useSwipe(
    () => { if (!editing) setKey(addDays(key, -1)); },
    () => { if (!editing && !isToday) setKey(addDays(key, 1)); },
  );

  return (
    <div className="report-overlay" onClick={onClose}>
      <div className="report-wrap" onClick={(e) => e.stopPropagation()} ref={swipe}>
        <div className="report-nav">
          <button className="nav-btn" onClick={() => { setKey(addDays(key, -1)); setEditing(false); }} aria-label="前の日">‹</button>
          <button className="btn small ghost" onClick={onClose}>閉じる</button>
          <button className="nav-btn" onClick={() => { setKey(addDays(key, 1)); setEditing(false); }} disabled={isToday} aria-label="次の日">›</button>
        </div>

        <div className="desk">
          <div className="notebook">
            <div className="page-paper">
              <div className="rp-head">
                <SunDoodle />
                <h2 className="rp-title">DAILY REPORT</h2>
              </div>
              <div className="rp-date">{MONTHS[d.getMonth()]} {d.getDate()}<span>（{DAY_NAMES[d.getDay()]}）</span></div>

              <div className="rp-total">
                <ClockDoodle />
                <div>
                  <div className="rp-label">TOTAL STUDY TIME</div>
                  <div className="rp-big"><span className="marker">{fmtSpaced(day.total)}</span></div>
                </div>
              </div>

              <span className="rp-tag tag-sand">TOP 3 SUBJECTS</span>
              {top.length ? (
                <ol className="rp-list">
                  {top.map((s, i) => (
                    <li key={s.id}>
                      <span className="rp-num">{i + 1}</span>
                      <span className="rp-name">{s.label}</span>
                      <span className="rp-time">{fmtSpaced(day.by[s.id])}</span>
                    </li>
                  ))}
                </ol>
              ) : <p className="rp-empty">この日の記録はまだないで</p>}

              <span className="rp-tag tag-blue">FOCUS NOTE</span>
              {editing ? (
                <textarea className="rp-note-input" autoFocus rows={2} defaultValue={note} placeholder="今日のひとこと"
                  onBlur={(e) => { const v = e.target.value.trim(); if (v !== note) setNote(key, v); setEditing(false); }} />
              ) : (
                <button className="rp-note" onClick={() => setEditing(true)}>
                  {note || <span className="rp-placeholder">タップしてひとこと書く</span>}
                </button>
              )}
              <MountainDoodle />
            </div>
          </div>
        </div>

        <div className="report-extra">
          <div className="report-stats">
            <div><span>休憩</span><b>{fmtSpaced(breakSecs)}</b></div>
            <div><span>連続</span><b>{streak}日</b></div>
            {ranked.length > 3 && <div><span>ほかの科目</span><b>{ranked.slice(3).map((s) => s.label + " " + fmtSpaced(day.by[s.id])).join("・")}</b></div>}
          </div>
          {tasks.length > 0 && (
            <>
              <div className="section-title">やったこと<span className="muted">（予定から計った分）</span></div>
              {tasks.map((t) => (
                <div key={t.subjectId + t.task} className="report-task">
                  <i style={{ background: getSub(t.subjectId).color }} />
                  <span><b>{getSub(t.subjectId).label}</b> {t.task}</span>
                  <em>{fmtSpaced(t.secs)}</em>
                </div>
              ))}
            </>
          )}
        </div>
        <p className="hint center light">スクリーンショットで保存・共有できます</p>
      </div>
    </div>
  );
}

function SunDoodle() {
  return (
    <svg className="rp-sun" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="11" fill="#F6C76B" stroke="#2B2B2B" strokeWidth="2.2" />
      <g stroke="#2B2B2B" strokeWidth="2.2" strokeLinecap="round">
        <path d="M32 6v8M32 50v8M6 32h8M50 32h8M13 13l5 5M46 46l5 5M13 51l5-5M46 18l5-5" />
      </g>
    </svg>
  );
}

function ClockDoodle() {
  return (
    <svg className="rp-clock" viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="26" fill="none" stroke="#2B2B2B" strokeWidth="2.6" />
      <path d="M32 16v17h11" fill="none" stroke="#2B2B2B" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MountainDoodle() {
  return (
    <svg className="rp-mountain" viewBox="0 0 160 80" aria-hidden="true">
      <path d="M4 74 L48 40 L66 54 L96 22 L140 74" fill="none" stroke="#2B2B2B" strokeWidth="2" strokeLinejoin="round" />
      <path d="M70 56 L96 26 L122 56" fill="#E8E2D6" stroke="none" />
      <path d="M96 22 V4 L112 9 L96 14" fill="none" stroke="#2B2B2B" strokeWidth="2" strokeLinejoin="round" />
      <path d="M120 6l6-4M122 14h7M118 0l2-4" stroke="#2B2B2B" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
