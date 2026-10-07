import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { load, save, remove as removeKey, makeId, usePersisted } from "./lib/storage";
import { dayStart, nextMidnight, splitByDay, toKey, todayKey } from "./lib/time";
import { syncTaskNames } from "./lib/tasks";
import * as sync from "./lib/sync";
import { BREAK_LIMIT_MS, DEFAULT_SUBJECTS, PAUSE_LIMIT_MS } from "./lib/constants";
import TimerTab from "./components/TimerTab";
import CalendarTab from "./components/CalendarTab";
import StatsTab from "./components/StatsTab";
import Settings from "./components/Settings";
import LogEditor from "./components/LogEditor";
import DailyReport from "./components/DailyReport";

const MIN_LOG_MS = 5000;
const IDLE = { mode: "idle" };
const EMPTY_OUTBOX = { up: {}, del: {} };

// 旧バージョンの記録には id がないので、開始時刻から決まる id を付ける
function withIds(list, prefix) {
  return (Array.isArray(list) ? list : [])
    .filter((l) => l && l.end > l.start)
    .map((l) => (l.id ? l : { ...l, id: prefix + "_" + l.start + (l.subjectId ? "_" + l.subjectId : "") }));
}

// 旧バージョンのタイマー状態（個別のキー）を引き継ぐ
function loadTimer() {
  const t = load("cpa_timer", null);
  if (t && t.mode) return t;
  const num = (k) => {
    const v = load(k, null);
    return v ? Number(v) : null;
  };
  const active = load("cpa_active_subject", ""), start = num("cpa_timer_start");
  if (active && start) return { mode: "study", subjectId: active, start };
  const paused = load("cpa_paused_subject", ""), pStart = num("cpa_paused_timer_start"), pAt = num("cpa_paused_at");
  if (paused && pStart && pAt) return { mode: "paused", subjectId: paused, start: pStart, pausedAt: pAt };
  const breakStart = num("cpa_break_start");
  if (breakStart) return { mode: "break", start: breakStart };
  return IDLE;
}
// 休憩が自動で終わる時刻（3時間後か、その日の終わりの早いほう）
export function breakEnd(start) {
  return Math.min(start + BREAK_LIMIT_MS, nextMidnight(start));
}

// 一度だけ行うデータ整理。シートの科目に合わせたときに消した旧科目の記録を付け替え、
// 止め忘れて長くなった休憩を切り詰め、科目名が変わった記録をシートに送り直す
const MIGRATION_KEY = "cpa_migrated_v3";
const LEGACY_SUBJECTS = { subject_1780109014480: "財理", subject_1780109002406: "財計" }; // 旧「財務理論」「財務計算」

const OLD_KEYS = ["cpa_active_subject", "cpa_timer_start", "cpa_paused_subject", "cpa_paused_timer_start", "cpa_paused_at", "cpa_break_start"];

function studyBase(t) {
  return t.task ? { subjectId: t.subjectId, task: t.task } : { subjectId: t.subjectId };
}

// ステータスバーの下まで表示しているのに、表示領域が画面より短いときの差（px）
export function measureBottomGap() {
  const standalone = window.navigator.standalone === true || window.matchMedia("(display-mode: standalone)").matches;
  if (!standalone || window.innerWidth > window.innerHeight) return 0;
  const probe = document.createElement("div");
  probe.style.cssText = "position:fixed;top:0;left:0;width:1px;height:env(safe-area-inset-top);visibility:hidden";
  document.body.appendChild(probe);
  const insetTop = probe.getBoundingClientRect().height;
  probe.remove();
  const gap = Math.round(window.screen.height - window.innerHeight);
  return insetTop > 0 && gap > 0 && gap <= 80 ? gap : 0;
}

function buildDays(list, getKey) {
  const days = {};
  list.forEach((l) => {
    const key = toKey(new Date(l.start));
    const d = days[key] || (days[key] = { total: 0, by: {} });
    const secs = Math.floor((l.end - l.start) / 1000);
    d.total += secs;
    const k = getKey(l);
    if (k) d.by[k] = (d.by[k] || 0) + secs;
  });
  return days;
}

const TABS = [
  { id: "timer", icon: "⏱", label: "タイマー" },
  { id: "calendar", icon: "📅", label: "カレンダー" },
  { id: "stats", icon: "📈", label: "記録" },
];

