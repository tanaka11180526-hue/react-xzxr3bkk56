import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { load, save, remove as removeKey, makeId, usePersisted } from "./lib/storage";
import { dayStart, nextMidnight, splitByDay, toKey, todayKey } from "./lib/time";
import { syncTaskNames } from "./lib/tasks";
import * as sync from "./lib/sync";
import { BREAK_LIMIT_MS, DEFAULT_SUBJECTS, PAUSE_LIMIT_MS } from "./lib/constants";
import TimerTab from "./components/TimerTab";
import LongStudyCheck from "./components/LongStudyCheck";
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
const NOTES_SEEDED_KEY = "cpa_notes_seeded_v1";
// 勉強の計測がこれ以上続いていたら、止め忘れていないか聞く
const LONG_STUDY_MS = 2 * 3600 * 1000;

// 一度だけ行う休憩の掃除（計測の切り忘れ・重なって入った休憩）。どれも本人と確認した分
const BREAK_CLEANUPS = [
  {
    key: "cpa_break_cleanup_v1", // 2026-10-07
    del: [
      "b_1780124465717", // 5/30 16:01〜19:01
      "b_1784810932917", // 7/23 21:48〜0:00
      "b_1786178436167", // 8/8 17:40〜20:40
      "b_1780652700000", // 6/5 18:45〜19:16（18:40〜19:16 と重なり）
      "b_1780653000000", // 6/5 18:50〜19:14（同上）
      "b_1781320800000", // 6/13 12:20〜12:39（12:15〜12:39 と重なり）
    ],
    trim: { b_1781410588917: 1781413200000 }, // 6/14 13:16〜15:39 → 14:00 まで
  },
  {
    key: "cpa_break_cleanup_v2", // 2026-10-07
    del: [
      "b_1787392463478", // 8/22 18:54〜21:54
      "b_1788951296245", // 9/9 19:54〜22:54
    ],
    trim: {},
  },
];
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

// シートの同じ予定か（行番号・復習の何回目か・日付で見る）
function sameItem(a, b) {
  return a.row === b.row && !!a.review === !!b.review && (a.reviewIndex ?? null) === (b.reviewIndex ?? null) && a.date === b.date;
}

