import React, { useRef, useState } from "react";
import { COLOR_PALETTE, DEFAULT_SUBJECTS } from "../lib/constants";
import { makeId } from "../lib/storage";
import { todayKey } from "../lib/time";
import * as sync from "../lib/sync";
import Sheet from "./Sheet";

export default function Settings({ app, onClose }) {
  return (
    <Sheet title="設定" onClose={onClose}>
      <SyncSettings app={app} />
      <SubjectSettings app={app} />
      <BreakColor app={app} />
      <Backup app={app} />
    </Sheet>
  );
}

function SyncSettings({ app }) {
  const { syncCfg, setSyncCfg, syncState, pending, flush, queueAll, refreshSchedule, configured } = app;
  const [url, setUrl] = useState(syncCfg.url);
  const [token, setToken] = useState(syncCfg.token);
  const [test, setTest] = useState(null);

  async function connect() {
    const cfg = { url: url.trim(), token: token.trim() };
    if (!/^https:\/\/script\.google\.com\//.test(cfg.url)) {
      setTest({ ok: false, message: "URLは https://script.google.com/ で始まるものを貼ってください" });
      return;
    }
    if (!cfg.token) {
      setTest({ ok: false, message: "合言葉を入れてください" });
      return;
    }
    setTest({ loading: true });
    try {
      await sync.ping(cfg);
      const first = !configured;
      setSyncCfg(cfg);
      if (first) queueAll();
      setTest({ ok: true, message: first ? "つながりました。これまでの記録をシートに送ります" : "つながりました" });
    } catch (e) {
      setTest({ ok: false, message: e.message === "Failed to fetch" ? "接続できませんでした。URLとデプロイの「アクセスできるユーザー：全員」を確認してください" : e.message });
    }
  }
  function disconnect() {
    if (!window.confirm("スプレッドシートとの接続を解除しますか？（アプリ内の記録は消えません）")) return;
    setSyncCfg({ url: "", token: "" });
    setUrl("");
    setToken("");
    setTest(null);
  }

  return (
    <section className="settings-section">
      <h3>スプレッドシート同期</h3>
      <p className="muted small">予定はシートの「ToDo・実績」から読み込み（書き込みはしません）、計測した時間は「アプリ記録」タブに書き込みます。設定方法はリポジトリの <code>apps-script/README.md</code> を見てください。</p>
      <div className="field">
        <label>ウェブアプリのURL</label>
        <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://script.google.com/macros/s/…/exec" autoComplete="off" />
      </div>
      <div className="field">
        <label>合言葉（スクリプトの TOKEN と同じもの）</label>
        <input type="password" value={token} onChange={(e) => setToken(e.target.value)} autoComplete="off" />
      </div>
      <div className="row">
        <button className="btn primary" onClick={connect} disabled={test && test.loading}>{test && test.loading ? "確認中…" : configured ? "保存して接続テスト" : "接続する"}</button>
        {configured && <button className="btn ghost" onClick={disconnect}>接続を解除</button>}
      </div>
      {test && !test.loading && <p className={"notice " + (test.ok ? "ok" : "error")}>{test.message}</p>}
      {configured && (
        <div className="sync-info">
          <div>送信待ち：{pending}件{syncState.status === "syncing" && "（送信中…）"}</div>
          {syncState.status === "ok" && <div>最終送信：{new Date(syncState.at).toLocaleTimeString("ja-JP")}</div>}
          {syncState.status === "error" && <div className="error-text">送信エラー：{syncState.message}</div>}
          <div className="row">
            <button className="btn small" onClick={() => { flush(); refreshSchedule(); }}>今すぐ同期</button>
            <button className="btn small ghost" onClick={() => window.confirm("すべての記録をシートの「アプリ記録」に送り直しますか？") && queueAll()}>全記録を送り直す</button>
          </div>
        </div>
      )}
    </section>
  );
}

// シートの「設定」にある科目のうち、計測しないもの
const NON_STUDY = ["計画", "相談", "手続", "休憩"];
// 初期設定の科目名とシートの科目名の対応（過去の記録をそのまま引き継ぐため）
const SHEET_ALIASES = { "財務会計": "財計", "財務計算": "財計", "財務理論": "財理", "管理会計": "管理", "監査論": "監査", "企業法": "企業", "租税法": "租税", "経営学": "経営" };