export default function App() {
  const [tab, setTab] = useState("timer");
  const [subjects, setSubjects] = usePersisted("cpa_subjects", DEFAULT_SUBJECTS);
  const [logs, setLogs] = usePersisted("cpa_timer_logs", () => withIds(load("cpa_timer_logs", []), "s"));
  const [breaks, setBreaks] = usePersisted("cpa_break_logs", () => withIds(load("cpa_break_logs", []), "b"));
  const [timer, setTimer] = usePersisted("cpa_timer", loadTimer);
  const [breakColor, setBreakColor] = usePersisted("cpa_break_color", "#FBBF24");
  const [examDate, setExamDate] = usePersisted("cpa_exam_date", "");
  const [syncCfg, setSyncCfg] = usePersisted("cpa_sync", { url: "", token: "" });
  const [outbox, setOutbox] = usePersisted("cpa_sync_outbox", EMPTY_OUTBOX);
  const [schedule, setSchedule] = usePersisted("cpa_schedule", { items: [], at: 0 });
  const [syncState, setSyncState] = useState({ status: "idle" });
  const [scheduleState, setScheduleState] = useState({ status: "idle" });
  const [viewDate, setViewDate] = useState(todayKey());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editor, setEditor] = useState(null);
  const [report, setReport] = useState(null);
  const [now, setNow] = useState(Date.now());

  const getSub = useCallback((id) => subjects.find((s) => s.id === id) || { id, label: "（削除した科目）", short: "？", color: "#6B7280" }, [subjects]);
  const configured = sync.isConfigured(syncCfg);

  useEffect(() => OLD_KEYS.forEach(removeKey), []);

  // ホーム画面から開いたとき、表示領域が画面の一番下より手前で終わる端末がある。
  // その場合は画面下の余白（ホームバーの分）がもう表示領域の外にあるので、タブの下の余白を詰める
  useEffect(() => {
    const apply = () => {
      const gap = measureBottomGap();
      const root = document.documentElement.style;
      root.setProperty("--bottom-gap", gap + "px");
      if (gap > 0) root.setProperty("--tab-bottom-pad", "8px");
      else root.removeProperty("--tab-bottom-pad");
    };
    apply();
    window.addEventListener("resize", apply);
    return () => window.removeEventListener("resize", apply);
  }, []);

  // ── 時計 ──
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), timer.mode === "idle" ? 30000 : 1000);
    return () => clearInterval(id);
  }, [timer.mode]);

  // ── 同期キュー（送信待ちの記録 id。v は送信中に再変更されたかの判定用）──
  const queue = useCallback((ups, dels = []) => {
    setOutbox((o) => {
      const up = { ...o.up }, del = { ...o.del };
      ups.forEach(([id, kind]) => { up[id] = { t: kind, v: ((up[id] && up[id].v) || 0) + 1 }; delete del[id]; });
      dels.forEach((id) => { delete up[id]; del[id] = { v: ((del[id] && del[id].v) || 0) + 1 }; });
      return { up, del };
    });
  }, [setOutbox]);

  // ── 記録の追加・編集・削除 ──
  const addEntries = useCallback((kind, base, start, end) => {
    if (end - start < MIN_LOG_MS) return;
    const entries = splitByDay(start, end).map(([s, e]) => ({ id: makeId(kind === "study" ? "s" : "b"), ...base, start: s, end: e }));
    (kind === "study" ? setLogs : setBreaks)((p) => [...p, ...entries]);
    queue(entries.map((e) => [e.id, kind]));
  }, [setLogs, setBreaks, queue]);

  function updateEntry(kind, id, fields) {
    const { start, end, ...rest } = fields;
    const entries = splitByDay(start, end).map(([s, e], i) => ({ id: i === 0 ? id : makeId(kind === "study" ? "s" : "b"), ...rest, start: s, end: e }));
    (kind === "study" ? setLogs : setBreaks)((p) => p.flatMap((l) => (l.id === id ? entries.map((n) => ({ ...l, ...n })) : [l])));
    queue(entries.map((e) => [e.id, kind]));
  }
  function deleteEntry(kind, id) {
    (kind === "study" ? setLogs : setBreaks)((p) => p.filter((l) => l.id !== id));
    queue([], [id]);
  }
  function queueAll() {
    queue([...logs.map((l) => [l.id, "study"]), ...breaks.map((l) => [l.id, "break"])]);
  }

  // ── タイマー操作（task はシートの「やること」。予定から計測を始めたときだけ入る）──
  function finalize(t, at) {
    if (t.mode === "study") addEntries("study", studyBase(t), t.start, at);
    else if (t.mode === "paused") {
      addEntries("study", studyBase(t), t.start, t.pausedAt);
      addEntries("break", {}, t.pausedAt, at);
    } else if (t.mode === "break") addEntries("break", {}, t.start, at);
  }
  const timerActions = {
    toggleSubject(subjectId, task = "") {
      const same = timer.subjectId === subjectId && (timer.task || "") === task;
      if (timer.mode === "study" && same) return timerActions.pause();
      if (timer.mode === "paused" && same) return timerActions.resume();
      const at = Date.now();
      finalize(timer, at);
      setTimer(task ? { mode: "study", subjectId, task, start: at } : { mode: "study", subjectId, start: at });
    },
    pause() {
      if (timer.mode === "study") setTimer({ ...timer, mode: "paused", pausedAt: Date.now() });
    },
    resume() {
      if (timer.mode === "paused") setTimer({ ...studyBase(timer), mode: "study", start: timer.start });
    },
    startBreak() {
      const at = Date.now();
      finalize(timer, at);
      setTimer({ mode: "break", start: at });
    },
    stop() {
      finalize(timer, Date.now());
      setTimer(IDLE);
    },
  };

  // 起動時：前日から計測しっぱなしなら日付が変わった時点で止める
  const mounted = useRef(false);
  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    const t0 = dayStart(todayKey());
    if (timer.mode === "study" && timer.start < t0) {
      addEntries("study", studyBase(timer), timer.start, t0);
      setTimer(IDLE);
    }
    if (!load(MIGRATION_KEY, false)) {
      const ids = new Set(subjects.map((s) => s.id));
      const fixedLogs = logs.map((l) => {
        const label = LEGACY_SUBJECTS[l.subjectId];
        const target = label && !ids.has(l.subjectId) && subjects.find((s) => s.label === label);
        return target ? { ...l, subjectId: target.id } : l;
      });
      const fixedBreaks = breaks.map((b) => (b.end > breakEnd(b.start) ? { ...b, end: breakEnd(b.start) } : b));
      setLogs(fixedLogs);
      setBreaks(fixedBreaks);
      queue([...fixedLogs.map((l) => [l.id, "study"]), ...fixedBreaks.map((b) => [b.id, "break"])]);
      save(MIGRATION_KEY, true);
    }
  }, []);

  // 一時停止が一定時間続いたら休憩に切り替える。休憩は3時間たつか日付が変わったら終了
  const handledPause = useRef(null);
  const handledBreak = useRef(null);
  useEffect(() => {
    if (timer.mode === "paused" && now - timer.pausedAt >= PAUSE_LIMIT_MS && handledPause.current !== timer.pausedAt) {
      handledPause.current = timer.pausedAt;
      addEntries("study", studyBase(timer), timer.start, timer.pausedAt);
      setTimer({ mode: "break", start: timer.pausedAt });
    } else if (timer.mode === "break" && now >= breakEnd(timer.start) && handledBreak.current !== timer.start) {
      handledBreak.current = timer.start;
      addEntries("break", {}, timer.start, breakEnd(timer.start));
      setTimer(IDLE);
    }
  }, [now, timer, addEntries, setTimer]);

  // ── スプレッドシート同期 ──
  const refs = useRef({});
  refs.current = { logs, breaks, subjects, outbox };
  const flushing = useRef(false);
  const flush = useCallback(async () => {
    if (!configured || flushing.current) return;
    const snap = refs.current.outbox;
    const upIds = Object.keys(snap.up), delIds = Object.keys(snap.del);
    if (!upIds.length && !delIds.length) return;
    flushing.current = true;
    setSyncState({ status: "syncing" });
    try {
      const rows = [], gone = [];
      upIds.forEach((id) => {
        const kind = snap.up[id].t;
        const l = refs.current[kind === "study" ? "logs" : "breaks"].find((x) => x.id === id);
        if (l) rows.push(sync.toRow(l, kind, refs.current.subjects));
        else gone.push(id);
      });
      await sync.pushLogs(syncCfg, rows, [...delIds, ...gone]);
      setOutbox((o) => {
        const up = { ...o.up }, del = { ...o.del };
        upIds.forEach((id) => { if (up[id] && up[id].v === snap.up[id].v) delete up[id]; });
        delIds.forEach((id) => { if (del[id] && del[id].v === snap.del[id].v) delete del[id]; });
        return { up, del };
      });
      setSyncState({ status: "ok", at: Date.now() });
    } catch (e) {
      setSyncState({ status: "error", message: e.message });
    } finally {
      flushing.current = false;
    }
  }, [configured, syncCfg, setOutbox]);

  const pending = Object.keys(outbox.up).length + Object.keys(outbox.del).length;
  useEffect(() => {
    if (!configured || !pending) return;
    const t = setTimeout(flush, syncState.status === "error" ? 60000 : 2000);
    return () => clearTimeout(t);
  }, [configured, pending, outbox, flush, syncState.status]);

  const refreshSchedule = useCallback(async () => {
    if (!configured) return;
    setScheduleState({ status: "loading" });
    try {
      const { items, subjects: sheetSubjects } = await sync.fetchSchedule(syncCfg);
      setSchedule({ items, sheetSubjects, at: Date.now() });
      setScheduleState({ status: "ok" });
    } catch (e) {
      setScheduleState({ status: "error", message: e.message });
    }
  }, [configured, syncCfg, setSchedule]);

  useEffect(() => { refreshSchedule(); }, [refreshSchedule]);
  useEffect(() => {
    const onWake = () => {
      if (document.visibilityState !== "visible") return;
      setNow(Date.now());
      refreshSchedule();
      flush();
    };
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("online", onWake);
    return () => {
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("online", onWake);
    };
  }, [refreshSchedule, flush]);

  // ── 集計（計測中の分も含める）──
  const studyDays = useMemo(() => buildDays(logs, (l) => l.subjectId), [logs]);
  const breakDays = useMemo(() => buildDays(breaks, () => null), [breaks]);
  const liveSubject = timer.mode === "study" || timer.mode === "paused" ? timer.subjectId : null;
  const liveStart = liveSubject ? timer.start : 0;
  const liveEnd = timer.mode === "study" ? now : timer.mode === "paused" ? timer.pausedAt : 0;
  const days = useMemo(() => {
    if (!liveSubject || liveEnd <= liveStart) return studyDays;
    const out = { ...studyDays };
    splitByDay(liveStart, liveEnd).forEach(([s, e]) => {
      const key = toKey(new Date(s)), secs = Math.floor((e - s) / 1000);
      const d = out[key] || { total: 0, by: {} };
      out[key] = { total: d.total + secs, by: { ...d.by, [liveSubject]: (d.by[liveSubject] || 0) + secs } };
    });
    return out;
  }, [studyDays, liveSubject, liveStart, liveEnd]);

  const scheduleByDate = useMemo(() => {
    const map = {};
    (schedule.items || []).forEach((it) => (map[it.date] = map[it.date] || []).push(it));
    Object.values(map).forEach((list) => list.sort((a, b) => (a.start || "99").localeCompare(b.start || "99")));
    return map;
  }, [schedule]);
  const matchSubject = useCallback((name) => {
    const n = String(name || "").trim();
    if (!n) return null;
    return subjects.find((s) => s.label === n || s.short === n || s.id === n) || null;
  }, [subjects]);

  // シートで予定の「やること」が書き換えられたら、その予定から計った記録も合わせる（アプリ記録シートにも送り直す）
  useEffect(() => {
    if (!schedule.items || !schedule.items.length) return;
    const { next, changed } = syncTaskNames(logs, schedule.items, matchSubject);
    if (!changed.length) return;
    setLogs(next);
    queue(changed.map((id) => [id, "study"]));
  }, [schedule.items, logs, matchSubject, setLogs, queue]);

  // 開きっぱなしでもシートの変更が届くように、表示中は5分ごとに予定を読み直す
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") refreshSchedule();
    }, 5 * 60000);
    return () => clearInterval(id);
  }, [refreshSchedule]);

  function openDay(key) {
    setViewDate(key);
    setTab("timer");
  }

  const app = {
    subjects, setSubjects, getSub, logs, breaks, timer, timerActions, now, breakColor, setBreakColor,
    examDate, setExamDate, days, breakDays, scheduleByDate, schedule, scheduleState, refreshSchedule, matchSubject,
    viewDate, setViewDate, openDay, setEditor, openReport: setReport, syncCfg, setSyncCfg, syncState, pending, flush, queueAll, configured,
    addEntries, updateEntry, deleteEntry, setLogs, setBreaks, queue,
  };

  const syncError = syncState.status === "error" || scheduleState.status === "error";
  const syncBadge = !configured ? null : (
    <span className={"sync-dot " + (syncError ? "error" : pending > 0 || syncState.status === "syncing" ? "busy" : "ok")} />
  );

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <div className="eyebrow">CPA Study Tracker</div>
          <h1>{TABS.find((t) => t.id === tab).label}</h1>
        </div>
        <button className="icon-btn settings-btn" onClick={() => setSettingsOpen(true)} aria-label="設定">
          {syncBadge}⚙️
        </button>
      </header>

      <main className="app-main">
        {tab === "timer" && <TimerTab app={app} />}
        {tab === "calendar" && <CalendarTab app={app} />}
        {tab === "stats" && <StatsTab app={app} />}
      </main>

      <nav className="tabbar">
        {TABS.map((t) => (
          <button key={t.id} className={"tab" + (tab === t.id ? " active" : "")} onClick={() => setTab(t.id)}>
            <span className="tab-icon">{t.icon}</span>
            <span className="tab-label">{t.label}</span>
          </button>
        ))}
      </nav>

      {settingsOpen && <Settings app={app} onClose={() => setSettingsOpen(false)} />}
      {editor && <LogEditor app={app} editor={editor} onClose={() => setEditor(null)} />}
      {report && <DailyReport app={app} dateKey={report} onClose={() => setReport(null)} />}
    </div>
  );
}
