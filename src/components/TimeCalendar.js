import React, { useRef, useState } from "react";
import { DAY_NAMES, addDays, dayStart, fmtDateJa, keyToDate, toKey, todayKey } from "../lib/time";
import { RECORDS_FROM } from "../lib/constants";
import { longestRun, weekStart } from "../lib/score";

// カレンダータブの「時間」：勉強時間だけを見るカレンダー（日・週・月・期間）。2026-10-19 から
// 色は1日あたりの時間で5段階（0〜・4時間〜・7時間〜・10時間〜・12時間〜）。週と月は1日平均で塗る
const LEVELS = [0, 4, 7, 10, 12];
const SHADES = ["#E3EBD3", "#C3D6A2", "#9BBB72", "#6E9748", "#46702A"];
const H = 3600;
const level = (hoursPerDay) => (hoursPerDay <= 0 ? -1 : LEVELS.filter((h) => hoursPerDay >= h).length - 1);
const shade = (hoursPerDay) => { const l = level(hoursPerDay); return l < 0 ? null : { background: SHADES[l], color: l >= 3 ? "#FBF8F1" : "#2B2B2B" }; };
const clock = (secs) => Math.floor(secs / H) + ":" + String(Math.floor((secs % H) / 60)).padStart(2, "0");
const hm = (secs) => { const h = Math.floor(secs / H), m = Math.floor((secs % H) / 60); return h ? h + "時間" + m + "分" : m + "分"; };
const md = (key) => { const d = keyToDate(key); return d.getMonth() + 1 + "/" + d.getDate(); };
const hhmm = (ms) => { const d = new Date(ms); return d.getHours() + ":" + String(d.getMinutes()).padStart(2, "0"); };
const VIEWS = [["day", "日"], ["week", "週"], ["month", "月"], ["range", "期間"]];

// 期間（from〜to の日付キー）の合計と科目ごとの時間
function sumRange(days, from, to) {
  let total = 0, n = 0;
  const by = {};
  for (let k = from; k <= to; k = addDays(k, 1)) {
    n++;
    const d = days[k];
    if (!d) continue;
    total += d.total;
    Object.entries(d.by).forEach(([id, s]) => (by[id] = (by[id] || 0) + s));
  }
  return { total, by, n };
}

export default function TimeCalendar({ app }) {
  const [view, setView] = useState("day");
  return (
    <>
      <div className="seg tc-views">
        {VIEWS.map(([id, label]) => <button key={id} className={view === id ? "on" : ""} onClick={() => setView(id)}>{label}</button>)}
      </div>
      {view === "day" && <DayView app={app} />}
      {view === "week" && <WeekView app={app} />}
      {view === "month" && <MonthView app={app} />}
      {view === "range" && <RangeView app={app} />}
    </>
  );
}

function Nav({ label, onMove, back }) {
  return (
    <div className="date-nav">
      <button className="nav-btn" onClick={() => onMove(-1)} aria-label="前へ">‹</button>
      <div className="date-nav-center">
        <div className="date-nav-label">{label}</div>
        {back && <button className="link-btn" onClick={back.on}>{back.label}</button>}
      </div>
      <button className="nav-btn" onClick={() => onMove(1)} aria-label="次へ">›</button>
    </div>
  );
}

function useSwipe(onMove) {
  const touch = useRef(null);
  return {
    onTouchStart: (e) => { const t = e.touches[0]; touch.current = { x: t.clientX, y: t.clientY }; },
    onTouchEnd: (e) => {
      if (!touch.current) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - touch.current.x, dy = t.clientY - touch.current.y;
      touch.current = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) onMove(dx < 0 ? 1 : -1);
    },
  };
}

function Legend({ right }) {
  return (
    <div className="tc-legend">
      <span className="tc-scale">{LEVELS.map((h, i) => <i key={h} style={{ background: SHADES[i], color: i >= 3 ? "#FBF8F1" : "#2B2B2B" }}>{h}+</i>)}<small>時間/日</small></span>
      {right && <span className="tc-legend-right">{right}</span>}
    </div>
  );
}

