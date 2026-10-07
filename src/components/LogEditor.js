import React, { useState } from "react";
import { clockRange, fmtClock, fmtDateJa, toKey } from "../lib/time";
import Sheet from "./Sheet";

// 記録の手動追加・編集。editor.id があれば編集、なければ追加
export default function LogEditor({ app, editor, onClose }) {
  const { subjects, logs, breaks, breakColor, addEntries, updateEntry, deleteEntry, scheduleByDate, getSub } = app;
  const existing = editor.id ? (editor.kind === "study" ? logs : breaks).find((l) => l.id === editor.id) : null;
  const [kind, setKind] = useState(editor.kind);
  const [subjectId, setSubjectId] = useState(existing ? existing.subjectId : editor.subjectId || (subjects[0] && subjects[0].id));
  const [date, setDate] = useState(existing ? toKey(new Date(existing.start)) : editor.date);
  const [start, setStart] = useState(existing ? fmtClock(existing.start) : editor.start || "");
  const [end, setEnd] = useState(existing ? fmtClock(existing.end) : "");
  const [task, setTask] = useState(existing ? existing.task || "" : "");
  const subLabel = subjectId ? getSub(subjectId).label : "";
  const tasks = (scheduleByDate[date] || []).filter((p) => !p.review && p.content && p.subject === subLabel).map((p) => p.content);
  if (task && !tasks.includes(task)) tasks.push(task);

  if (editor.id && !existing) return null;
  const range = clockRange(date, start, end);
  const mins = range ? Math.round((range.end - range.start) / 60000) : 0;
  const valid = range && mins > 0 && (kind === "break" || subjectId);

  function save() {
    if (!valid) return;
    if (existing) updateEntry(kind, existing.id, kind === "study" ? { subjectId, task, ...range } : range);
    else addEntries(kind, kind === "study" ? { subjectId, manual: true, ...(task ? { task } : {}) } : { manual: true }, range.start, range.end);
    onClose();
  }
  function remove() {
    if (!window.confirm("この記録を削除しますか？")) return;
    deleteEntry(kind, existing.id);
    onClose();
  }

  return (
    <Sheet title={existing ? "記録を編集" : "時間を追加"} subtitle={fmtDateJa(date)} onClose={onClose}>
      {!existing && (
        <div className="field">
          <label>日付</label>
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </div>
      )}
      <div className="field">
        <label>種類</label>
        <div className="choice-grid">
          {subjects.map((s) => {
            const on = kind === "study" && subjectId === s.id;
            return (
              <button key={s.id} className={"choice" + (on ? " on" : "")} style={on ? { "--c": s.color } : null}
                disabled={!!existing && editor.kind === "break"} onClick={() => { setKind("study"); if (s.id !== subjectId) setTask(""); setSubjectId(s.id); }}>{s.label}</button>
            );
          })}
          <button className={"choice" + (kind === "break" ? " on" : "")} style={kind === "break" ? { "--c": breakColor } : null}
            disabled={!!existing && editor.kind === "study"} onClick={() => setKind("break")}>☕ 休憩</button>
        </div>
      </div>
      {kind === "study" && tasks.length > 0 && (
        <div className="field">
          <label>どの予定の実績にする？</label>
          <select value={task} onChange={(e) => setTask(e.target.value)}>
            <option value="">指定しない（科目だけ）</option>
            {tasks.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      )}
      <div className="field">
        <label>時間帯</label>
        <div className="time-range">
          <input type="time" value={start} onChange={(e) => setStart(e.target.value)} aria-label="開始" />
          <span>→</span>
          <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} aria-label="終了" />
        </div>
        <div className="duration">{valid ? Math.floor(mins / 60) + "時間 " + (mins % 60) + "分" + (range.end - range.start > 0 && toKey(new Date(range.end - 1)) !== date ? "（翌日まで）" : "") : "開始と終了を入れてください"}</div>
      </div>
      <button className="btn primary block" disabled={!valid} onClick={save}>{existing ? "保存する" : "追加する"}</button>
      {existing && <button className="btn danger block" onClick={remove}>この記録を削除</button>}
    </Sheet>
  );
}
