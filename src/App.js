import React, { useState, useEffect, useRef } from "react";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";

const DEFAULT_SUBJECTS = [
  { id: "financial", label: "財務会計", short: "財務", color: "#60A5FA" },
  { id: "management", label: "管理会計", short: "管理", color: "#34D399" },
  { id: "audit",     label: "監査論",   short: "監査", color: "#FBBF24" },
  { id: "corporate", label: "企業法",   short: "企業", color: "#C084FC" },
  { id: "tax",       label: "租税法",   short: "租税", color: "#F87171" },
  { id: "business",  label: "経営学",   short: "経営", color: "#38BDF8" },
];
const COLOR_PALETTE = [
  "#93C5FD","#60A5FA","#3B82F6","#2563EB","#1D4ED8",
  "#C4B5FD","#A78BFA","#8B5CF6","#7C3AED","#E879F9",
  "#FDA4AF","#F87171","#EF4444","#DC2626","#FB7185",
  "#FCD34D","#FBBF24","#F59E0B","#FB923C","#F97316",
  "#86EFAC","#4ADE80","#34D399","#10B981","#059669",
  "#67E8F9","#38BDF8","#22D3EE","#06B6D4","#2DD4BF",
  "#FDE68A","#FCA5A5","#FDBA74","#FDE047","#BEF264",
  "#E5E7EB","#D1D5DB","#9CA3AF","#E5E1D8","#F0EDE6",
];
const INTERVALS = [
  { label: "翌日",    days: 1  },
  { label: "1週間後", days: 7  },
  { label: "2週間後", days: 14 },
  { label: "1ヶ月後", days: 30 },
];
const DAY_NAMES = ["日","月","火","水","木","金","土"];

const SPLASH_MESSAGES = [
  { main: "天才とは、1％のひらめきと99％の努力である。", sub: "— トーマス・エジソン" },
  { main: "どんなに遅くても、歩みを止めない者が勝利する。", sub: "— 孔子" },
  { main: "成功とは、失敗を重ねても情熱を失わないことである。", sub: "— ウィンストン・チャーチル" },
  { main: "千里の道も一歩から。", sub: "— 老子" },
  { main: "今日できることを明日に延ばすな。", sub: "— ベンジャミン・フランクリン" },
  { main: "学ぶことで才能は開花する。志なき者に才能なし。", sub: "— 松下幸之助" },
  { main: "努力した者が全て報われるとは限らない。しかし成功した者は皆、努力している。", sub: "— 王貞治" },
  { main: "やってみせ、言って聞かせて、させてみせ、ほめてやらねば、人は動かじ。", sub: "— 山本五十六" },
  { main: "夢なき者に成功なし。", sub: "— 吉田松陰" },
  { main: "人間の価値は、いかに多くを得たかではなく、いかに多くを与えたかで測られる。", sub: "— アルベルト・アインシュタイン" },
  { main: "継続は力なり。", sub: "— 格言" },
  { main: "石の上にも三年。", sub: "— 日本のことわざ" },
  { main: "勝利は準備の中にある。", sub: "— ナポレオン・ボナパルト" },
  { main: "自分を信じろ。自分の可能性を信じろ。", sub: "— ウィリアム・ジェームズ" },
  { main: "挑戦しなければ、何も始まらない。", sub: "— 松岡修造" },
];

function toKey(date) {
  return date.getFullYear() + "-" + String(date.getMonth()+1).padStart(2,"0") + "-" + String(date.getDate()).padStart(2,"0");
}
function addDays(key, n) {
  const d = new Date(key + "T00:00:00");
  d.setDate(d.getDate() + n);
  return toKey(d);
}
function colorBg(hex) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return "rgba(" + r + "," + g + "," + b + ",0.12)";
}
function fmtTime(secs) {
  const h = Math.floor(secs/3600), m = Math.floor((secs%3600)/60), s = secs%60;
  return String(h).padStart(2,"0")+":"+String(m).padStart(2,"0")+":"+String(s).padStart(2,"0");
}