// 科目ごとの時間（長い順・棒つき）
function SubjectBars({ app, by }) {
  const rows = Object.entries(by).filter(([, s]) => s > 0).sort((a, b) => b[1] - a[1]);
  if (!rows.length) return null;
  const max = rows[0][1];
  return (
    <div className="tc-subjects">
      {rows.map(([id, s]) => {
        const sub = app.getSub(id);
        return (
          <div key={id} className="tc-sub-row">
            <span className="tc-sub-name">{sub.label}</span>
            <span className="tc-sub-bar"><i style={{ width: (s / max) * 100 + "%", background: sub.color }} /></span>
            <b>{hm(s)}</b>
          </div>
        );
      })}
    </div>
  );
}

function Stats({ items }) {
  return <div className="tc-stats">{items.map(([label, value]) => <div key={label}><small>{label}</small><b>{value}</b></div>)}</div>;
}

// ── 日：月のカレンダー。押した日の中身を下に出す ──
function DayView({ app }) {
  const { days } = app;
  const today = todayKey();
  const [month, setMonth] = useState(() => today.slice(0, 7));
  const [sel, setSel] = useState(today);
  const [y, m] = month.split("-").map(Number);
  const move = (dir) => setMonth(toKey(new Date(y, m - 1 + dir, 1)).slice(0, 7));
  const swipe = useSwipe(move);
  const firstDow = new Date(y, m - 1, 1).getDay();
  const n = new Date(y, m, 0).getDate();
  const sum = sumRange(days, month + "-01", month + "-" + String(n).padStart(2, "0"));
  return (
    <>
      <Nav label={y + "年 " + m + "月"} onMove={move} back={month !== today.slice(0, 7) && { label: "今月に戻る", on: () => { setMonth(today.slice(0, 7)); setSel(today); } }} />
      <div className="tc-card" {...swipe}>
        <div className="tc-days">
          {DAY_NAMES.map((d, i) => <div key={d} className={"tc-dow" + (i === 0 ? " sun" : i === 6 ? " sat" : "")}>{d}</div>)}
          {Array.from({ length: firstDow }, (_, i) => <div key={"e" + i} />)}
          {Array.from({ length: n }, (_, i) => {
            const key = month + "-" + String(i + 1).padStart(2, "0");
            const secs = (days[key] || { total: 0 }).total;
            return (
              <button key={key} className={"tc-day" + (key === sel ? " sel" : "") + (key === today ? " today" : "")} style={shade(secs / H) || undefined} onClick={() => setSel(key)}>
                <span>{i + 1}</span>{secs > 0 && <b>{clock(secs)}</b>}
              </button>
            );
          })}
        </div>
        <Legend right={m + "月：" + hm(sum.total)} />
      </div>
      <DayDetail app={app} dateKey={sel} />
    </>
  );
}

function DayDetail({ app, dateKey }) {
  const { days, scoreLogs, logs, getSub, openDay } = app;
  const d = days[dateKey] || { total: 0, by: {} };
  const from = dayStart(dateKey), to = from + 86400000;
  const list = scoreLogs.filter((l) => l.start < to && l.end > from).sort((a, b) => a.start - b.start);
  const dayLogs = logs.filter((l) => l.start < to && l.end > from);
  return (
    <div className="tc-detail">
      <div className="tc-detail-title">{fmtDateJa(dateKey)}</div>
      {d.total > 0 ? (
        <>
          <Stats items={[["合計", hm(d.total)], ["一番長く続けた", hm(longestRun(scoreLogs, dateKey) * 60)], ["始めた", hhmm(Math.max(from, list[0].start))], ["終わった", hhmm(Math.min(to, list[list.length - 1].end))]]} />
          <div className="tc-strip" aria-label="この日のタイムライン">
            {dayLogs.map((l) => (
              <i key={l.id} style={{ left: ((Math.max(from, l.start) - from) / 864e5) * 100 + "%", width: Math.max(0.3, ((Math.min(to, l.end) - Math.max(from, l.start)) / 864e5) * 100) + "%", background: getSub(l.subjectId).color }} />
            ))}
          </div>
          <div className="tc-strip-hours">{[0, 6, 12, 18, 24].map((h) => <span key={h}>{h}</span>)}</div>
          <SubjectBars app={app} by={d.by} />
          <button className="btn block" onClick={() => openDay(dateKey)}>この日のタイムラインを開く</button>
        </>
      ) : <p className="empty">勉強の記録はありません</p>}
    </div>
  );
}

