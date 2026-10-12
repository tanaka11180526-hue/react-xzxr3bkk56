import React, { useRef, useState } from "react";
import { DAY_NAMES, fmtDateJa, fmtHM, keyToDate, toKey, todayKey } from "../lib/time";
import { UNKNOWN_COLOR } from "../lib/constants";
import { RANK_COLOR, dayScore, firstStudyDay, studied } from "../lib/score";
import { examShort, isExamPlan, isPrevDayReview } from "../lib/tasks";
import Sheet from "./Sheet";
import PlanList from "./PlanList";

const MAX_CHIPS = 3;
// 毎日、その日の評価（S〜E）を書いたシールを貼る（まっすぐ）
// 表示は日曜はじまり（記録タブの「今週」は月曜はじまりのまま）
const WEEK_ORDER = [0, 1, 2, 3, 4, 5, 6];

export default function CalendarTab({ app }) {
  const { days, scheduleByDate, matchSubject, configured, schedule, scheduleState, refreshSchedule } = app;
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [selected, setSelected] = useState(null);
  const [mode, setMode] = useState("plan"); // plan：ふつうの予定（答練は除く）／ exam：答練だけ
  const touch = useRef(null);
  const year = month.getFullYear(), m = month.getMonth();
  const firstDow = new Date(year, m, 1).getDay();
  const daysInMonth = new Date(year, m + 1, 0).getDate();
  const today = todayKey();
  const move = (dir) => setMonth(new Date(year, m + dir, 1));
  const isThisMonth = today.slice(0, 7) === toKey(month).slice(0, 7);
  const items = schedule.items || [];
  const first = firstStudyDay(days); // 使い始める前の日には評価を出さない

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

      <div className="seg cal-mode">
        <button className={mode === "plan" ? "on" : ""} onClick={() => setMode("plan")}>予定</button>
        <button className={mode === "exam" ? "on" : ""} onClick={() => setMode("exam")}>答練</button>
      </div>

      <div className="date-nav">
        <button className="nav-btn" onClick={() => move(-1)} aria-label="前の月">‹</button>
        <div className="date-nav-center">
          <div className="date-nav-label">{year}年 {m + 1}月</div>
          {!isThisMonth && <button className="link-btn" onClick={() => { const d = new Date(); setMonth(new Date(d.getFullYear(), d.getMonth(), 1)); }}>今月に戻る</button>}
        </div>
        <button className="nav-btn" onClick={() => move(1)} aria-label="次の月">›</button>
      </div>

      <div className="cal" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {WEEK_ORDER.map((i) => <div key={i} className={"cal-dow" + (i === 0 ? " sun" : i === 6 ? " sat" : "")}>{DAY_NAMES[i]}</div>)}
        {Array.from({ length: firstDow }, (_, i) => <div key={"e" + i} />)}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const key = toKey(new Date(year, m, i + 1));
          const dow = (firstDow + i) % 7;
          if (mode === "exam") return <ExamCell key={key} app={app} dateKey={key} dow={dow} today={today} onClick={() => setSelected(key)} />;
          const all = (scheduleByDate[key] || []).filter((p) => !isExamPlan(p));
          // 「前日の復習」は何行あっても札1枚にまとめる（一番下）
          const prev = all.filter(isPrevDayReview);
          const plans = prev.length ? all.filter((p) => !isPrevDayReview(p)).concat({ subject: prev[0].subject, content: "前日の復習" }) : all;
          const secs = (days[key] || { total: 0 }).total;
          return (
            <button key={key} className={"cal-cell" + (key === today ? " today" : "")} onClick={() => setSelected(key)}>
              {first && key >= first && key <= today && studied(days, key) && <RankSticker s={dayScore(key, { days, items, logs: app.scoreLogs, today })} />}
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

      {mode === "exam" && <NextExams app={app} today={today} />}

      {selected && (mode === "exam"
        ? <ExamDaySheet app={app} dateKey={selected} onClose={() => setSelected(null)} />
        : <DaySheet app={app} dateKey={selected} onClose={() => setSelected(null)} />)}
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
  const plans = (scheduleByDate[dateKey] || []).filter((p) => !isExamPlan(p)); // 答練は「答練」のカレンダーに出す
  const day = days[dateKey] || { total: 0, by: {} };
  const canStart = dateKey === todayKey();
  return (
    <Sheet title={fmtDateJa(dateKey)} onClose={onClose}>
      <div className="section-title">予定</div>
      {plans.length ? <PlanList app={app} plans={plans} canStart={canStart} />
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

function RankSticker({ s }) {
  return (
    <span className={"cal-rank" + (s.inProgress ? " now" : "")} style={{ "--c": RANK_COLOR[s.rank] }}
      title={s.score + "点" + (s.inProgress ? "（途中）" : "")}>{s.rank}</span>
  );
}

// ── 答練のカレンダー ──
const EXAM_ALIAS = { 財務: "財計" }; // 答練の科目「財務」は財計の色で出す
const NEXT_EXAMS = 5;

function examColor(app, subject) {
  const s = app.matchSubject(subject) || app.matchSubject(EXAM_ALIAS[subject]);
  return s ? s.color : UNKNOWN_COLOR;
}
// 答練の予定に、シートに入れた結果（答練結果の「合計」の行）があればその判定を付ける。科目と答練名、なければ科目と日付で探す
function resultOf(app, it) {
  const rows = ((app.exams && app.exams.results) || []).filter((r) => r.part === "合計" && r.subject === String(it.subject).trim());
  return rows.find((r) => r.name === String(it.content).trim()) || rows.find((r) => r.date === it.date) || null;
}
const examsOn = (app, key) => (app.scheduleByDate[key] || []).filter(isExamPlan);

function ExamCell({ app, dateKey, dow, today, onClick }) {
  const list = examsOn(app, dateKey);
  return (
    <button className={"cal-cell" + (dateKey === today ? " today" : "")} onClick={onClick}>
      <span className={"cal-day" + (dow === 0 ? " sun" : dow === 6 ? " sat" : "")}>{keyToDate(dateKey).getDate()}</span>
      {list.map((it, j) => {
        const r = resultOf(app, it);
        return (
          <span key={j} className="cal-chip cal-exam" style={{ background: examColor(app, it.subject) }}>
            {String(it.subject).trim().slice(0, 1)}{examShort(it.content)}{r && r.grade && <b className="cal-exam-grade">{r.grade}</b>}
          </span>
        );
      })}
    </button>
  );
}

function ExamDaySheet({ app, dateKey, onClose }) {
  const list = examsOn(app, dateKey);
  return (
    <Sheet title={fmtDateJa(dateKey)} onClose={onClose}>
      <div className="section-title">答練</div>
      {list.length ? list.map((it, i) => {
        const r = resultOf(app, it);
        return (
          <div key={i} className="exam-row">
            <i style={{ background: examColor(app, it.subject) }} />
            <span className="exam-row-name"><b>{it.subject}</b> {it.content}</span>
            {r && <span className="exam-row-result">{r.score}/{r.full}{r.grade && <b>{r.grade}</b>}</span>}
          </div>
        );
      }) : <p className="empty">この日の答練はありません</p>}
    </Sheet>
  );
}

// これからの答練（近い順に5件）
function NextExams({ app, today }) {
  const next = (app.schedule.items || []).filter((it) => isExamPlan(it) && it.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date)).slice(0, NEXT_EXAMS);
  const days = (k) => Math.round((keyToDate(k) - keyToDate(today)) / 86400000);
  return (
    <section className="section">
      <div className="section-title">次の答練</div>
      <div className="card">
        {next.length ? next.map((it, i) => (
          <div key={i} className="exam-row">
            <i style={{ background: examColor(app, it.subject) }} />
            <span className="exam-row-date">{keyToDate(it.date).getMonth() + 1}/{keyToDate(it.date).getDate()}（{DAY_NAMES[keyToDate(it.date).getDay()]}）</span>
            <span className="exam-row-name"><b>{it.subject}</b> {it.content}</span>
            <span className="exam-row-left">{days(it.date) === 0 ? "今日" : "あと" + days(it.date) + "日"}</span>
          </div>
        )) : <p className="empty">これからの答練の予定はありません</p>}
      </div>
    </section>
  );
}