export default function App() {
  const [tab, setTab] = useState("calendar");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [subjects, setSubjects] = useState(() => {
    try { return JSON.parse(localStorage.getItem("cpa_subjects")||"null")||DEFAULT_SUBJECTS; } catch { return DEFAULT_SUBJECTS; }
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [colorPicking, setColorPicking] = useState(null);
  const [editingSubjectId, setEditingSubjectId] = useState(null);
  const [editingSubjectLabel, setEditingSubjectLabel] = useState("");
  const [sessions, setSessions] = useState(() => {
    try { return JSON.parse(localStorage.getItem("cpa_v2")||"[]"); } catch { return []; }
  });
  const [modal, setModal] = useState(null);
  const [modalStep, setModalStep] = useState("day");
  const [sessionDetailTarget, setSessionDetailTarget] = useState(null);
  const [form, setForm] = useState({ subject: "financial", content: "", review: true });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ subject: "financial", content: "", review: true });
  const [detailSession, setDetailSession] = useState(null);
  const touchStartX = useRef(null);

  // Timer state
  const [activeSubject, setActiveSubject] = useState(null);
  const [timerStart, setTimerStart] = useState(null);
  const timerRef = useRef(null);
  const [timerTick, setTimerTick] = useState(0);
  const [timerLogs, setTimerLogs] = useState(() => {
    try { return JSON.parse(localStorage.getItem("cpa_timer_logs")||"[]"); } catch { return []; }
  });
  const [timerDate, setTimerDate] = useState(toKey(new Date()));
  const [addTimeModal, setAddTimeModal] = useState(null);
  const [addTimeForm, setAddTimeForm] = useState({ startTime:"", endTime:"", date: toKey(new Date()) });
  const [confirmReset, setConfirmReset] = useState(false);
  const [logDetailModal, setLogDetailModal] = useState(null);
  const [logEditMode, setLogEditMode] = useState(false);
  const [logEditForm, setLogEditForm] = useState({ subjectId:"", startTime:"", endTime:"" });
  const [graphRange, setGraphRange] = useState(7);

  // Break timer state
  const [breakStart, setBreakStart] = useState(null);
  const [breakLogs, setBreakLogs] = useState(() => {
    try { return JSON.parse(localStorage.getItem("cpa_break_logs")||"[]"); } catch { return []; }
  });

  // List tab state
  const [listSearch, setListSearch] = useState("");
  const [listSubjectFilter, setListSubjectFilter] = useState("all");
  const [listReviewFilter, setListReviewFilter] = useState("all");
  const [listMode, setListMode] = useState("date"); // "all" | "date"
  const [listDate, setListDate] = useState(toKey(new Date()));
  const [listDoneTab, setListDoneTab] = useState("all"); // "all" | "undone" | "done"

  // Exam date state
  const [examDate, setExamDate] = useState(() => {
    try { return localStorage.getItem("cpa_exam_date")||""; } catch { return ""; }
  });
  const [examDateInput, setExamDateInput] = useState("");
  const [showExamDateEdit, setShowExamDateEdit] = useState(false);

  // Splash state
  const [splashVisible, setSplashVisible] = useState(true);
  const [splashFading, setSplashFading] = useState(false);

  const getSub = (id) => subjects.find(s => s.id === id) || subjects[0];

  useEffect(() => { localStorage.setItem("cpa_subjects", JSON.stringify(subjects)); }, [subjects]);
  useEffect(() => { localStorage.setItem("cpa_v2", JSON.stringify(sessions)); }, [sessions]);
  useEffect(() => { localStorage.setItem("cpa_timer_logs", JSON.stringify(timerLogs)); }, [timerLogs]);
  useEffect(() => { localStorage.setItem("cpa_break_logs", JSON.stringify(breakLogs)); }, [breakLogs]);
  useEffect(() => { localStorage.setItem("cpa_exam_date", examDate); }, [examDate]);

  useEffect(() => {
    if (activeSubject || breakStart) {
      timerRef.current = setInterval(() => setTimerTick(t => t+1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [activeSubject, breakStart]);

  // Timer helpers
  function getLogsForDate(dateKey) {
    const start = new Date(dateKey+"T00:00:00").getTime();
    const end = start + 86400000;
    return timerLogs.filter(l => l.start >= start && l.start < end);
  }
  function getBreakLogsForDate(dateKey) {
    const start = new Date(dateKey+"T00:00:00").getTime();
    const end = start + 86400000;
    return breakLogs.filter(l => l.start >= start && l.start < end);
  }
  function getTotalBreakSecsForDate(dateKey) {
    return getBreakLogsForDate(dateKey).reduce((sum, l) => sum + Math.floor((l.end - l.start)/1000), 0);
  }
  function saveBreakLog(startTs, endTs) {
    if (endTs - startTs < 5000) return;
    setBreakLogs(prev => [...prev, { start: startTs, end: endTs }]);
  }
  function getSecsForDate(dateKey, subId) {
    return getLogsForDate(dateKey)
      .filter(l => l.subjectId === subId)
      .reduce((sum, l) => sum + Math.floor((l.end - l.start)/1000), 0);
  }
  function getTotalSecsForDate(dateKey) {
    return subjects.reduce((sum, s) => sum + getSecsForDate(dateKey, s.id), 0);
  }
  function saveLog(subId, startTs, endTs) {
    if (endTs - startTs < 5000) return;
    setTimerLogs(prev => [...prev, { subjectId: subId, start: startTs, end: endTs }]);
  }
  function toggleTimer(subId) {
    const now = Date.now();
    if (activeSubject === subId) {
      // 科目タイマー停止 → 休憩開始
      saveLog(subId, timerStart, now);
      setActiveSubject(null); setTimerStart(null);
      setBreakStart(now);
    } else {
      // 別の科目 or 休憩中から科目開始
      if (activeSubject && timerStart) saveLog(activeSubject, timerStart, now);
      if (breakStart) { saveBreakLog(breakStart, now); setBreakStart(null); }
      setActiveSubject(subId); setTimerStart(now);
      setTimerDate(toKey(new Date()));
    }
  }
  function stopBreak() {
    if (breakStart) { saveBreakLog(breakStart, Date.now()); setBreakStart(null); }
  }
  function resetTimer(subId) {
    if (activeSubject === subId) { setActiveSubject(null); setTimerStart(null); }
    if (breakStart) { setBreakStart(null); }
    const todayKey = toKey(new Date());
    setTimerLogs(prev => prev.filter(l => !(l.subjectId === subId && toKey(new Date(l.start)) === todayKey)));
  }
  function resetAllTimers() {
    if (activeSubject) { setActiveSubject(null); setTimerStart(null); }
    if (breakStart) { setBreakStart(null); }
    const todayStart = new Date(); todayStart.setHours(0,0,0,0);
    setTimerLogs(prev => prev.filter(l => l.start < todayStart.getTime()));
    setBreakLogs(prev => prev.filter(l => l.start < todayStart.getTime()));
  }
  function addManualTime(subjectId, startTs, endTs) {
    if (endTs <= startTs) return;
    setTimerLogs(prev => [...prev, { subjectId, start: startTs, end: endTs, manual: true }]);
  }
  function deleteLog(log) {
    setTimerLogs(prev => prev.filter(l => !(l.start === log.start && l.subjectId === log.subjectId)));
    setLogDetailModal(null);
  }
  function editLog(oldLog, subjectId, startTs, endTs) {
    if (endTs <= startTs || endTs - startTs < 1000) return;
    setTimerLogs(prev => prev.map(l =>
      l.start === oldLog.start && l.subjectId === oldLog.subjectId
        ? { ...l, subjectId, start: startTs, end: endTs }
        : l
    ));
    setLogDetailModal(null);
    setLogEditMode(false);
  }

  const today = toKey(new Date());
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month+1, 0).getDate();

  // Build study/review maps
  const studyMap = {}, reviewMap = {};
  sessions.forEach(s => {
    (studyMap[s.date] = studyMap[s.date]||[]).push(s);
    if (s.review !== false) {
      INTERVALS.forEach(iv => {
        const k = addDays(s.date, iv.days);
        (reviewMap[k] = reviewMap[k]||[]).push({ ...s, intervalLabel: iv.label });
      });
    }
  });

  const todayStudies = studyMap[today]||[];
  const todayReviews = reviewMap[today]||[];
  const upcoming = [];
  for (let i = 1; i <= 7; i++) {
    const k = addDays(today, i);
    const d = new Date(k+"T00:00:00");
    (reviewMap[k]||[]).forEach(r => upcoming.push({ ...r, dateKey: k, dateLabel: (d.getMonth()+1)+"/"+(d.getDate()) }));
  }

  function openModal(dateKey) {
    setForm({ subject: "financial", content: "", review: true });
    setModalStep("day"); setSessionDetailTarget(null);
    setModal({ dateKey });
  }
  function addSession() {
    if (!form.content.trim()) return;
    setSessions(p => [...p, { id: Date.now().toString(), date: modal.dateKey, subject: form.subject, content: form.content.trim(), review: form.review }]);
    setForm({ subject: "financial", content: "", review: true });
    setModalStep("day");
  }
  function openEdit(s) {
    setForm({ subject: s.subject, content: s.content, review: s.review !== false });
    setEditingId(s.id); setModalStep("edit");
  }
  function saveEdit() {
    if (!form.content.trim()) return;
    setSessions(p => p.map(s => s.id === editingId ? { ...s, subject: form.subject, content: form.content.trim(), review: form.review } : s));
    setEditingId(null); setForm({ subject: "financial", content: "", review: true }); setModalStep("day");
  }
  function deleteSession(id) {
    setSessions(p => p.filter(s => s.id !== id));
    setDetailSession(null); setEditingId(null); setSessionDetailTarget(null);
  }
  function toggleDone(id) {
    setSessions(p => p.map(s => s.id === id ? { ...s, done: !s.done } : s));
    setDetailSession(prev => prev && prev.id === id ? { ...prev, done: !prev.done } : prev);
    setSessionDetailTarget(prev => prev && prev.id === id ? { ...prev, done: !prev.done } : prev);
  }
  function carryOverSession(id) {
    setSessions(p => p.map(s => {
      if (s.id !== id) return s;
      const nextDate = addDays(s.date, 1);
      return { ...s, date: nextDate };
    }));
    setSessionDetailTarget(prev => {
      if (!prev || prev.id !== id) return prev;
      return { ...prev, date: addDays(prev.date, 1) };
    });
  }
  function startEdit(s) {
    setEditingId(s.id);
    setEditForm({ subject: s.subject, content: s.content, review: s.review !== false });
  }
  function saveEditDetail() {
    if (!editForm.content.trim()) return;
    setSessions(p => p.map(s => s.id === editingId ? { ...s, subject: editForm.subject, content: editForm.content.trim(), review: editForm.review } : s));
    setEditingId(null); setDetailSession(null);
  }

  function swipeCalendar(dir) {
    setCurrentDate(new Date(year, month+dir, 1));
  }
  function swipeTimerDate(dir) {
    const d = new Date(timerDate+"T00:00:00");
    d.setDate(d.getDate()+dir);
    setTimerDate(toKey(d));
  }

  const splashMsg = useRef(SPLASH_MESSAGES[Math.floor(Math.random() * SPLASH_MESSAGES.length)]);

  useEffect(() => {
    const t1 = setTimeout(() => setSplashFading(true), 10000);
    const t2 = setTimeout(() => setSplashVisible(false), 10400);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  function closeSplash() {
    setSplashFading(true);
    setTimeout(() => setSplashVisible(false), 400);
  }

  // ─── RENDER ───
  return (
    <div style={{ width:"100%", background:"#0D0F16", height:"100vh", display:"flex", flexDirection:"column", fontFamily:"'Noto Sans JP','Hiragino Sans',sans-serif", overflow:"hidden" }}>

      {/* ── SPLASH ── */}
      {splashVisible && (
        <div onClick={closeSplash} style={{ position:"fixed", inset:0, zIndex:100, display:"flex", alignItems:"center", justifyContent:"center", padding:32, background:"rgba(7,9,14,0.92)", backdropFilter:"blur(12px)", WebkitBackdropFilter:"blur(12px)", transition:"opacity 0.4s", opacity: splashFading?0:1, cursor:"pointer" }}>
          <div style={{ textAlign:"center", maxWidth:320 }}>
            <div style={{ fontSize:48, marginBottom:24, lineHeight:1 }}>📚</div>
            <div style={{ fontSize:24, fontWeight:800, color:"#F0EDE6", lineHeight:1.4, marginBottom:12, letterSpacing:-0.5 }}>
              {splashMsg.current.main}
            </div>
            <div style={{ fontSize:14, color:"#6B7280", lineHeight:1.7, marginBottom:28 }}>
              {splashMsg.current.sub}
            </div>
            <div style={{ display:"flex", justifyContent:"center", gap:6 }}>
              {[0,1,2].map(i => <div key={i} style={{ width:6, height:6, borderRadius:"50%", background:"#3B82F6", opacity: 0.5 }} />)}
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ background:"#0D0F16", padding:"16px 18px 8px", borderBottom:"1px solid #1C1F2E", position:"sticky", top:0, zIndex:10, display:"flex", alignItems:"flex-end", justifyContent:"space-between" }}>
        <div>
          <div style={{ fontSize:10, letterSpacing:3, color:"#4B5563", textTransform:"uppercase", marginBottom:2 }}>CPA Study Tracker</div>
          <div style={{ fontSize:20, fontWeight:800, color:"#F0EDE6" }}>復習管理</div>
        </div>
        <button onClick={() => setSettingsOpen(true)} style={{ background:"none", border:"none", fontSize:22, cursor:"pointer", color:"#4B5563", padding:"4px 0 6px", WebkitTapHighlightColor:"transparent" }}>⚙️</button>
      </div>

      {/* Content */}
      <div style={{ flex:1, overflowY:"auto", paddingBottom:80, height:0 }}>

        {/* ── CALENDAR TAB ── */}
        {tab === "calendar" && (
          <div style={{ display:"flex", flexDirection:"column", paddingBottom:80 }} onTouchStart={e => { touchStartX.current = e.touches[0].clientX; }}
               onTouchEnd={e => { if (touchStartX.current === null) return; const dx = e.changedTouches[0].clientX - touchStartX.current; if (Math.abs(dx) > 50) swipeCalendar(dx < 0 ? 1 : -1); touchStartX.current = null; }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 18px 10px" }}>
              <button onClick={() => swipeCalendar(-1)} style={navBtn}>‹</button>
              <div style={{ fontSize:17, fontWeight:700, color:"#F0EDE6" }}>{year}年 {month+1}月</div>
              <button onClick={() => swipeCalendar(1)} style={navBtn}>›</button>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", padding:"0 10px", marginBottom:4 }}>
              {DAY_NAMES.map((d,i) => (
                <div key={d} style={{ textAlign:"center", fontSize:11, fontWeight:700, color: i===0?"#F87171":i===6?"#60A5FA":"#4B5563", paddingBottom:6 }}>{d}</div>
              ))}
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", padding:"0 10px", gap:3, gridAutoRows:"52px" }}>
              {Array(firstDow).fill(null).map((_,i) => <div key={"e"+i} />)}
              {Array.from({ length: daysInMonth }, (_,i) => {
                const day = i+1;
                const key = toKey(new Date(year, month, day));
                const isToday = key === today;
                const studies = studyMap[key]||[];
                const reviews = reviewMap[key]||[];
                const dow = (firstDow+i)%7;
                const daySecs = getTotalSecsForDate(key);
                const dayH = Math.floor(daySecs/3600);
                const dayM = Math.floor((daySecs%3600)/60);
                return (
                  <div key={day} onClick={() => openModal(key)} style={{ borderRadius:10, padding:"5px 4px 4px", background: isToday?"#1A2235":"#13151F", border: isToday?"1.5px solid #3B82F6":"1.5px solid transparent", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:2, WebkitTapHighlightColor:"transparent" }}>
                    <div style={{ fontSize:13, fontWeight: isToday?800:500, color: isToday?"#60A5FA":dow===0?"#F87171":dow===6?"#60A5FA":"#9CA3AF", lineHeight:1 }}>{day}</div>
                    {daySecs > 0 && <div style={{ fontSize:9, color:"#34D399", fontWeight:700, lineHeight:1 }}>{dayH > 0 ? dayH+"h"+dayM+"m" : dayM+"m"}</div>}
                    <div style={{ display:"flex", flexWrap:"wrap", gap:2, justifyContent:"center", minHeight:10 }}>
                      {studies.slice(0,3).map(s => <div key={s.id} style={{ width:6, height:6, borderRadius:"50%", background: getSub(s.subject).color }} />)}
                      {reviews.length > 0 && <div style={{ width:6, height:6, borderRadius:"50%", background:"#374151", border:"1.5px solid "+getSub(reviews[0].subject).color }} />}
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ display:"flex", gap:12, padding:"12px 18px 4px", flexWrap:"wrap" }}>
              <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, color:"#4B5563" }}><div style={{ width:7, height:7, borderRadius:"50%", background:"#60A5FA" }} /> 学習日</div>
              <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, color:"#4B5563" }}><div style={{ width:7, height:7, borderRadius:"50%", background:"#374151", border:"1.5px solid #60A5FA" }} /> 復習</div>
              <div style={{ fontSize:11, color:"#374151" }}>← スワイプで月移動 →</div>
            </div>

            {/* 試験日カウントダウン */}
            {(() => {
              const daysLeft = examDate
                ? Math.ceil((new Date(examDate+"T00:00:00") - new Date()) / 86400000)
                : null;
              return (
                <div style={{ margin:"12px 18px 8px", background:"#13151F", borderRadius:14, padding:"14px 16px", border:"1px solid #1C1F2E" }}>
                  <div style={{ fontSize:10, letterSpacing:2, color:"#4B5563", textTransform:"uppercase", marginBottom:8 }}>試験日まで</div>
                  {examDate && !showExamDateEdit ? (
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                      <div>
                        <div style={{ fontSize:12, color:"#6B7280", marginBottom:2 }}>{examDate}</div>
                        <div style={{ fontSize:30, fontWeight:800, color: daysLeft <= 30 ? "#F87171" : daysLeft <= 90 ? "#FBBF24" : "#34D399", letterSpacing:-1, fontVariantNumeric:"tabular-nums", lineHeight:1 }}>
                          残り{daysLeft}<span style={{ fontSize:13, fontWeight:600 }}>日</span>
                        </div>
                      </div>
                      <button onClick={() => { setExamDateInput(examDate); setShowExamDateEdit(true); }} style={{ background:"#1C1F2E", border:"none", borderRadius:10, color:"#6B7280", fontSize:12, padding:"7px 12px", cursor:"pointer" }}>変更</button>
                    </div>
                  ) : (
                    <div>
                      {!examDate && <div style={{ fontSize:12, color:"#4B5563", marginBottom:8 }}>試験日を設定すると残り日数が表示されます</div>}
                      <input type="date" value={examDateInput} onChange={e => setExamDateInput(e.target.value)}
                        style={{ width:"100%", boxSizing:"border-box", padding:"10px 12px", borderRadius:10, background:"#0D0F16", border:"1.5px solid #3B82F6", color:"#E5E1D8", fontSize:14, outline:"none", fontFamily:"inherit", marginBottom:8 }} />
                      <div style={{ display:"flex", gap:8 }}>
                        {examDate && <button onClick={() => setShowExamDateEdit(false)} style={{ flex:1, padding:"9px", borderRadius:10, border:"1.5px solid #1C1F2E", background:"transparent", color:"#6B7280", fontSize:12, fontWeight:700, cursor:"pointer" }}>キャンセル</button>}
                        <button onClick={() => { if(examDateInput) { setExamDate(examDateInput); setShowExamDateEdit(false); } }} disabled={!examDateInput}
                          style={{ flex:2, padding:"9px", borderRadius:10, border:"none", background: examDateInput?"linear-gradient(135deg,#3B82F6,#2563EB)":"#1C1F2E", color: examDateInput?"#fff":"#374151", fontSize:12, fontWeight:800, cursor: examDateInput?"pointer":"not-allowed" }}>設定する</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* ── TODAY TAB ── */}
        {tab === "today" && (
          <div style={{ padding:"16px 18px" }}>
            <div style={{ fontSize:13, color:"#4B5563", marginBottom:16 }}>
              {new Date().getMonth()+1}月{new Date().getDate()}日（{DAY_NAMES[new Date().getDay()]}）
            </div>
            <button onClick={() => openModal(today)} style={{ width:"100%", padding:"16px", borderRadius:14, border:"1.5px dashed #2A3040", background:"transparent", color:"#60A5FA", fontSize:15, fontWeight:700, cursor:"pointer", marginBottom:20, display:"flex", alignItems:"center", justifyContent:"center", gap:8, WebkitTapHighlightColor:"transparent" }}>
              <span style={{ fontSize:20 }}>＋</span> 今日の学習を記録
            </button>
            {todayStudies.length > 0 && (
              <><div style={{ fontSize:11, letterSpacing:2, color:"#4B5563", textTransform:"uppercase", marginBottom:10 }}>今日の学習</div>
              {todayStudies.map(s => <SessionCard key={s.id} s={s} subjects={subjects} onTap={() => setDetailSession(s)} />)}</>
            )}
            {todayReviews.length > 0 && (
              <><div style={{ fontSize:11, letterSpacing:2, color:"#4B5563", textTransform:"uppercase", marginBottom:10, marginTop:16 }}>今日の復習</div>
              {todayReviews.map((r,i) => <ReviewCard key={i} r={r} subjects={subjects} onTap={() => setDetailSession(r)} />)}</>
            )}
            {todayStudies.length === 0 && todayReviews.length === 0 && (
              <div style={{ textAlign:"center", color:"#2A3040", padding:"50px 0", fontSize:14 }}>今日の予定はありません</div>
            )}
            {upcoming.length > 0 && (
              <><div style={{ fontSize:11, letterSpacing:2, color:"#4B5563", textTransform:"uppercase", marginBottom:10, marginTop:24 }}>今後7日間の復習</div>
              {upcoming.map((r,i) => <ReviewCard key={i} r={r} subjects={subjects} showDate onTap={() => setDetailSession(r)} />)}</>
            )}
          </div>
        )}

        {/* ── TIMER TAB ── */}
        {tab === "timer" && (() => {
          const isToday = timerDate === toKey(new Date());
          const viewLogs = getLogsForDate(timerDate);
          const viewTotalSecs = getTotalSecsForDate(timerDate);
          const viewD = new Date(timerDate+"T00:00:00");
          const HOURS24 = Array.from({ length:24 }, (_,i) => i);

          function getBlockData(hour, blockIdx) {
            const base = new Date(timerDate+"T00:00:00").getTime();
            const bs = base + hour*3600000 + blockIdx*300000;
            const be = bs + 300000;
            // 休憩ログ確認
            const bLogs = getBreakLogsForDate(timerDate);
            for (const log of [...bLogs].reverse()) {
              if (log.start < be && log.end > bs) return { color: "#374151", log: null, isBreak: true };
            }
            for (const log of [...viewLogs].reverse()) {
              if (log.start < be && log.end > bs) return { color: getSub(log.subjectId).color, log, isBreak: false };
            }
            return { color: null, log: null, isBreak: false };
          }

          // ── グラフデータ計算 ──
          const graphDays = Array.from({ length: graphRange }, (_, i) => {
            const d = new Date(); d.setDate(d.getDate() - (graphRange - 1 - i));
            return toKey(d);
          });
          const graphMax = Math.max(1, ...graphDays.map(k => getTotalSecsForDate(k)));

          return (
            <div style={{ display:"flex", flexDirection:"column" }}>

              {/* Date header */}
              <div style={{ padding:"14px 18px 10px", borderBottom:"1px solid #1C1F2E" }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6 }}>
                  <button onClick={() => swipeTimerDate(-1)} style={navBtn}>‹</button>
                  <div style={{ textAlign:"center" }}>
                    <div style={{ fontSize:15, fontWeight:700, color: isToday?"#60A5FA":"#F0EDE6" }}>
                      {viewD.getFullYear()}/{viewD.getMonth()+1}/{viewD.getDate()}（{DAY_NAMES[viewD.getDay()]}）
                    </div>
                    {!isToday && <button onClick={() => setTimerDate(toKey(new Date()))} style={{ fontSize:11, color:"#60A5FA", background:"none", border:"none", cursor:"pointer", marginTop:2 }}>今日に戻る</button>}
                  </div>
                  <button onClick={() => swipeTimerDate(1)} style={{ ...navBtn, opacity: isToday?0.2:1 }} disabled={isToday}>›</button>
                </div>
                <div style={{ textAlign:"center", marginBottom:8 }}>
                  {/* セッションタイマー（計測中のみ大きく表示） */}
                  {isToday && activeSubject && timerStart ? (
                    <>
                      <div style={{ fontSize:11, letterSpacing:2, color: getSub(activeSubject).color, textTransform:"uppercase", marginBottom:4, fontWeight:700 }}>計測中</div>
                      <div style={{ fontSize:48, fontWeight:800, letterSpacing:-2, fontVariantNumeric:"tabular-nums", lineHeight:1, color: getSub(activeSubject).color }}>
                        {fmtTime(Math.floor((Date.now() - timerStart) / 1000))}
                      </div>
                      <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:5, marginTop:6 }}>
                        <div style={{ width:7, height:7, borderRadius:"50%", background: getSub(activeSubject).color }} />
                        <span style={{ fontSize:12, color: getSub(activeSubject).color, fontWeight:700 }}>{getSub(activeSubject).label}</span>
                        <span style={{ fontSize:11, color:"#4B5563" }}>／ 合計 {fmtTime(viewTotalSecs)}</span>
                      </div>
                    </>
                  ) : isToday && !activeSubject && breakStart ? (
                    <>
                      <div style={{ fontSize:11, letterSpacing:2, color:"#FBBF24", textTransform:"uppercase", marginBottom:4, fontWeight:700 }}>休憩中</div>
                      <div style={{ fontSize:48, fontWeight:800, color:"#FBBF24", letterSpacing:-2, fontVariantNumeric:"tabular-nums", lineHeight:1 }}>
                        {fmtTime(Math.floor((Date.now() - breakStart) / 1000))}
                      </div>
                      <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:6, marginTop:6 }}>
                        <span style={{ fontSize:13 }}>☕</span>
                        <span style={{ fontSize:11, color:"#4B5563" }}>合計 {fmtTime(viewTotalSecs)}</span>
                        <button onClick={stopBreak} style={{ fontSize:10, padding:"3px 8px", borderRadius:6, border:"1px solid #FBBF24", background:"transparent", color:"#FBBF24", cursor:"pointer", fontWeight:700 }}>終了</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize:11, letterSpacing:2, color:"#4B5563", textTransform:"uppercase", marginBottom:4 }}>合計</div>
                      <div style={{ fontSize:48, fontWeight:800, color:"#F0EDE6", letterSpacing:-2, fontVariantNumeric:"tabular-nums", lineHeight:1 }}>{fmtTime(viewTotalSecs)}</div>
                    </>
                  )}
                </div>
                {viewTotalSecs > 0 && (
                  <div style={{ display:"flex", height:4, borderRadius:2, overflow:"hidden", gap:1 }}>
                    {subjects.map(s => { const secs = getSecsForDate(timerDate, s.id); if (!secs) return null; return <div key={s.id} style={{ background:s.color, flex: secs/viewTotalSecs }} />; })}
                  </div>
                )}
              </div>

              {/* Subject rows */}
              <DragDropContext onDragEnd={result => {
                if (!result.destination) return;
                const a = [...subjects];
                const [moved] = a.splice(result.source.index, 1);
                a.splice(result.destination.index, 0, moved);
                setSubjects(a);
              }}>
                <Droppable droppableId="subjects">
                  {provided => (
                    <div ref={provided.innerRef} {...provided.droppableProps}>
                      {subjects.map((sub, idx) => {
                        const secs = getSecsForDate(timerDate, sub.id);
                        const isRunning = isToday && activeSubject === sub.id;
                        return (
                          <Draggable key={sub.id} draggableId={sub.id} index={idx}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                style={{
                                  display:"flex", alignItems:"center", padding:"13px 18px",
                                  borderBottom:"1px solid #1C1F2E",
                                  background: snapshot.isDragging ? "#1A1D27" : isRunning ? colorBg(sub.color) : "transparent",
                                  boxShadow: snapshot.isDragging ? "0 8px 32px rgba(0,0,0,0.5)" : "none",
                                  borderRadius: snapshot.isDragging ? 12 : 0,
                                  ...provided.draggableProps.style,
                                }}
                              >
                                {/* ドラッグハンドル */}
                                <div {...provided.dragHandleProps} style={{ display:"flex", flexDirection:"column", gap:3, marginRight:12, flexShrink:0, padding:"8px 6px", cursor:"grab", opacity: snapshot.isDragging ? 1 : 0.35 }}>
                                  {[0,1,2].map(i => (
                                    <div key={i} style={{ display:"flex", gap:3 }}>
                                      <div style={{ width:4, height:4, borderRadius:"50%", background:"#9CA3AF" }} />
                                      <div style={{ width:4, height:4, borderRadius:"50%", background:"#9CA3AF" }} />
                                    </div>
                                  ))}
                                </div>
                                {isToday ? (
                                  <button onClick={() => toggleTimer(sub.id)} style={{ width:44, height:44, borderRadius:"50%", border:"none", flexShrink:0, background: isRunning?sub.color:"#1C1F2E", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", WebkitTapHighlightColor:"transparent" }}>
                                    {isRunning
                                      ? <div style={{ width:12, height:12, borderLeft:"3px solid #fff", borderRight:"3px solid #fff", borderRadius:1 }} />
                                      : <div style={{ width:0, height:0, borderTop:"7px solid transparent", borderBottom:"7px solid transparent", borderLeft:"11px solid "+sub.color, marginLeft:2 }} />}
                                  </button>
                                ) : (
                                  <div style={{ width:44, height:44, borderRadius:"50%", background:"#1C1F2E", flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
                                    <div style={{ width:10, height:10, borderRadius:2, background: secs>0?sub.color:"#374151" }} />
                                  </div>
                                )}
                                <div style={{ flex:1, marginLeft:14 }}>
                                  <div style={{ fontSize:16, fontWeight:600, color: isRunning?sub.color:secs>0?"#E5E1D8":"#4B5563" }}>{sub.label}</div>
                                </div>
                                <div style={{ fontSize:18, fontWeight:700, color: isRunning?getSub(sub.id).color:secs>0?"#9CA3AF":"#2A3040", fontVariantNumeric:"tabular-nums", marginRight: isToday?8:0 }}>
                                  {isRunning && timerStart
                                    ? fmtTime(Math.floor((Date.now() - timerStart) / 1000))
                                    : fmtTime(secs)
                                  }
                                </div>
                                {isToday && (
                                  <div style={{ display:"flex", gap:4 }}>
                                    <button onClick={() => { setAddTimeModal({ subjectId: sub.id }); setAddTimeForm({ startTime:"", endTime:"", date: timerDate }); }} style={{ background:"none", border:"1px solid #1C1F2E", borderRadius:7, color:"#60A5FA", fontSize:11, fontWeight:700, padding:"5px 8px", cursor:"pointer" }}>＋</button>
                                  </div>
                                )}
                              </div>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>

              {/* Timeline */}
              <div style={{ padding:"14px 18px 20px" }}>
                <div style={{ fontSize:11, letterSpacing:2, color:"#4B5563", textTransform:"uppercase", marginBottom:8 }}>タイムライン（24時間）<span style={{ color:"#2A3040", fontWeight:400, letterSpacing:0, textTransform:"none", fontSize:10 }}> 　ブロックをタップで削除</span></div>
                <div style={{ height:340, overflowY:"scroll", WebkitOverflowScrolling:"touch", borderRadius:12, border:"1px solid #1C1F2E", background:"#0D0F16", padding:"8px 10px" }}>
                  {HOURS24.map(hour => {
                    const isCurrentHour = isToday && new Date().getHours() === hour;
                    const rowBlocks = Array.from({ length:12 }, (_,i) => getBlockData(hour, i));
                    const hasAny = rowBlocks.some(b => b.color);
                    return (
                      <div key={hour} style={{ display:"flex", alignItems:"center", marginBottom:3 }}>
                        <div style={{ width:24, fontSize:11, textAlign:"right", marginRight:8, flexShrink:0, fontVariantNumeric:"tabular-nums", fontWeight: isCurrentHour?800:400, color: isCurrentHour?"#60A5FA":hasAny?"#6B7280":"#2A3040" }}>{hour}</div>
                        <div style={{ display:"flex", gap:2, flex:1 }}>
                          {rowBlocks.map(({ color, log, isBreak }, i) => (
                            <div key={i} onClick={() => { if (log) setLogDetailModal({ log }); }} style={{ flex:1, height:24, borderRadius:4, background: isBreak?"#374151":color||(isCurrentHour?"#1A2035":hasAny?"#1C1F2E":"#13151F"), border: (color||isBreak)?"none":"1px solid "+(isCurrentHour?"#1E3050":"#1A1D27"), cursor: color?"pointer":"default", opacity: isBreak?0.6:1 }} />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {viewTotalSecs > 0 && (
                  <div style={{ display:"flex", flexWrap:"wrap", gap:"8px 16px", marginTop:10 }}>
                    {subjects.filter(s => getSecsForDate(timerDate, s.id)>0).map(s => (
                      <div key={s.id} style={{ display:"flex", alignItems:"center", gap:5 }}>
                        <div style={{ width:10, height:10, borderRadius:3, background:s.color }} />
                        <span style={{ fontSize:12, color:"#9CA3AF" }}>{s.label}</span>
                      </div>
                    ))}
                    {getTotalBreakSecsForDate(timerDate) > 0 && (
                      <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                        <div style={{ width:10, height:10, borderRadius:3, background:"#374151", opacity:0.6 }} />
                        <span style={{ fontSize:12, color:"#6B7280" }}>休憩 {fmtTime(getTotalBreakSecsForDate(timerDate))}</span>
                      </div>
                    )}
                  </div>
                )}
                {isToday && (
                  <div style={{ textAlign:"center", marginTop:16 }}>
                    <button onClick={() => setConfirmReset(true)} style={{ background:"none", border:"1px solid #1C1F2E", borderRadius:10, color:"#374151", fontSize:12, padding:"8px 20px", cursor:"pointer" }}>今日をリセット</button>
                  </div>
                )}
              </div>

              {/* ── GRAPH SECTION ── */}
              <div style={{ padding:"16px 18px 28px" }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
                  <div style={{ fontSize:11, letterSpacing:2, color:"#4B5563", textTransform:"uppercase" }}>勉強時間グラフ</div>
                  <div style={{ display:"flex", gap:4 }}>
                    {[7,14,30].map(n => (
                      <button key={n} onClick={() => setGraphRange(n)} style={{ padding:"4px 10px", borderRadius:8, border:"1.5px solid "+(graphRange===n?"#3B82F6":"#1C1F2E"), background: graphRange===n?"#1E3A5F":"transparent", color: graphRange===n?"#60A5FA":"#4B5563", fontSize:11, fontWeight:700, cursor:"pointer" }}>{n}日</button>
                    ))}
                  </div>
                </div>
                <div style={{ background:"#0D0F16", borderRadius:14, padding:"14px 10px 10px", border:"1px solid #1C1F2E" }}>
                  <div style={{ display:"flex", alignItems:"flex-end", gap: graphRange===30?2:graphRange===14?4:6, height:100 }}>
                    {graphDays.map(k => {
                      const totalSecs = getTotalSecsForDate(k);
                      const barH = totalSecs > 0 ? Math.max(4, Math.round((totalSecs / graphMax) * 88)) : 0;
                      const d = new Date(k+"T00:00:00");
                      const isToday2 = k === toKey(new Date());
                      const dow = d.getDay();
                      return (
                        <div key={k} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
                          <div style={{ width:"100%", height:88, display:"flex", flexDirection:"column", justifyContent:"flex-end" }}>
                            {totalSecs > 0 ? (
                              <div style={{ width:"100%", height:barH, borderRadius:3, overflow:"hidden", display:"flex", flexDirection:"column-reverse" }}>
                                {subjects.map(s => {
                                  const secs = getSecsForDate(k, s.id);
                                  if (!secs) return null;
                                  return <div key={s.id} style={{ width:"100%", flex: secs/totalSecs, background: s.color, opacity: isToday2?1:0.8 }} />;
                                })}
                              </div>
                            ) : (
                              <div style={{ width:"100%", height:2, borderRadius:1, background:"#1C1F2E" }} />
                            )}
                          </div>
                          {graphRange <= 14 && (
                            <div style={{ fontSize:9, color: isToday2?"#60A5FA":dow===0?"#F87171":dow===6?"#60A5FA":"#374151", fontWeight: isToday2?800:400, lineHeight:1 }}>
                              {graphRange === 7 ? DAY_NAMES[dow] : (d.getDate()+"/"+(d.getMonth()+1))}
                            </div>
                          )}
                          {graphRange === 30 && d.getDate() % 5 === 0 && (
                            <div style={{ fontSize:8, color:"#374151", lineHeight:1 }}>{d.getDate()}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display:"flex", justifyContent:"flex-end", marginTop:6 }}>
                    <span style={{ fontSize:10, color:"#2A3040" }}>最大 {Math.floor(graphMax/3600)}h{Math.floor((graphMax%3600)/60)}m</span>
                  </div>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:"6px 14px", marginTop:8, paddingTop:8, borderTop:"1px solid #1C1F2E" }}>
                    {subjects.map(s => {
                      const totalInRange = graphDays.reduce((sum, k) => sum + getSecsForDate(k, s.id), 0);
                      if (!totalInRange) return null;
                      return (
                        <div key={s.id} style={{ display:"flex", alignItems:"center", gap:5 }}>
                          <div style={{ width:8, height:8, borderRadius:2, background:s.color }} />
                          <span style={{ fontSize:10, color:"#6B7280" }}>{s.short} {Math.floor(totalInRange/3600)}h{Math.floor((totalInRange%3600)/60)}m</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

            </div>
          );
        })()}

        {/* ── LIST TAB ── */}
        {tab === "list" && (() => {
          const isDateMode = listMode === "date";
          const listD = new Date(listDate + "T00:00:00");
          const isTodayList = listDate === toKey(new Date());

          const filtered = [...sessions].reverse().filter(s => {
            if (isDateMode && s.date !== listDate) return false;
            if (listDoneTab === "undone" && s.done) return false;
            if (listDoneTab === "done" && !s.done) return false;
            if (listSubjectFilter !== "all" && s.subject !== listSubjectFilter) return false;
            if (listReviewFilter === "review" && s.review === false) return false;
            if (listReviewFilter === "noreview" && s.review !== false) return false;
            if (listSearch.trim()) {
              const q = listSearch.trim().toLowerCase();
              const sub = subjects.find(x => x.id === s.subject);
              if (!s.content.toLowerCase().includes(q) && !(sub?.label.includes(q))) return false;
            }
            return true;
          });
          const undoneCount = [...sessions].filter(s => isDateMode ? s.date === listDate && !s.done : !s.done).length;
          const doneCount = [...sessions].filter(s => isDateMode ? s.date === listDate && s.done : s.done).length;

          const groups = [];
          if (!isDateMode) {
            filtered.forEach(s => {
              const last = groups[groups.length - 1];
              if (last && last.date === s.date) last.items.push(s);
              else groups.push({ date: s.date, items: [s] });
            });
          }

          function fmtGroupDate(key) {
            const d = new Date(key + "T00:00:00");
            const todayKey = toKey(new Date());
            const yesterdayKey = addDays(todayKey, -1);
            if (key === todayKey) return "今日";
            if (key === yesterdayKey) return "昨日";
            return (d.getMonth()+1) + "月" + d.getDate() + "日（" + DAY_NAMES[d.getDay()] + "）";
          }

          return (
            <div style={{ padding:"16px 18px" }}>
              <div style={{ display:"flex", background:"#13151F", borderRadius:12, padding:4, marginBottom:10, border:"1px solid #1C1F2E" }}>
                <button onClick={() => setListDoneTab("all")} style={{ flex:1, padding:"9px", borderRadius:9, border:"none", background: listDoneTab==="all"?"#1C1F2E":"transparent", color: listDoneTab==="all"?"#E5E1D8":"#4B5563", fontSize:12, fontWeight:700, cursor:"pointer", transition:"all 0.15s" }}>すべて</button>
                <button onClick={() => setListDoneTab("undone")} style={{ flex:1, padding:"9px", borderRadius:9, border:"none", background: listDoneTab==="undone"?"#1E3A5F":"transparent", color: listDoneTab==="undone"?"#60A5FA":"#4B5563", fontSize:12, fontWeight:700, cursor:"pointer", transition:"all 0.15s" }}>
                  未完了{undoneCount > 0 && <span style={{ marginLeft:4, background:"#3B82F6", color:"#fff", borderRadius:10, padding:"1px 6px", fontSize:10 }}>{undoneCount}</span>}
                </button>
                <button onClick={() => setListDoneTab("done")} style={{ flex:1, padding:"9px", borderRadius:9, border:"none", background: listDoneTab==="done"?"#0F2A1A":"transparent", color: listDoneTab==="done"?"#4ADE80":"#4B5563", fontSize:12, fontWeight:700, cursor:"pointer", transition:"all 0.15s" }}>
                  完了{doneCount > 0 && <span style={{ marginLeft:4, background:"#16A34A", color:"#fff", borderRadius:10, padding:"1px 6px", fontSize:10 }}>{doneCount}</span>}
                </button>
              </div>
              <div style={{ display:"flex", background:"#13151F", borderRadius:12, padding:4, marginBottom:14, border:"1px solid #1C1F2E" }}>
                <button onClick={() => setListMode("all")} style={{ flex:1, padding:"8px", borderRadius:9, border:"none", background: !isDateMode?"#1E3A5F":"transparent", color: !isDateMode?"#60A5FA":"#4B5563", fontSize:12, fontWeight:700, cursor:"pointer", transition:"all 0.15s" }}>📋 全件</button>
                <button onClick={() => setListMode("date")} style={{ flex:1, padding:"8px", borderRadius:9, border:"none", background: isDateMode?"#1E3A5F":"transparent", color: isDateMode?"#60A5FA":"#4B5563", fontSize:12, fontWeight:700, cursor:"pointer", transition:"all 0.15s" }}>📅 日付指定</button>
              </div>
              {isDateMode && (
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14, padding:"10px 14px", background:"#13151F", borderRadius:12, border:"1px solid #1C1F2E" }}>
                  <button onClick={() => { const d = new Date(listDate+"T00:00:00"); d.setDate(d.getDate()-1); setListDate(toKey(d)); }} style={navBtn}>‹</button>
                  <div style={{ textAlign:"center" }}>
                    <div style={{ fontSize:15, fontWeight:700, color: isTodayList?"#60A5FA":"#F0EDE6" }}>
                      {listD.getFullYear()}/{listD.getMonth()+1}/{listD.getDate()}（{DAY_NAMES[listD.getDay()]}）
                    </div>
                    {!isTodayList && <button onClick={() => setListDate(toKey(new Date()))} style={{ fontSize:11, color:"#60A5FA", background:"none", border:"none", cursor:"pointer", marginTop:2 }}>今日に戻る</button>}
                  </div>
                  <button onClick={() => { const d = new Date(listDate+"T00:00:00"); d.setDate(d.getDate()+1); setListDate(toKey(d)); }} style={{ ...navBtn, opacity: isTodayList?0.2:1 }} disabled={isTodayList}>›</button>
                </div>
              )}
              <div style={{ position:"relative", marginBottom:10 }}>
                <span style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", fontSize:15, color:"#4B5563" }}>🔍</span>
                <input
                  value={listSearch}
                  onChange={e => setListSearch(e.target.value)}
                  placeholder="キーワード検索…"
                  style={{ width:"100%", boxSizing:"border-box", padding:"11px 14px 11px 36px", borderRadius:12, background:"#13151F", border:"1.5px solid "+(listSearch?"#3B82F6":"#1C1F2E"), color:"#E5E1D8", fontSize:14, outline:"none", fontFamily:"inherit" }}
                />
                {listSearch && <button onClick={() => setListSearch("")} style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", color:"#4B5563", fontSize:18, cursor:"pointer", padding:"4px" }}>×</button>}
              </div>
              <div style={{ display:"flex", gap:6, overflowX:"auto", marginBottom:8, paddingBottom:2, WebkitOverflowScrolling:"touch" }}>
                <button onClick={() => setListSubjectFilter("all")} style={{ flexShrink:0, padding:"6px 12px", borderRadius:20, border:"1.5px solid "+(listSubjectFilter==="all"?"#3B82F6":"#1C1F2E"), background: listSubjectFilter==="all"?"#1E3A5F":"transparent", color: listSubjectFilter==="all"?"#60A5FA":"#4B5563", fontSize:11, fontWeight:700, cursor:"pointer" }}>すべて</button>
                {subjects.map(s => (
                  <button key={s.id} onClick={() => setListSubjectFilter(listSubjectFilter===s.id?"all":s.id)} style={{ flexShrink:0, padding:"6px 12px", borderRadius:20, border:"1.5px solid "+(listSubjectFilter===s.id?s.color:"#1C1F2E"), background: listSubjectFilter===s.id?colorBg(s.color):"transparent", color: listSubjectFilter===s.id?s.color:"#4B5563", fontSize:11, fontWeight:700, cursor:"pointer" }}>{s.short}</button>
                ))}
              </div>
              <div style={{ display:"flex", gap:6, marginBottom:16, alignItems:"center" }}>
                {[["all","すべて"],["review","復習あり"],["noreview","復習なし"]].map(([val,label]) => (
                  <button key={val} onClick={() => setListReviewFilter(val)} style={{ padding:"5px 10px", borderRadius:20, border:"1.5px solid "+(listReviewFilter===val?"#3B82F6":"#1C1F2E"), background: listReviewFilter===val?"#1E3A5F":"transparent", color: listReviewFilter===val?"#60A5FA":"#4B5563", fontSize:11, fontWeight:700, cursor:"pointer" }}>{label}</button>
                ))}
                <span style={{ marginLeft:"auto", fontSize:11, color:"#374151" }}>{filtered.length}件</span>
              </div>
              {filtered.length === 0 && <div style={{ textAlign:"center", color:"#2A3040", padding:"50px 0", fontSize:14 }}>該当する記録がありません</div>}
              {isDateMode
                ? filtered.map(s => <SessionCard key={s.id} s={s} subjects={subjects} onTap={() => setDetailSession(s)} />)
                : groups.map(g => (
                    <div key={g.date} style={{ marginBottom:20 }}>
                      <div style={{ fontSize:11, fontWeight:700, color:"#4B5563", marginBottom:8, letterSpacing:1 }}>{fmtGroupDate(g.date)}</div>
                      {g.items.map(s => <SessionCard key={s.id} s={s} subjects={subjects} onTap={() => setDetailSession(s)} />)}
                    </div>
                  ))
              }
            </div>
          );
        })()}

      </div>{/* end content */}

      {/* Bottom Nav */}
      <div style={{ position:"fixed", bottom:0, left:0, width:"100%", background:"#0D0F16", borderTop:"1px solid #1C1F2E", display:"flex", padding:"10px 0 env(safe-area-inset-bottom,12px)", zIndex:20 }}>
        {[
          { id:"calendar", icon:"📅", label:"カレンダー" },
          { id:"today",    icon:"📌", label:"今日" },
          { id:"timer",    icon:"⏱",  label:"タイマー" },
          { id:"list",     icon:"📋", label:"タスク" },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ flex:1, border:"none", background:"none", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:4, padding:"8px 0", WebkitTapHighlightColor:"transparent" }}>
            <div style={{ fontSize:24 }}>{t.icon}</div>
            <div style={{ fontSize:11, fontWeight:700, color: tab===t.id?"#60A5FA":"#374151" }}>{t.label}</div>
            {tab === t.id && <div style={{ width:24, height:2, borderRadius:1, background:"#60A5FA" }} />}
          </button>
        ))}
      </div>

      {/* Day Modal */}
      {modal && (() => {
        const dk = modal.dateKey;
        const d = new Date(dk+"T00:00:00");
        const dateLabel = (d.getMonth()+1)+"月"+d.getDate()+"日（"+DAY_NAMES[d.getDay()]+"）";
        const dayStudies = studyMap[dk]||[];
        const dayReviews = reviewMap[dk]||[];
        const isEmpty = dayStudies.length === 0 && dayReviews.length === 0;
        const modalLogs = getLogsForDate(dk);
        const modalTotalSecs = getTotalSecsForDate(dk);
        const HOURS24m = Array.from({ length:24 }, (_,i) => i);

        function modalBlockColor(hour, bi) {
          const base = new Date(dk+"T00:00:00").getTime();
          const bs = base + hour*3600000 + bi*300000;
          const be = bs + 300000;
          const bLogs = getBreakLogsForDate(dk);
          for (const log of [...bLogs].reverse()) {
            if (log.start < be && log.end > bs) return "break";
          }
          for (const log of [...modalLogs].reverse()) {
            if (log.start < be && log.end > bs) return getSub(log.subjectId).color;
          }
          return null;
        }

        const ReviewToggle = ({ val, onChange }) => (
          <button onClick={onChange} style={{ width:"100%", padding:"14px 16px", borderRadius:12, marginBottom:14, border:"1.5px solid "+(val?"#3B82F6":"#1C1F2E"), background: val?"#1E3A5F":"#0D0F16", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"space-between", WebkitTapHighlightColor:"transparent" }}>
            <div style={{ textAlign:"left" }}>
              <div style={{ fontSize:13, fontWeight:700, color: val?"#60A5FA":"#4B5563" }}>🔄 復習スケジュールを設定する</div>
              <div style={{ fontSize:11, color:"#374151", marginTop:3 }}>{val ? "翌日・1週間・2週間・1ヶ月後に復習予定が入ります" : "答練など1回きりの学習に"}</div>
            </div>
            <div style={{ width:44, height:26, borderRadius:13, flexShrink:0, marginLeft:12, background: val?"#3B82F6":"#1C1F2E", position:"relative" }}>
              <div style={{ position:"absolute", top:3, left: val?21:3, width:20, height:20, borderRadius:"50%", background: val?"#fff":"#374151", transition:"left 0.2s" }} />
            </div>
          </button>
        );

        const SubjectPicker = ({ value, onChange }) => (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:18 }}>
            {subjects.map(s => (
              <button key={s.id} onClick={() => onChange(s.id)} style={{ padding:"12px 4px", borderRadius:12, border:"2px solid "+(value===s.id?s.color:"transparent"), background: value===s.id?colorBg(s.color):"#0D0F16", color: value===s.id?s.color:"#4B5563", cursor:"pointer", fontSize:12, fontWeight:700, WebkitTapHighlightColor:"transparent" }}>{s.short}</button>
            ))}
          </div>
        );

        return (
          <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", zIndex:50, display:"flex", alignItems:"flex-end", backdropFilter:"blur(6px)" }} onClick={() => setModal(null)}>
            <div style={{ width:"100%", maxWidth:430, margin:"0 auto", background:"#13151F", borderRadius:"20px 20px 0 0", padding:"20px 20px env(safe-area-inset-bottom,20px)", maxHeight:"88vh", overflowY:"auto" }} onClick={e => e.stopPropagation()}>
              <div style={{ width:36, height:4, borderRadius:2, background:"#2A3040", margin:"0 auto 18px" }} />

              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:20 }}>
                <div>
                  <div style={{ fontSize:12, color:"#4B5563" }}>{dateLabel}</div>
                  <div style={{ fontSize:18, fontWeight:800, color:"#F0EDE6", marginTop:2 }}>
                    {modalStep==="day" && "この日のタスク"}
                    {modalStep==="add" && "学習を追加"}
                    {modalStep==="edit" && "記録を編集"}
                    {modalStep==="sessionDetail" && "学習の詳細"}
                  </div>
                </div>
                {(modalStep==="add"||modalStep==="edit"||modalStep==="sessionDetail") && (
                  <button onClick={() => { setModalStep("day"); setEditingId(null); setSessionDetailTarget(null); }} style={{ background:"#1C1F2E", border:"none", color:"#9CA3AF", borderRadius:10, padding:"8px 14px", fontSize:13, cursor:"pointer", fontWeight:600 }}>← 戻る</button>
                )}
              </div>

              {/* ── DAY SUMMARY ── */}
              {modalStep==="day" && (
                <>
                  {modalTotalSecs > 0 && (
                    <div style={{ background:"#0D0F16", borderRadius:12, padding:"14px", marginBottom:16 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                        <div style={{ fontSize:11, letterSpacing:2, color:"#4B5563", textTransform:"uppercase" }}>⏱ 勉強時間</div>
                        <div style={{ fontSize:18, fontWeight:800, color:"#34D399", fontVariantNumeric:"tabular-nums" }}>{fmtTime(modalTotalSecs)}</div>
                      </div>
                      {subjects.filter(s => getSecsForDate(dk,s.id)>0).map(s => (
                        <div key={s.id} style={{ display:"flex", alignItems:"center", marginBottom:6 }}>
                          <div style={{ width:8, height:8, borderRadius:2, background:s.color, marginRight:8, flexShrink:0 }} />
                          <div style={{ fontSize:13, color:"#9CA3AF", flex:1 }}>{s.label}</div>
                          <div style={{ fontSize:13, fontWeight:700, color:"#6B7280", fontVariantNumeric:"tabular-nums" }}>{fmtTime(getSecsForDate(dk,s.id))}</div>
                        </div>
                      ))}
                      <div style={{ marginTop:12, borderTop:"1px solid #1C1F2E", paddingTop:10 }}>
                        <div style={{ height:220, overflowY:"scroll", WebkitOverflowScrolling:"touch", borderRadius:10, background:"#0A0C12", padding:"6px 8px" }}>
                          {HOURS24m.map(hour => {
                            const blocks = Array.from({ length:12 }, (_,i) => modalBlockColor(hour, i));
                            const hasAny = blocks.some(b => b);
                            const isCurHour = dk===today && new Date().getHours()===hour;
                            return (
                              <div key={hour} style={{ display:"flex", alignItems:"center", marginBottom:3 }}>
                                <div style={{ width:20, fontSize:10, textAlign:"right", marginRight:6, flexShrink:0, color: isCurHour?"#60A5FA":hasAny?"#4B5563":"#1E2130", fontWeight: isCurHour?800:400 }}>{hour}</div>
                                <div style={{ display:"flex", gap:2, flex:1 }}>
                                  {blocks.map((color,i) => <div key={i} style={{ flex:1, height:18, borderRadius:3, background: color==="break"?"#374151":color||(isCurHour?"#1A2035":"#13151F"), border: color?"none":"1px solid "+(isCurHour?"#1E3050":"#1A1D27"), opacity: color==="break"?0.6:1 }} />)}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                      <button onClick={() => { setAddTimeModal({ subjectId: subjects[0].id }); setAddTimeForm({ startTime:"", endTime:"", date: dk }); setModal(null); }} style={{ marginTop:10, width:"100%", padding:"9px", borderRadius:9, border:"1px dashed #2A3040", background:"transparent", color:"#60A5FA", fontSize:12, fontWeight:700, cursor:"pointer" }}>＋ 時間を手動追加</button>
                    </div>
                  )}
                  {!modalTotalSecs && (
                    <button onClick={() => { setAddTimeModal({ subjectId: subjects[0].id }); setAddTimeForm({ startTime:"", endTime:"", date: dk }); setModal(null); }} style={{ width:"100%", padding:"12px", borderRadius:12, border:"1px dashed #2A3040", background:"transparent", color:"#4B5563", fontSize:13, fontWeight:600, cursor:"pointer", marginBottom:12, display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>⏱ 勉強時間を手動追加</button>
                  )}
                  {isEmpty && !modalTotalSecs
                    ? <div style={{ textAlign:"center", padding:"16px 0 20px", color:"#2A3040", fontSize:14 }}>この日の記録はありません</div>
                    : (
                      <>
                        {dayStudies.length > 0 && (
                          <>
                            <div style={{ fontSize:11, letterSpacing:2, color:"#4B5563", textTransform:"uppercase", marginBottom:10 }}>学習記録</div>
                            {dayStudies.map(s => {
                              const sub = getSub(s.subject);
                              return (
                                <div key={s.id} onClick={() => { setSessionDetailTarget(s); setModalStep("sessionDetail"); }} style={{ padding:"12px 14px", background:"#0D0F16", borderRadius:12, borderLeft:"4px solid "+sub.color, marginBottom:8, cursor:"pointer", WebkitTapHighlightColor:"transparent" }}>
                                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                                    <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3 }}>
                                      <span style={{ fontSize:12, color:sub.color, fontWeight:700 }}>{sub.label}</span>
                                      {s.review === false && <span style={{ fontSize:10, padding:"2px 7px", background:"#1C1F2E", borderRadius:6, color:"#4B5563", fontWeight:600 }}>復習なし</span>}
                                    </div>
                                    <span style={{ fontSize:11, color:"#374151" }}>›</span>
                                  </div>
                                  <div style={{ fontSize:13, color:"#9CA3AF", lineHeight:1.5 }}>{s.content.length>50?s.content.slice(0,50)+"…":s.content}</div>
                                </div>
                              );
                            })}
                          </>
                        )}
                        {dayReviews.length > 0 && (
                          <>
                            <div style={{ fontSize:11, letterSpacing:2, color:"#4B5563", textTransform:"uppercase", marginBottom:10, marginTop: dayStudies.length>0?18:0 }}>復習予定</div>
                            {dayReviews.map((r,i) => {
                              const sub = getSub(r.subject);
                              const origD = new Date(r.date+"T00:00:00");
                              return (
                                <div key={i} style={{ padding:"12px 14px", background:"#0D0F16", borderRadius:12, borderLeft:"4px solid "+sub.color+"40", marginBottom:8 }}>
                                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                                    <span style={{ fontSize:12, color:sub.color+"CC", fontWeight:700 }}>🔄 {sub.label}</span>
                                    <span style={{ fontSize:11, padding:"2px 8px", background:"#13151F", borderRadius:6, color:"#60A5FA", fontWeight:600 }}>{r.intervalLabel}</span>
                                  </div>
                                  <div style={{ fontSize:13, color:"#6B7280", lineHeight:1.5 }}>{r.content}</div>
                                  <div style={{ fontSize:11, color:"#374151", marginTop:5 }}>学習日：{origD.getMonth()+1}/{origD.getDate()}</div>
                                </div>
                              );
                            })}
                          </>
                        )}
                      </>
                    )
                  }
                  <button onClick={() => { setForm({ subject:"financial", content:"", review:true }); setModalStep("add"); }} style={{ width:"100%", padding:"16px", borderRadius:14, border:"1.5px dashed #2A3040", background:"transparent", color:"#60A5FA", fontSize:15, fontWeight:700, cursor:"pointer", marginTop:16, display:"flex", alignItems:"center", justifyContent:"center", gap:8, WebkitTapHighlightColor:"transparent" }}>
                    <span style={{ fontSize:20 }}>＋</span> 学習を追加する
                  </button>
                </>
              )}

              {/* ── ADD FORM ── */}
              {modalStep==="add" && (
                <>
                  <div style={{ fontSize:12, color:"#4B5563", marginBottom:8 }}>科目を選ぶ</div>
                  <SubjectPicker value={form.subject} onChange={v => setForm(f => ({ ...f, subject:v }))} />
                  <div style={{ fontSize:12, color:"#4B5563", marginBottom:8 }}>学習内容</div>
                  <textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} placeholder="例：損益計算書の構造、製造間接費の配賦..." rows={3} style={{ width:"100%", boxSizing:"border-box", background:"#0D0F16", border:"1.5px solid #1C1F2E", borderRadius:12, padding:"14px", color:"#E5E1D8", fontSize:14, resize:"none", outline:"none", fontFamily:"inherit", marginBottom:14, lineHeight:1.5 }} />
                  <ReviewToggle val={form.review} onChange={() => setForm(f => ({ ...f, review: !f.review }))} />
                  {form.review && form.content.trim() && (
                    <div style={{ background:"#0D0F16", borderRadius:12, padding:"12px 14px", marginBottom:16 }}>
                      <div style={{ fontSize:11, color:"#374151", marginBottom:8 }}>復習予定日</div>
                      <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                        {INTERVALS.map(iv => { const rd = new Date(addDays(dk, iv.days)+"T00:00:00"); return <div key={iv.days} style={{ fontSize:11, padding:"5px 10px", background:"#13151F", borderRadius:8, color:"#60A5FA", fontWeight:600 }}>🔄 {iv.label}：{rd.getMonth()+1}/{rd.getDate()}</div>; })}
                      </div>
                    </div>
                  )}
                  <button onClick={addSession} disabled={!form.content.trim()} style={{ width:"100%", padding:"17px", borderRadius:14, border:"none", background: form.content.trim()?"linear-gradient(135deg,#3B82F6,#2563EB)":"#1C1F2E", color: form.content.trim()?"#fff":"#374151", fontSize:16, fontWeight:800, cursor: form.content.trim()?"pointer":"not-allowed" }}>記録する</button>
                </>
              )}

              {/* ── EDIT FORM ── */}
              {modalStep==="edit" && (
                <>
                  <div style={{ fontSize:12, color:"#4B5563", marginBottom:8 }}>科目を選ぶ</div>
                  <SubjectPicker value={form.subject} onChange={v => setForm(f => ({ ...f, subject:v }))} />
                  <div style={{ fontSize:12, color:"#4B5563", marginBottom:8 }}>学習内容</div>
                  <textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} rows={3} style={{ width:"100%", boxSizing:"border-box", background:"#0D0F16", border:"1.5px solid #1C1F2E", borderRadius:12, padding:"14px", color:"#E5E1D8", fontSize:14, resize:"none", outline:"none", fontFamily:"inherit", marginBottom:14, lineHeight:1.5 }} />
                  <ReviewToggle val={form.review} onChange={() => setForm(f => ({ ...f, review: !f.review }))} />
                  <div style={{ display:"flex", gap:10 }}>
                    <button onClick={() => { deleteSession(editingId); setModal(null); }} style={{ flex:1, padding:"15px", borderRadius:14, border:"1.5px solid #3D1A1A", background:"transparent", color:"#F87171", fontSize:13, fontWeight:700, cursor:"pointer" }}>削除</button>
                    <button onClick={saveEdit} disabled={!form.content.trim()} style={{ flex:2, padding:"15px", borderRadius:14, border:"none", background: form.content.trim()?"linear-gradient(135deg,#3B82F6,#2563EB)":"#1C1F2E", color: form.content.trim()?"#fff":"#374151", fontSize:15, fontWeight:800, cursor: form.content.trim()?"pointer":"not-allowed" }}>保存する</button>
                  </div>
                </>
              )}

              {/* ── SESSION DETAIL ── */}
              {modalStep==="sessionDetail" && sessionDetailTarget && (() => {
                const s = sessionDetailTarget;
                const sub = getSub(s.subject);
                return (
                  <>
                    <div style={{ background:"#0D0F16", borderRadius:14, padding:"16px", marginBottom:16, borderLeft:"4px solid "+sub.color }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
                        <span style={{ fontSize:14, color:sub.color, fontWeight:800 }}>{sub.label}</span>
                        {s.review === false && <span style={{ fontSize:10, padding:"2px 7px", background:"#1C1F2E", borderRadius:6, color:"#4B5563", fontWeight:600 }}>復習なし</span>}
                      </div>
                      <div style={{ fontSize:14, color:"#D1CCB8", lineHeight:1.7 }}>{s.content}</div>
                    </div>
                    {s.review !== false && (
                      <>
                        <div style={{ fontSize:11, letterSpacing:2, color:"#4B5563", textTransform:"uppercase", marginBottom:10 }}>🔄 復習スケジュール</div>
                        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:20 }}>
                          {INTERVALS.map(iv => {
                            const rd = new Date(addDays(s.date, iv.days)+"T00:00:00");
                            const isPast = rd < new Date();
                            const isToday2 = toKey(rd) === today;
                            return (
                              <div key={iv.days} style={{ padding:"12px 14px", borderRadius:12, background: isToday2?colorBg(sub.color):"#0D0F16", border:"1.5px solid "+(isToday2?sub.color:isPast?"#1C1F2E":"#1E2130") }}>
                                <div style={{ fontSize:11, color: isToday2?sub.color:isPast?"#374151":"#6B7280", fontWeight:700, marginBottom:4 }}>
                                  {iv.label}
                                  {isToday2 && <span style={{ marginLeft:6, fontSize:10, background:sub.color, color:"#000", borderRadius:4, padding:"1px 6px" }}>今日</span>}
                                  {isPast && !isToday2 && <span style={{ marginLeft:6, fontSize:10, color:"#374151" }}>済</span>}
                                </div>
                                <div style={{ fontSize:15, fontWeight:800, color: isPast&&!isToday2?"#374151":"#E5E1D8", fontVariantNumeric:"tabular-nums" }}>
                                  {rd.getMonth()+1}/{rd.getDate()}（{DAY_NAMES[rd.getDay()]}）
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}
                    <button onClick={() => toggleDone(s.id)} style={{ width:"100%", padding:"13px", borderRadius:12, border:"none", background: s.done?"#1C1F2E":"linear-gradient(135deg,#16A34A,#15803D)", color: s.done?"#4B5563":"#fff", fontSize:13, fontWeight:800, cursor:"pointer", marginBottom:10, display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
                      {s.done ? "↩ 未完了に戻す" : "✅ 完了にする"}
                    </button>
                    <button onClick={() => carryOverSession(s.id)} style={{ width:"100%", padding:"13px", borderRadius:12, border:"1.5px solid #2A3A20", background:"#0F1E0F", color:"#4ADE80", fontSize:13, fontWeight:700, cursor:"pointer", marginBottom:10, display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
                      📅 翌日へ繰り越す
                    </button>
                    <div style={{ display:"flex", gap:10 }}>
                      <button onClick={() => openEdit(s)} style={{ flex:2, padding:"14px", borderRadius:12, border:"none", background:"#1C1F2E", color:"#60A5FA", fontSize:14, fontWeight:700, cursor:"pointer" }}>✏ 編集</button>
                      <button onClick={() => { deleteSession(s.id); setModalStep("day"); }} style={{ flex:1, padding:"14px", borderRadius:12, border:"1.5px solid #3D1A1A", background:"transparent", color:"#F87171", fontSize:14, fontWeight:700, cursor:"pointer" }}>削除</button>
                    </div>
                  </>
                );
              })()}

            </div>
          </div>
        );
      })()}

      {/* Detail Modal (from Today/List tabs) */}
      {detailSession && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", zIndex:50, display:"flex", alignItems:"flex-end", backdropFilter:"blur(6px)" }} onClick={() => { setDetailSession(null); setEditingId(null); }}>
          <div style={{ width:"100%", maxWidth:430, margin:"0 auto", background:"#13151F", borderRadius:"20px 20px 0 0", padding:"20px 20px env(safe-area-inset-bottom,20px)", maxHeight:"88vh", overflowY:"auto" }} onClick={e => e.stopPropagation()}>
            <div style={{ width:36, height:4, borderRadius:2, background:"#2A3040", margin:"0 auto 20px" }} />
            {(() => {
              const s = detailSession;
              const sub = getSub(editingId===s.id ? editForm.subject : s.subject);
              const d = new Date(s.date+"T00:00:00");
              const isEditing = editingId === s.id;
              return (
                <>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:18 }}>
                    <div>
                      <div style={{ fontSize:12, color:"#4B5563" }}>{d.getMonth()+1}月{d.getDate()}日</div>
                      <div style={{ fontSize:17, fontWeight:800, color: isEditing?"#F0EDE6":sub.color, marginTop:2 }}>{isEditing?"記録を編集":sub.label}</div>
                    </div>
                    {!isEditing && <button onClick={() => startEdit(s)} style={{ padding:"8px 16px", borderRadius:10, border:"1.5px solid #2A3040", background:"#1C1F2E", color:"#9CA3AF", fontSize:13, fontWeight:700, cursor:"pointer" }}>✏ 編集</button>}
                    {isEditing && <button onClick={() => setEditingId(null)} style={{ padding:"8px 14px", borderRadius:10, border:"none", background:"#1C1F2E", color:"#6B7280", fontSize:13, fontWeight:600, cursor:"pointer" }}>キャンセル</button>}
                  </div>
                  {!isEditing && (
                    <>
                      <div style={{ fontSize:15, color:"#E5E1D8", lineHeight:1.7, marginBottom:16, padding:"14px", background:"#0D0F16", borderRadius:12 }}>{s.content}</div>
                      <div style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"6px 12px", borderRadius:8, background:"#0D0F16", marginBottom:16 }}>
                        <div style={{ width:7, height:7, borderRadius:"50%", background: s.review!==false?"#3B82F6":"#374151" }} />
                        <span style={{ fontSize:12, color: s.review!==false?"#60A5FA":"#4B5563", fontWeight:600 }}>{s.review!==false?"復習あり":"復習なし"}</span>
                      </div>
                      {s.review !== false && !s.intervalLabel && (
                        <>
                          <div style={{ fontSize:12, color:"#4B5563", marginBottom:10 }}>復習スケジュール</div>
                          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:20 }}>
                            {INTERVALS.map(iv => { const rd = new Date(addDays(s.date, iv.days)+"T00:00:00"); return <div key={iv.days} style={{ padding:"10px 12px", background:"#0D0F16", borderRadius:10, borderLeft:"3px solid "+sub.color }}><div style={{ fontSize:11, color:sub.color, fontWeight:700 }}>{iv.label}</div><div style={{ fontSize:13, color:"#9CA3AF", marginTop:3 }}>{rd.getMonth()+1}月{rd.getDate()}日</div></div>; })}
                          </div>
                        </>
                      )}
                      <button onClick={() => toggleDone(s.id)} style={{ width:"100%", padding:"13px", borderRadius:12, border:"none", background: s.done?"#1C1F2E":"linear-gradient(135deg,#16A34A,#15803D)", color: s.done?"#4B5563":"#fff", fontSize:13, fontWeight:800, cursor:"pointer", marginBottom:10, display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
                        {s.done ? "↩ 未完了に戻す" : "✅ 完了にする"}
                      </button>
                      <button onClick={() => { carryOverSession(s.id); setDetailSession(prev => prev ? {...prev, date: addDays(prev.date, 1)} : null); }} style={{ width:"100%", padding:"13px", borderRadius:12, border:"1.5px solid #2A3A20", background:"#0F1E0F", color:"#4ADE80", fontSize:13, fontWeight:700, cursor:"pointer", marginBottom:10, display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
                        📅 翌日へ繰り越す
                      </button>
                      <button onClick={() => deleteSession(s.id)} style={{ width:"100%", padding:16, borderRadius:14, border:"1.5px solid #3D1A1A", background:"transparent", color:"#F87171", fontSize:14, fontWeight:700, cursor:"pointer" }}>この記録を削除</button>
                    </>
                  )}
                  {isEditing && (
                    <>
                      <div style={{ fontSize:12, color:"#4B5563", marginBottom:8 }}>科目</div>
                      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:16 }}>
                        {subjects.map(s2 => <button key={s2.id} onClick={() => setEditForm(f => ({ ...f, subject: s2.id }))} style={{ padding:"12px 4px", borderRadius:12, border:"2px solid "+(editForm.subject===s2.id?s2.color:"transparent"), background: editForm.subject===s2.id?colorBg(s2.color):"#0D0F16", color: editForm.subject===s2.id?s2.color:"#4B5563", cursor:"pointer", fontSize:12, fontWeight:700 }}>{s2.short}</button>)}
                      </div>
                      <textarea value={editForm.content} onChange={e => setEditForm(f => ({ ...f, content: e.target.value }))} rows={4} style={{ width:"100%", boxSizing:"border-box", background:"#0D0F16", border:"1.5px solid #3B82F6", borderRadius:12, padding:"14px", color:"#E5E1D8", fontSize:14, resize:"none", outline:"none", fontFamily:"inherit", marginBottom:14, lineHeight:1.5 }} />
                      <button onClick={() => setEditForm(f => ({ ...f, review: !f.review }))} style={{ width:"100%", padding:"14px 16px", borderRadius:12, marginBottom:14, border:"1.5px solid "+(editForm.review?"#3B82F6":"#1C1F2E"), background: editForm.review?"#1E3A5F":"#0D0F16", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                        <div><div style={{ fontSize:13, fontWeight:700, color: editForm.review?"#60A5FA":"#4B5563", textAlign:"left" }}>🔄 復習スケジュールを設定する</div><div style={{ fontSize:11, color:"#374151", marginTop:3 }}>{editForm.review?"翌日・1週間・2週間・1ヶ月後":"復習なし（答練など）"}</div></div>
                        <div style={{ width:44, height:26, borderRadius:13, flexShrink:0, marginLeft:12, background: editForm.review?"#3B82F6":"#1C1F2E", position:"relative" }}>
                          <div style={{ position:"absolute", top:3, left: editForm.review?21:3, width:20, height:20, borderRadius:"50%", background: editForm.review?"#fff":"#374151", transition:"left 0.2s" }} />
                        </div>
                      </button>
                      <button onClick={saveEditDetail} disabled={!editForm.content.trim()} style={{ width:"100%", padding:"17px", borderRadius:14, border:"none", background: editForm.content.trim()?"linear-gradient(135deg,#3B82F6,#2563EB)":"#1C1F2E", color: editForm.content.trim()?"#fff":"#374151", fontSize:16, fontWeight:800, cursor: editForm.content.trim()?"pointer":"not-allowed" }}>保存する</button>
                    </>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {settingsOpen && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.8)", zIndex:60, display:"flex", alignItems:"flex-end", backdropFilter:"blur(6px)" }} onClick={() => { setSettingsOpen(false); setColorPicking(null); setEditingSubjectId(null); }}>
          <div style={{ width:"100%", maxWidth:430, margin:"0 auto", background:"#13151F", borderRadius:"20px 20px 0 0", padding:"20px 20px env(safe-area-inset-bottom,24px)", maxHeight:"80vh", overflowY:"auto" }} onClick={e => e.stopPropagation()}>
            <div style={{ width:36, height:4, borderRadius:2, background:"#2A3040", margin:"0 auto 20px" }} />
            <div style={{ fontSize:18, fontWeight:800, color:"#F0EDE6", marginBottom:6 }}>科目設定</div>
            <div style={{ fontSize:12, color:"#4B5563", marginBottom:20 }}>タップして名前・色を変更、追加・削除もできます</div>
            {subjects.map(s => (
              <div key={s.id}>
                <div style={{ display:"flex", alignItems:"center", gap:10, padding:"12px 14px", background:"#0D0F16", borderRadius: colorPicking===s.id?"12px 12px 0 0":12, marginBottom: colorPicking===s.id?0:8, border:"1.5px solid "+(colorPicking===s.id?s.color:"transparent"), borderBottom: colorPicking===s.id?"none":undefined }}>
                  <div onClick={() => { setColorPicking(colorPicking===s.id?null:s.id); setEditingSubjectId(null); }} style={{ width:28, height:28, borderRadius:"50%", background:s.color, flexShrink:0, cursor:"pointer" }} />
                  {editingSubjectId === s.id ? (
                    <input
                      autoFocus
                      value={editingSubjectLabel}
                      onChange={e => setEditingSubjectLabel(e.target.value)}
                      onBlur={() => {
                        if (editingSubjectLabel.trim()) {
                          const short = editingSubjectLabel.trim().slice(0, 2);
                          setSubjects(prev => prev.map(x => x.id===s.id ? { ...x, label: editingSubjectLabel.trim(), short } : x));
                        }
                        setEditingSubjectId(null);
                      }}
                      onKeyDown={e => e.key==="Enter" && e.target.blur()}
                      style={{ flex:1, background:"#1C1F2E", border:"1.5px solid #3B82F6", borderRadius:8, padding:"6px 10px", color:"#E5E1D8", fontSize:14, fontWeight:700, outline:"none", fontFamily:"inherit" }}
                    />
                  ) : (
                    <div onClick={() => { setEditingSubjectId(s.id); setEditingSubjectLabel(s.label); setColorPicking(null); }} style={{ flex:1, fontSize:15, fontWeight:700, color:"#E5E1D8", cursor:"pointer" }}>{s.label}</div>
                  )}
                  {subjects.length > 1 && (
                    <button onClick={() => { setSubjects(prev => prev.filter(x => x.id !== s.id)); setColorPicking(null); setEditingSubjectId(null); }} style={{ background:"none", border:"none", color:"#374151", fontSize:20, cursor:"pointer", padding:"4px", flexShrink:0 }}>×</button>
                  )}
                </div>
                {colorPicking===s.id && (
                  <div style={{ background:"#0D0F16", borderRadius:"0 0 12px 12px", padding:"14px 16px 16px", marginBottom:8, border:"1.5px solid "+s.color, borderTop:"none" }}>
                    <div style={{ display:"grid", gridTemplateColumns:"repeat(8,1fr)", gap:10 }}>
                      {COLOR_PALETTE.map(c => (
                        <button key={c} onClick={() => { setSubjects(prev => prev.map(x => x.id===s.id?{ ...x, color:c }:x)); setColorPicking(null); }} style={{ width:"100%", aspectRatio:"1", borderRadius:10, border:"3px solid "+(s.color===c?"#fff":"transparent"), background:c, cursor:"pointer" }} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
            <button onClick={() => {
              const newId = "subject_" + Date.now();
              const colors = ["#60A5FA","#34D399","#FBBF24","#C084FC","#F87171","#38BDF8"];
              const color = colors[subjects.length % colors.length];
              setSubjects(prev => [...prev, { id: newId, label: "新しい科目", short: "新規", color }]);
              setEditingSubjectId(newId);
              setEditingSubjectLabel("新しい科目");
            }} style={{ width:"100%", padding:"14px", borderRadius:12, border:"1.5px dashed #2A3040", background:"transparent", color:"#60A5FA", fontSize:14, fontWeight:700, cursor:"pointer", marginTop:4, marginBottom:12 }}>＋ 科目を追加</button>
            <button onClick={() => { setSubjects(DEFAULT_SUBJECTS); setColorPicking(null); setEditingSubjectId(null); }} style={{ width:"100%", padding:"14px", borderRadius:12, border:"1px solid #1C1F2E", background:"transparent", color:"#4B5563", fontSize:13, fontWeight:600, cursor:"pointer" }}>デフォルトに戻す</button>
          </div>
        </div>
      )}

      {/* Confirm Reset Modal */}
      {confirmReset && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.8)", zIndex:70, display:"flex", alignItems:"center", justifyContent:"center", padding:"24px", backdropFilter:"blur(6px)" }} onClick={() => setConfirmReset(false)}>
          <div style={{ width:"100%", maxWidth:340, background:"#13151F", borderRadius:20, padding:"28px 24px", border:"1px solid #2A3040" }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize:40, textAlign:"center", marginBottom:12 }}>⚠️</div>
            <div style={{ fontSize:18, fontWeight:800, color:"#F0EDE6", textAlign:"center", marginBottom:8 }}>今日のデータをリセット</div>
            <div style={{ fontSize:13, color:"#6B7280", textAlign:"center", lineHeight:1.6, marginBottom:24 }}>今日の全タイマー記録が削除されます。<br />この操作は元に戻せません。</div>
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={() => setConfirmReset(false)} style={{ flex:1, padding:"14px", borderRadius:12, border:"1.5px solid #2A3040", background:"transparent", color:"#9CA3AF", fontSize:14, fontWeight:700, cursor:"pointer" }}>キャンセル</button>
              <button onClick={() => { resetAllTimers(); setConfirmReset(false); }} style={{ flex:1, padding:"14px", borderRadius:12, border:"none", background:"#7F1D1D", color:"#F87171", fontSize:14, fontWeight:800, cursor:"pointer" }}>削除する</button>
            </div>
          </div>
        </div>
      )}

      {/* Log Detail Modal */}
      {logDetailModal && (() => {
        const { log } = logDetailModal;
        const sub = getSub(logEditMode ? logEditForm.subjectId : log.subjectId);
        const secs = Math.floor((log.end-log.start)/1000);
        const startD = new Date(log.start), endD = new Date(log.end);
        const fmt = d => String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0");

        // 編集時の計算
        let editDurationSecs = 0, editIsValid = false;
        if (logEditMode && logEditForm.startTime && logEditForm.endTime) {
          const [sh,sm] = logEditForm.startTime.split(":").map(Number);
          const [eh,em] = logEditForm.endTime.split(":").map(Number);
          const base = new Date(new Date(log.start).toDateString()).getTime();
          const startTs = base + (sh*60+sm)*60000;
          let endTs = base + (eh*60+em)*60000;
          if (endTs <= startTs) endTs += 86400000;
          editDurationSecs = Math.floor((endTs-startTs)/1000);
          editIsValid = editDurationSecs > 0;
        }

        return (
          <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.8)", zIndex:70, display:"flex", alignItems:"flex-end", backdropFilter:"blur(6px)" }} onClick={() => { setLogDetailModal(null); setLogEditMode(false); }}>
            <div style={{ width:"100%", maxWidth:430, margin:"0 auto", background:"#13151F", borderRadius:"20px 20px 0 0", padding:"24px 20px env(safe-area-inset-bottom,24px)" }} onClick={e => e.stopPropagation()}>
              <div style={{ width:36, height:4, borderRadius:2, background:"#2A3040", margin:"0 auto 20px" }} />

              {/* ヘッダー */}
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:18 }}>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <div style={{ width:12, height:12, borderRadius:3, background:sub.color }} />
                  <div style={{ fontSize:16, fontWeight:800, color:sub.color }}>{logEditMode ? "記録を編集" : sub.label}</div>
                  {!logEditMode && log.manual && <span style={{ fontSize:10, padding:"2px 7px", background:"#1C1F2E", borderRadius:5, color:"#4B5563", fontWeight:600 }}>手動追加</span>}
                </div>
                {!logEditMode
                  ? <button onClick={() => { setLogEditMode(true); setLogEditForm({ subjectId: log.subjectId, startTime: fmt(startD), endTime: fmt(endD) }); }} style={{ padding:"7px 14px", borderRadius:10, border:"1.5px solid #2A3040", background:"#1C1F2E", color:"#9CA3AF", fontSize:13, fontWeight:700, cursor:"pointer" }}>✏ 編集</button>
                  : <button onClick={() => setLogEditMode(false)} style={{ padding:"7px 14px", borderRadius:10, border:"none", background:"#1C1F2E", color:"#6B7280", fontSize:13, cursor:"pointer" }}>キャンセル</button>
                }
              </div>

              {!logEditMode ? (
                <>
                  <div style={{ background:"#0D0F16", borderRadius:12, padding:"14px 16px", marginBottom:16 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                      <span style={{ fontSize:12, color:"#4B5563" }}>時間帯</span>
                      <span style={{ fontSize:15, fontWeight:700, color:"#E5E1D8", fontVariantNumeric:"tabular-nums" }}>{fmt(startD)} → {fmt(endD)}</span>
                    </div>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <span style={{ fontSize:12, color:"#4B5563" }}>合計</span>
                      <span style={{ fontSize:20, fontWeight:800, color:sub.color, fontVariantNumeric:"tabular-nums" }}>{fmtTime(secs)}</span>
                    </div>
                  </div>
                  <div style={{ display:"flex", gap:10 }}>
                    <button onClick={() => { setLogDetailModal(null); setLogEditMode(false); }} style={{ flex:1, padding:"13px", borderRadius:12, border:"1.5px solid #2A3040", background:"transparent", color:"#9CA3AF", fontSize:13, fontWeight:700, cursor:"pointer" }}>閉じる</button>
                    <button onClick={() => deleteLog(log)} style={{ flex:1, padding:"13px", borderRadius:12, border:"none", background:"#7F1D1D", color:"#F87171", fontSize:13, fontWeight:800, cursor:"pointer" }}>削除</button>
                  </div>
                </>
              ) : (
                <>
                  {/* 科目選択 */}
                  <div style={{ fontSize:12, color:"#4B5563", marginBottom:8 }}>科目</div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:18 }}>
                    {subjects.map(s => (
                      <button key={s.id} onClick={() => setLogEditForm(f => ({ ...f, subjectId: s.id }))} style={{ padding:"11px 4px", borderRadius:12, border:"2px solid "+(logEditForm.subjectId===s.id?s.color:"transparent"), background: logEditForm.subjectId===s.id?colorBg(s.color):"#0D0F16", color: logEditForm.subjectId===s.id?s.color:"#4B5563", cursor:"pointer", fontSize:12, fontWeight:700 }}>{s.short}</button>
                    ))}
                  </div>

                  {/* 時間帯 */}
                  <div style={{ fontSize:12, color:"#4B5563", marginBottom:8 }}>時間帯</div>
                  <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:11, color:"#4B5563", marginBottom:4, textAlign:"center" }}>開始</div>
                      <input type="time" value={logEditForm.startTime} onChange={e => setLogEditForm(f => ({ ...f, startTime: e.target.value }))} style={{ width:"100%", boxSizing:"border-box", padding:"14px 10px", borderRadius:12, background:"#0D0F16", border:"1.5px solid "+(logEditForm.startTime?"#3B82F6":"#1C1F2E"), color:"#E5E1D8", fontSize:20, fontWeight:800, textAlign:"center", outline:"none", fontFamily:"inherit" }} />
                    </div>
                    <div style={{ fontSize:20, color:"#4B5563", fontWeight:300, paddingTop:20 }}>→</div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:11, color:"#4B5563", marginBottom:4, textAlign:"center" }}>終了</div>
                      <input type="time" value={logEditForm.endTime} onChange={e => setLogEditForm(f => ({ ...f, endTime: e.target.value }))} style={{ width:"100%", boxSizing:"border-box", padding:"14px 10px", borderRadius:12, background:"#0D0F16", border:"1.5px solid "+(logEditForm.endTime?"#3B82F6":"#1C1F2E"), color:"#E5E1D8", fontSize:20, fontWeight:800, textAlign:"center", outline:"none", fontFamily:"inherit" }} />
                    </div>
                  </div>

                  {/* 計算結果 */}
                  <div style={{ padding:"12px 16px", borderRadius:12, marginBottom:18, background: editIsValid?colorBg(getSub(logEditForm.subjectId).color):"#0D0F16", border:"1.5px solid "+(editIsValid?getSub(logEditForm.subjectId).color:"#1C1F2E"), display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                    <div style={{ fontSize:12, color:"#4B5563" }}>計算結果</div>
                    <div style={{ fontSize:22, fontWeight:800, color: editIsValid?getSub(logEditForm.subjectId).color:"#2A3040", fontVariantNumeric:"tabular-nums" }}>
                      {editIsValid ? Math.floor(editDurationSecs/3600)+"時間 "+Math.floor((editDurationSecs%3600)/60)+"分" : "---"}
                    </div>
                  </div>

                  <button onClick={() => {
                    const [sh,sm] = logEditForm.startTime.split(":").map(Number);
                    const [eh,em] = logEditForm.endTime.split(":").map(Number);
                    const base = new Date(new Date(log.start).toDateString()).getTime();
                    const startTs = base + (sh*60+sm)*60000;
                    let endTs = base + (eh*60+em)*60000;
                    if (endTs <= startTs) endTs += 86400000;
                    editLog(log, logEditForm.subjectId, startTs, endTs);
                  }} disabled={!editIsValid} style={{ width:"100%", padding:"16px", borderRadius:14, border:"none", background: editIsValid?"linear-gradient(135deg,#3B82F6,#2563EB)":"#1C1F2E", color: editIsValid?"#fff":"#374151", fontSize:15, fontWeight:800, cursor: editIsValid?"pointer":"not-allowed" }}>保存する</button>
                </>
              )}
            </div>
          </div>
        );
      })()}

      {/* Add Time Modal */}
      {addTimeModal && (() => {
        let durationSecs = 0, isValid = false;
        if (addTimeForm.startTime && addTimeForm.endTime) {
          const [sh,sm] = addTimeForm.startTime.split(":").map(Number);
          const [eh,em] = addTimeForm.endTime.split(":").map(Number);
          const base = new Date(addTimeForm.date+"T00:00:00").getTime();
          const startTs = base + (sh*60+sm)*60000;
          let endTs = base + (eh*60+em)*60000;
          if (endTs <= startTs) endTs += 86400000;
          durationSecs = Math.floor((endTs-startTs)/1000);
          isValid = durationSecs > 0;
        }
        const durH = Math.floor(durationSecs/3600), durM = Math.floor((durationSecs%3600)/60);
        const sub = getSub(addTimeModal.subjectId);
        return (
          <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.8)", zIndex:70, display:"flex", alignItems:"flex-end", backdropFilter:"blur(6px)" }} onClick={() => setAddTimeModal(null)}>
            <div style={{ width:"100%", maxWidth:430, margin:"0 auto", background:"#13151F", borderRadius:"20px 20px 0 0", padding:"20px 20px env(safe-area-inset-bottom,24px)" }} onClick={e => e.stopPropagation()}>
              <div style={{ width:36, height:4, borderRadius:2, background:"#2A3040", margin:"0 auto 20px" }} />
              <div style={{ fontSize:18, fontWeight:800, color:"#F0EDE6", marginBottom:18 }}>⏱ 時間を手動追加</div>
              <div style={{ fontSize:12, color:"#4B5563", marginBottom:6 }}>日付</div>
              <input type="date" value={addTimeForm.date} onChange={e => setAddTimeForm(f => ({ ...f, date: e.target.value }))} style={{ width:"100%", boxSizing:"border-box", padding:"12px 14px", borderRadius:12, background:"#0D0F16", border:"1.5px solid #1C1F2E", color:"#E5E1D8", fontSize:14, outline:"none", marginBottom:16, fontFamily:"inherit" }} />
              <div style={{ fontSize:12, color:"#4B5563", marginBottom:8 }}>科目</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:18 }}>
                {subjects.map(s => <button key={s.id} onClick={() => setAddTimeModal({ subjectId: s.id })} style={{ padding:"11px 4px", borderRadius:12, border:"2px solid "+(addTimeModal.subjectId===s.id?s.color:"transparent"), background: addTimeModal.subjectId===s.id?colorBg(s.color):"#0D0F16", color: addTimeModal.subjectId===s.id?s.color:"#4B5563", cursor:"pointer", fontSize:12, fontWeight:700 }}>{s.short}</button>)}
              </div>
              <div style={{ fontSize:12, color:"#4B5563", marginBottom:8 }}>時間帯</div>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:11, color:"#4B5563", marginBottom:4, textAlign:"center" }}>開始</div>
                  <input type="time" value={addTimeForm.startTime} onChange={e => setAddTimeForm(f => ({ ...f, startTime: e.target.value }))} style={{ width:"100%", boxSizing:"border-box", padding:"14px 10px", borderRadius:12, background:"#0D0F16", border:"1.5px solid "+(addTimeForm.startTime?"#3B82F6":"#1C1F2E"), color:"#E5E1D8", fontSize:20, fontWeight:800, textAlign:"center", outline:"none", fontFamily:"inherit" }} />
                </div>
                <div style={{ fontSize:20, color:"#4B5563", fontWeight:300, paddingTop:20 }}>→</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:11, color:"#4B5563", marginBottom:4, textAlign:"center" }}>終了</div>
                  <input type="time" value={addTimeForm.endTime} onChange={e => setAddTimeForm(f => ({ ...f, endTime: e.target.value }))} style={{ width:"100%", boxSizing:"border-box", padding:"14px 10px", borderRadius:12, background:"#0D0F16", border:"1.5px solid "+(addTimeForm.endTime?"#3B82F6":"#1C1F2E"), color:"#E5E1D8", fontSize:20, fontWeight:800, textAlign:"center", outline:"none", fontFamily:"inherit" }} />
                </div>
              </div>
              <div style={{ padding:"12px 16px", borderRadius:12, marginBottom:18, background: isValid?colorBg(sub.color):"#0D0F16", border:"1.5px solid "+(isValid?sub.color:"#1C1F2E"), display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <div style={{ fontSize:12, color:"#4B5563" }}>計算結果</div>
                <div style={{ fontSize:22, fontWeight:800, color: isValid?sub.color:"#2A3040", fontVariantNumeric:"tabular-nums" }}>{isValid ? durH+"時間 "+durM+"分" : "---"}</div>
              </div>
              <button onClick={() => {
                if (!isValid) return;
                const [sh,sm] = addTimeForm.startTime.split(":").map(Number);
                const [eh,em] = addTimeForm.endTime.split(":").map(Number);
                const base = new Date(addTimeForm.date+"T00:00:00").getTime();
                const startTs = base + (sh*60+sm)*60000;
                let endTs = base + (eh*60+em)*60000;
                if (endTs <= startTs) endTs += 86400000;
                addManualTime(addTimeModal.subjectId, startTs, endTs);
                setAddTimeModal(null);
              }} style={{ width:"100%", padding:"16px", borderRadius:14, border:"none", background: isValid?"linear-gradient(135deg,#3B82F6,#2563EB)":"#1C1F2E", color: isValid?"#fff":"#374151", fontSize:15, fontWeight:800, cursor: isValid?"pointer":"not-allowed" }}>追加する</button>
            </div>
          </div>
        );
      })()}

    </div>
  );
}

function SessionCard({ s, subjects, showDate, onTap }) {
  const sub = subjects.find(x => x.id===s.subject)||subjects[0];
  const d = new Date(s.date+"T00:00:00");
  return (
    <div onClick={onTap} style={{ padding:"14px 16px", background:"#13151F", borderRadius:14, borderLeft:"4px solid "+(s.done?sub.color+"50":sub.color), marginBottom:10, cursor:"pointer", WebkitTapHighlightColor:"transparent", opacity: s.done?0.75:1 }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5 }}>
        {s.done && <span style={{ fontSize:13 }}>✅</span>}
        <span style={{ fontSize:12, fontWeight:800, color:s.done?sub.color+"80":sub.color, textDecoration: s.done?"line-through":"none" }}>{sub.label}</span>
        {s.review===false && <span style={{ fontSize:10, padding:"2px 6px", background:"#1C1F2E", borderRadius:5, color:"#4B5563" }}>復習なし</span>}
        {showDate && <span style={{ fontSize:11, color:"#374151", marginLeft:"auto" }}>{d.getMonth()+1}/{d.getDate()}</span>}
      </div>
      <div style={{ fontSize:13, color: s.done?"#6B7280":"#9CA3AF", lineHeight:1.5 }}>{s.content.length>60?s.content.slice(0,60)+"…":s.content}</div>
    </div>
  );
}

function ReviewCard({ r, subjects, showDate, onTap }) {
  const sub = subjects.find(x => x.id===r.subject)||subjects[0];
  return (
    <div onClick={onTap} style={{ padding:"12px 16px", background:"#13151F", borderRadius:14, borderLeft:"4px solid "+sub.color+"40", marginBottom:8, cursor:"pointer", WebkitTapHighlightColor:"transparent" }}>
      <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
        <span style={{ fontSize:11, color:sub.color+"CC", fontWeight:700 }}>🔄 {sub.label}</span>
        <span style={{ fontSize:11, color:"#374151" }}>· {r.intervalLabel}</span>
        {showDate && <span style={{ fontSize:11, color:"#374151", marginLeft:"auto" }}>{r.dateLabel}</span>}
      </div>
      <div style={{ fontSize:12, color:"#4B5563", lineHeight:1.4 }}>{r.content.length>55?r.content.slice(0,55)+"…":r.content}</div>
    </div>
  );
}

const navBtn = {
  width:36, height:36, borderRadius:"50%", border:"1.5px solid #1C1F2E", background:"#13151F",
  color:"#9CA3AF", fontSize:22, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
  WebkitTapHighlightColor:"transparent",
};