const EXAM_REFRESH_MS = 30 * 60 * 1000;
const EXAM_RETRY_MS = [2000, 5000]; // 答練の読み込みに失敗したとき、読み直すまでの待ち時間

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
  const timerRef = useRef(timer);
  timerRef.current = timer;
  const [breakColor, setBreakColor] = usePersisted("cpa_break_color", "#FBBF24");
  const [examDate, setExamDate] = usePersisted("cpa_exam_date", "");
  const [syncCfg, setSyncCfg] = usePersisted("cpa_sync", { url: "", token: "" });
  const [outbox, setOutbox] = usePersisted("cpa_sync_outbox", EMPTY_OUTBOX);
  const [schedule, setSchedule] = usePersisted("cpa_schedule", { items: [], at: 0 });
  const [syncState, setSyncState] = useState({ status: "idle" });
  const [scheduleState, setScheduleState] = useState({ status: "idle" });
  const [exams, setExams] = useState(null); // 答練の結果（大きくなるので localStorage には入れない）
  const [viewDate, setViewDate] = useState(todayKey());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editor, setEditor] = useState(null);
  const [report, setReport] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [notes, setNotes] = usePersisted("cpa_daily_notes", {});
  const [notesOutbox, setNotesOutbox] = usePersisted("cpa_notes_outbox", {});
  const [toast, setToast] = useState(null);
  const [longCheck, setLongCheck] = useState(null);

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
    // 終了：勉強中なら一時停止と同じ（30秒以内に再開すればそのまま続き、過ぎたら休憩の計測に切り替わる）。
    // 一時停止中ならすぐ休憩に、休憩中なら休憩を記録して止める
    // 止め忘れたとき：end の時刻で勉強を終わったことにする
    stopAt(end) {
      if (timer.mode !== "study") return;
      addEntries("study", studyBase(timer), timer.start, Math.min(end, Date.now()));
      setTimer(IDLE);
    },
    stop() {
      if (timer.mode === "study") return timerActions.pause();
      if (timer.mode === "paused") {
        handledPause.current = timer.pausedAt;
        addEntries("study", studyBase(timer), timer.start, timer.pausedAt);
        setTimer({ mode: "break", start: timer.pausedAt });
        return;
      }
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
    BREAK_CLEANUPS.forEach(({ key, del, trim }) => {
      if (load(key, false)) return;
      const drop = new Set(del);
      const trimmed = breaks.filter((b) => trim[b.id] && b.end > trim[b.id]).map((b) => b.id);
      setBreaks((p) => p.filter((b) => !drop.has(b.id)).map((b) => (
        trimmed.includes(b.id) ? { ...b, end: trim[b.id] } : b
      )));
      queue(trimmed.map((id) => [id, "break"]), del);
      save(key, true);
    });
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

  // 勉強の計測が長く続いたままアプリを開いたら、止め忘れていないか聞く（2時間ごとに1回）
  const askedLong = useRef("");
  const checkLong = useCallback(() => {
    const t = timerRef.current;
    if (t.mode !== "study") return;
    const step = Math.floor((Date.now() - t.start) / LONG_STUDY_MS);
    const key = t.start + ":" + step;
    if (step < 1 || askedLong.current === key) return;
    askedLong.current = key;
    setLongCheck({ start: t.start });
  }, []);

  const refreshSchedule = useCallback(async () => {
    if (!configured) return;
    setScheduleState({ status: "loading" });
    try {
      const { items, subjects: sheetSubjects, version } = await sync.fetchSchedule(syncCfg);
      setSchedule({ items, sheetSubjects, version, at: Date.now() });
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
      checkLong();
    };
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("online", onWake);
    return () => {
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("online", onWake);
    };
  }, [refreshSchedule, flush, checkLong]);
  useEffect(() => { checkLong(); }, [checkLong]);

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

  // 答練は、予定を読み終わったときか記録タブを開いたときに読む（一度読んだら EXAM_REFRESH_MS は読み直さない）。
  // 失敗したら少し待って読み直す（それでもだめなら、答練のボタンを押すと読み直す）
  const examsOn = configured && (schedule.version || 0) >= sync.EXAM_VERSION;
  const [examsStatus, setExamsStatus] = useState("idle"); // idle / loading / ok / error
  const examsAt = useRef(0);
  const loadExams = useCallback(async () => {
    examsAt.current = Date.now();
    setExamsStatus("loading");
    for (let i = 0; i < EXAM_RETRY_MS.length + 1; i++) {
      try {
        setExams(await sync.fetchExams(syncCfg));
        setExamsStatus("ok");
        return;
      } catch {
        if (i < EXAM_RETRY_MS.length) await new Promise((r) => setTimeout(r, EXAM_RETRY_MS[i]));
      }
    }
    examsAt.current = 0;
    setExamsStatus("error");
  }, [syncCfg]);
  // 予定を読み終わったら裏で答練も読んでおく（記録タブを開いたときに待たなくていいように）
  const scheduleOk = scheduleState.status === "ok";
  useEffect(() => {
    if (!examsOn || (tab !== "stats" && !scheduleOk)) return;
    if (Date.now() - examsAt.current < EXAM_REFRESH_MS) return;
    loadExams();
  }, [tab, scheduleOk, examsOn, loadExams]);

  // ── 予定を「終わった」にする（シートの達成 H列／復習の済チェックだけを書き換える）──

  const canMarkDone = configured && (schedule.version || 0) >= sync.FEATURE_VERSION;
  const setItemDone = useCallback((item, value) => {
    setSchedule((sc) => ({
      ...sc,
      items: sc.items.map((it) => (sameItem(it, item) ? (it.review ? { ...it, done: value } : { ...it, achieved: value ? "〇" : "" }) : it)),
    }));
  }, [setSchedule]);
  async function markDone(item, value) {
    if (!canMarkDone || !item.row) return;
    setItemDone(item, value);
    try {
      await sync.pushDone(syncCfg, item, value);
    } catch (e) {
      setItemDone(item, !value);
      setToast("シートに書けませんでした：" + e.message);
      refreshSchedule();
    }
  }

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  // ── レポートの「ひとこと」（アプリメモ タブに送る）──
  function setNote(key, text) {
    setNotes((n) => ({ ...n, [key]: text }));
    setNotesOutbox((o) => ({ ...o, [key]: (o[key] || 0) + 1 }));
  }
  const notesReady = configured && (schedule.version || 0) >= sync.FEATURE_VERSION;
  useEffect(() => {
    // はじめて使えるようになったとき、今までのひとことも全部送る
    if (!notesReady || load(NOTES_SEEDED_KEY, false)) return;
    setNotesOutbox((o) => {
      const next = { ...o };
      Object.keys(notes).forEach((k) => { if (notes[k]) next[k] = (next[k] || 0) + 1; });
      return next;
    });
    save(NOTES_SEEDED_KEY, true);
  }, [notesReady, notes, setNotesOutbox]);
  const notesSending = useRef(false);
  useEffect(() => {
    const keys = Object.keys(notesOutbox);
    if (!notesReady || !keys.length || notesSending.current) return;
    const snap = { ...notesOutbox };
    notesSending.current = true;
    const t = setTimeout(async () => {
      try {
        await sync.pushNotes(syncCfg, keys.map((k) => ({ date: k, text: notes[k] || "" })));
        setNotesOutbox((o) => {
          const next = { ...o };
          keys.forEach((k) => { if (next[k] === snap[k]) delete next[k]; });
          return next;
        });
      } catch (e) {
        // 次に開いたときにまた送る
      } finally {
        notesSending.current = false;
      }
    }, 1500);
    return () => { clearTimeout(t); notesSending.current = false; };
  }, [notesReady, notesOutbox, notes, syncCfg, setNotesOutbox]);

  function openDay(key) {
    setViewDate(key);
    setTab("timer");
  }

  const app = {
    subjects, setSubjects, getSub, logs, breaks, timer, timerActions, now, breakColor, setBreakColor,
    examDate, setExamDate, days, breakDays, scheduleByDate, schedule, scheduleState, refreshSchedule, matchSubject,
    viewDate, setViewDate, openDay, setEditor, openReport: setReport, syncCfg, setSyncCfg, syncState, pending, flush, queueAll, configured,
    addEntries, updateEntry, deleteEntry, setLogs, setBreaks, queue,
    canMarkDone, markDone, notes, setNote, exams, examsOn, examsStatus, loadExams,
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
      {longCheck && timer.mode === "study" && timer.start === longCheck.start && (
        <LongStudyCheck app={app} onClose={() => setLongCheck(null)} />
      )}
      {toast && <div className="toast" onClick={() => setToast(null)}>{toast}</div>}
    </div>
  );
}