// ── 週：3か月（四半期）の週を並べる（月曜はじまり） ──
function WeekView({ app }) {
  const { days } = app;
  const today = todayKey();
  const nowQ = { y: Number(today.slice(0, 4)), q: Math.floor((Number(today.slice(5, 7)) - 1) / 3) };
  const [qt, setQt] = useState(nowQ);
  const [sel, setSel] = useState(weekStart(today));
  const move = (dir) => setQt(({ y, q }) => { const t = y * 4 + q + dir; return { y: Math.floor(t / 4), q: ((t % 4) + 4) % 4 }; });
  const swipe = useSwipe(move);
  const qFrom = toKey(new Date(qt.y, qt.q * 3, 1)), qTo = toKey(new Date(qt.y, qt.q * 3 + 3, 0));
  const weeks = [];
  for (let w = weekStart(qFrom); w <= qTo; w = addDays(w, 7)) weeks.push(w);
  return (
    <>
      <Nav label={qt.y + "年 " + (qt.q * 3 + 1) + "〜" + (qt.q * 3 + 3) + "月"} onMove={move}
        back={(qt.y !== nowQ.y || qt.q !== nowQ.q) && { label: "今週に戻る", on: () => { setQt(nowQ); setSel(weekStart(today)); } }} />
      <div className="tc-card" {...swipe}>
        <div className="tc-weeks">
          {weeks.map((w) => {
            const s = sumRange(days, w, addDays(w, 6));
            return (
              <button key={w} className={"tc-week" + (w === sel ? " sel" : "")} style={shade(s.total / H / 7) || undefined} onClick={() => setSel(w)}>
                <span>{md(w)}〜</span>{s.total > 0 && <b>{clock(s.total)}</b>}
              </button>
            );
          })}
        </div>
        <Legend />
      </div>
      <WeekDetail app={app} monday={sel} />
    </>
  );
}

function WeekDetail({ app, monday }) {
  const { days } = app;
  const today = todayKey();
  const sunday = addDays(monday, 6);
  const s = sumRange(days, monday, sunday);
  const passed = today < monday ? 0 : today > sunday ? 7 : Math.round((keyToDate(today) - keyToDate(monday)) / 864e5) + 1;
  const keys = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const max = Math.max(1, ...keys.map((k) => (days[k] || { total: 0 }).total));
  return (
    <div className="tc-detail">
      <div className="tc-detail-title">{fmtDateJa(monday)} 〜 {fmtDateJa(sunday)}</div>
      {s.total > 0 ? (
        <>
          <Stats items={[["合計", hm(s.total)], ["1日平均", hm(s.total / Math.max(1, passed))]]} />
          <div className="tc-bars">
            {keys.map((k) => {
              const t = (days[k] || { total: 0 }).total;
              const dow = keyToDate(k).getDay();
              return (
                <div key={k} className="tc-bar-col">
                  <small>{t > 0 ? clock(t) : ""}</small>
                  <div className="tc-bar-area"><i style={{ height: (t / max) * 100 + "%" }} /></div>
                  <span className={dow === 0 ? "sun" : dow === 6 ? "sat" : ""}>{DAY_NAMES[dow]}</span>
                </div>
              );
            })}
          </div>
          <SubjectBars app={app} by={s.by} />
        </>
      ) : <p className="empty">勉強の記録はありません</p>}
    </div>
  );
}

// ── 月：1年の月を並べる ──
function MonthView({ app }) {
  const { days } = app;
  const today = todayKey();
  const [year, setYear] = useState(Number(today.slice(0, 4)));
  const [sel, setSel] = useState(today.slice(0, 7));
  const swipe = useSwipe((d) => setYear((y) => y + d));
  const range = (mm) => { const n = new Date(year, mm, 0).getDate(); return [year + "-" + String(mm).padStart(2, "0") + "-01", year + "-" + String(mm).padStart(2, "0") + "-" + n, n]; };
  return (
    <>
      <Nav label={year + "年"} onMove={(d) => setYear((y) => y + d)} back={year !== Number(today.slice(0, 4)) && { label: "今年に戻る", on: () => { setYear(Number(today.slice(0, 4))); setSel(today.slice(0, 7)); } }} />
      <div className="tc-card" {...swipe}>
        <div className="tc-months">
          {Array.from({ length: 12 }, (_, i) => {
            const [from, to, n] = range(i + 1);
            const s = sumRange(app.days, from, to);
            const key = from.slice(0, 7);
            return (
              <button key={key} className={"tc-month" + (key === sel ? " sel" : "")} style={shade(s.total / H / n) || undefined} onClick={() => setSel(key)}>
                <span>{i + 1}月</span>{s.total > 0 && <b>{Math.round(s.total / H)}時間</b>}
              </button>
            );
          })}
        </div>
        <Legend />
      </div>
      <MonthDetail app={app} month={sel} days={days} />
    </>
  );
}