function SubjectSettings({ app }) {
  const { subjects, setSubjects, logs, queue, schedule } = app;
  const [picking, setPicking] = useState(null);
  const sheetNames = (schedule.sheetSubjects || []).filter((n) => n && !NON_STUDY.includes(n));
  const matches = sheetNames.every((n) => subjects.some((s) => s.label === n));

  function adoptSheet() {
    if (!window.confirm("アプリの科目をシートの科目（" + sheetNames.join("・") + "）に合わせますか？\n今までの記録は対応する科目に引き継がれます。")) return;
    const used = new Set();
    const next = sheetNames.map((name) => {
      const found = subjects.find((s) => !used.has(s.id) && (s.label === name || SHEET_ALIASES[s.label] === name));
      if (found) {
        used.add(found.id);
        return { ...found, label: name, short: name.slice(0, 2) };
      }
      return { id: makeId("subject"), label: name, short: name.slice(0, 2), color: "" };
    });
    const rest = subjects.filter((s) => !used.has(s.id));
    const colors = new Set(next.map((s) => s.color).filter(Boolean));
    next.forEach((s) => {
      if (!s.color) {
        s.color = COLOR_PALETTE.find((c) => !colors.has(c)) || COLOR_PALETTE[0];
        colors.add(s.color);
      }
    });
    setSubjects([...next, ...rest]);
  }

  const update = (id, fields) => setSubjects((p) => p.map((s) => (s.id === id ? { ...s, ...fields } : s)));
  function rename(s, label) {
    const v = label.trim();
    if (!v || v === s.label) return;
    update(s.id, { label: v, short: v.slice(0, 2) });
    // シートの「科目」列を新しい名前に揃える
    queue(logs.filter((l) => l.subjectId === s.id).map((l) => [l.id, "study"]));
  }
  function move(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= subjects.length) return;
    const a = [...subjects];
    [a[i], a[j]] = [a[j], a[i]];
    setSubjects(a);
  }
  function del(s) {
    if (!window.confirm("「" + s.label + "」を削除しますか？\nこの科目の過去の記録は残りますが、科目名は表示されなくなります。")) return;
    setSubjects((p) => p.filter((x) => x.id !== s.id));
  }
  function add() {
    const used = new Set(subjects.map((s) => s.color));
    const color = COLOR_PALETTE.find((c) => !used.has(c)) || COLOR_PALETTE[0];
    setSubjects((p) => [...p, { id: makeId("subject"), label: "新しい科目", short: "新規", color }]);
  }

  return (
    <section className="settings-section">
      <h3>科目</h3>
      <p className="muted small">シートの「科目」と同じ名前にすると、予定に色が付き、予定から計測を始められます。</p>
      {sheetNames.length > 0 && !matches && (
        <button className="btn primary block" onClick={adoptSheet}>シートの科目に合わせる（{sheetNames.join("・")}）</button>
      )}
      {subjects.map((s, i) => (
        <div key={s.id} className="subject-edit">
          <div className="subject-edit-row">
            <button className="swatch" style={{ background: s.color }} onClick={() => setPicking(picking === s.id ? null : s.id)} aria-label="色を変える" />
            <input key={s.label} defaultValue={s.label} onBlur={(e) => rename(s, e.target.value)} onKeyDown={(e) => e.key === "Enter" && e.target.blur()} aria-label="科目名" />
            <button className="btn ghost small" onClick={() => move(i, -1)} disabled={i === 0} aria-label="上へ">↑</button>
            <button className="btn ghost small" onClick={() => move(i, 1)} disabled={i === subjects.length - 1} aria-label="下へ">↓</button>
            {subjects.length > 1 && <button className="btn ghost small danger-text" onClick={() => del(s)} aria-label="削除">✕</button>}
          </div>
          {picking === s.id && (
            <div className="palette">
              {COLOR_PALETTE.map((c) => <button key={c} className={"swatch" + (s.color === c ? " on" : "")} style={{ background: c }} onClick={() => { update(s.id, { color: c }); setPicking(null); }} aria-label={c} />)}
            </div>
          )}
        </div>
      ))}
      <div className="row">
        <button className="btn" onClick={add}>＋ 科目を追加</button>
        <button className="btn ghost" onClick={() => window.confirm("科目を初期設定に戻しますか？") && setSubjects(DEFAULT_SUBJECTS)}>初期設定に戻す</button>
      </div>
    </section>
  );
}

function BreakColor({ app }) {
  const { breakColor, setBreakColor } = app;
  return (
    <section className="settings-section">
      <h3>休憩の色</h3>
      <div className="palette">
        {COLOR_PALETTE.map((c) => <button key={c} className={"swatch" + (breakColor === c ? " on" : "")} style={{ background: c }} onClick={() => setBreakColor(c)} aria-label={c} />)}
      </div>
    </section>
  );
}

function Backup({ app }) {
  const { subjects, logs, breaks, examDate, breakColor, setSubjects, setLogs, setBreaks, setExamDate, setBreakColor, queue } = app;
  const fileRef = useRef(null);
  const [msg, setMsg] = useState(null);

  function exportData() {
    const data = { app: "cpa-study-tracker", version: 2, exportedAt: new Date().toISOString(), subjects, logs, breaks, examDate, breakColor };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "cpa-study-backup-" + todayKey() + ".json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function importData(e) {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.logs) || !Array.isArray(data.subjects)) throw new Error();
      if (!window.confirm("今のデータをバックアップの内容に置き換えますか？\n（記録 " + data.logs.length + "件）")) return;
      const newLogs = data.logs.filter((l) => l.id && l.end > l.start);
      const newBreaks = (data.breaks || []).filter((l) => l.id && l.end > l.start);
      const keep = new Set([...newLogs, ...newBreaks].map((l) => l.id));
      setSubjects(data.subjects);
      setLogs(newLogs);
      setBreaks(newBreaks);
      if (data.examDate !== undefined) setExamDate(data.examDate);
      if (data.breakColor) setBreakColor(data.breakColor);
      queue([...newLogs.map((l) => [l.id, "study"]), ...newBreaks.map((l) => [l.id, "break"])],
        [...logs, ...breaks].map((l) => l.id).filter((id) => !keep.has(id)));
      setMsg({ ok: true, text: "読み込みました" });
    } catch {
      setMsg({ ok: false, text: "このファイルは読み込めませんでした" });
    }
  }

  return (
    <section className="settings-section">
      <h3>バックアップ</h3>
      <p className="muted small">記録はこの端末のブラウザに保存されています。機種変更の前などに書き出しておくと安心です。</p>
      <div className="row">
        <button className="btn" onClick={exportData}>書き出す</button>
        <button className="btn ghost" onClick={() => fileRef.current.click()}>読み込む</button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={importData} />
      </div>
      {msg && <p className={"notice " + (msg.ok ? "ok" : "error")}>{msg.text}</p>}
    </section>
  );
}