function MonthDetail({ app, month, days }) {
  const today = todayKey();
  const [y, m] = month.split("-").map(Number);
  const n = new Date(y, m, 0).getDate();
  const from = month + "-01", to = month + "-" + String(n).padStart(2, "0");
  const s = sumRange(days, from, to);
  const passed = today < from ? 0 : today > to ? n : Number(today.slice(8, 10));
  let best = null;
  for (let k = from; k <= to; k = addDays(k, 1)) if (days[k] && (!best || days[k].total > days[best].total)) best = k;
  return (
    <div className="tc-detail">
      <div className="tc-detail-title">{y}年{m}月</div>
      {s.total > 0 ? (
        <>
          <Stats items={[["合計", hm(s.total)], ["1日平均", hm(s.total / Math.max(1, passed))], ["一番多かった日", md(best) + " " + clock(days[best].total)]]} />
          <SubjectBars app={app} by={s.by} />
        </>
      ) : <p className="empty">勉強の記録はありません</p>}
    </div>
  );
}

// ── 期間：直近30日・3か月・全部の合計と平均。月ごとに1日ずつのマスを並べる ──
const RANGES = [["30", "直近30日"], ["90", "3か月"], ["all", "全部"]];
function RangeView({ app }) {
  const { days } = app;
  const today = todayKey();
  const [r, setR] = useState("30");
  const from = r === "all" ? RECORDS_FROM : [addDays(today, -Number(r) + 1), RECORDS_FROM].sort()[1];
  const s = sumRange(days, from, today);
  const months = [];
  for (let k = from.slice(0, 7); k <= today.slice(0, 7); k = toKey(new Date(Number(k.slice(0, 4)), Number(k.slice(5, 7)), 1)).slice(0, 7)) months.push(k);
  return (
    <>
      <div className="seg tc-ranges">
        {RANGES.map(([id, label]) => <button key={id} className={r === id ? "on" : ""} onClick={() => setR(id)}>{label}</button>)}
      </div>
      <div className="tc-detail">
        <div className="tc-detail-title">{md(from)} 〜 {md(today)}（{s.n}日）</div>
        <Stats items={[["合計", hm(s.total)], ["1日平均", hm(s.total / Math.max(1, s.n))]]} />
      </div>
      <div className="tc-card">
        {months.map((mo) => {
          const [y, m] = mo.split("-").map(Number);
          const n = new Date(y, m, 0).getDate();
          const firstDow = new Date(y, m - 1, 1).getDay();
          const a = [mo + "-01", from].sort()[1], b = [mo + "-" + String(n).padStart(2, "0"), today].sort()[0];
          const ms = sumRange(days, a, b);
          return (
            <div key={mo} className="tc-range-month">
              <div className="tc-range-head"><b>{m}月</b><small>平均 {(ms.total / H / Math.max(1, ms.n)).toFixed(1)}時間・合計 {Math.round(ms.total / H)}時間</small></div>
              <div className="tc-mini">
                {DAY_NAMES.map((d, i) => <div key={d} className={"tc-mini-dow" + (i === 0 ? " sun" : "")}>{d}</div>)}
                {Array.from({ length: firstDow }, (_, i) => <div key={"e" + i} />)}
                {Array.from({ length: n }, (_, i) => {
                  const key = mo + "-" + String(i + 1).padStart(2, "0");
                  const inRange = key >= from && key <= today;
                  const secs = (days[key] || { total: 0 }).total;
                  return <div key={key} className={"tc-mini-day" + (inRange ? "" : " out")} style={inRange ? shade(secs / H) || undefined : undefined}>{i + 1}</div>;
                })}
              </div>
            </div>
          );
        })}
        <Legend />
      </div>
      <SubjectBarsCard app={app} by={s.by} />
    </>
  );
}

function SubjectBarsCard({ app, by }) {
  return Object.keys(by).length ? <div className="tc-detail"><div className="tc-detail-title">科目ごと</div><SubjectBars app={app} by={by} /></div> : null;
}
