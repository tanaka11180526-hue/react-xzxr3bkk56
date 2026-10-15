import React from "react";
import { UNKNOWN_COLOR } from "../lib/constants";
import { isTaskDone } from "../lib/tasks";

// スプレッドシートの予定1件（「ToDo・実績」の1行、または復習日）
// inGroup：「前日の復習」のまとまりの中（分類と科目は見出しでわかるので出さない。label は短くした名前）
// topics・open・onToggle：まとめた「前日の復習」用（文字を押すと論点の一覧を開く。計画のあとに件数を出す）
export default function ScheduleItem({ app, item, canStart, inGroup, label, topics, open, onToggle }) {
  const { matchSubject, timer, timerActions, canMarkDone, markDone } = app;
  const finished = isTaskDone(item);
  // ✓ のボタンがあるときは、シートの「〇」「済」の印は出さない（同じことを2回出さない）
  const checkable = !!(canMarkDone && item.row);
  const sub = matchSubject(item.subject);
  const color = sub ? sub.color : UNKNOWN_COLOR;
  // 復習も「論文対策講義3（復習①）」のように、やることを付けて計る
  const task = item.content || "";
  const active = sub && (timer.mode === "study" || timer.mode === "paused") && timer.subjectId === sub.id && (timer.task || "") === task;
  const running = active && timer.mode === "study";
  const time = item.start ? item.start + (item.end ? "–" + item.end : "") : "";
  const planText = (item.plan ? "計画 " + item.plan + "分" : "") + (topics ? "（" + topics + "件）" : "");
  const actualText = item.actual !== "" && item.actual != null ? "実績 " + item.actual + "分" : "";
  return (
    <div className={"plan" + (finished ? " done" : "") + (inGroup ? " in-group" : "")} style={{ "--c": color }}>
      {checkable && (
        <button className={"done-btn" + (finished ? " on" : "")} onClick={() => markDone(item, !finished)}
          aria-label={finished ? "終わったを取り消す" : "終わった"}>{finished ? "✓" : ""}</button>
      )}
      <div className={"plan-body" + (onToggle ? " toggles" : "")} onClick={onToggle} role={onToggle ? "button" : undefined} aria-expanded={onToggle ? !!open : undefined}>
        <div className="plan-meta">
          {!inGroup && item.category && <span className="plan-cat">{item.category}</span>}
          {time && <span className="plan-time">{time}</span>}
          {!inGroup && item.subject && <span className="plan-subject">{item.subject}</span>}
          {!checkable && item.achieved && <span className="plan-achieved">{item.achieved}</span>}
          {!checkable && item.done && <span className="plan-achieved">済</span>}
        </div>
        {item.content && <div className="plan-content">{label || item.content}</div>}
        {(planText || actualText) && <div className="plan-note">{[planText, actualText].filter(Boolean).join("／")}{onToggle && <span className="plan-toggle">{open ? " ▾" : " ▸"}</span>}</div>}
        {item.note && <div className="plan-note">{item.note}</div>}
      </div>
      {canStart && sub && <RowPlay running={running} active={active} onClick={() => timerActions.toggleSubject(sub.id, task)} />}
    </div>
  );
}

// 計測の丸いボタン（▷、計測中は ⏸）。科目のまとまりの中の行と、前日の復習のカードで使う
export function RowPlay({ running, active, onClick }) {
  return (
    <button className={"row-play" + (running ? " running" : "")} onClick={onClick}
      aria-label={running ? "一時停止" : active ? "再開" : "開始"}>
      <svg viewBox="0 0 20 20" aria-hidden="true">
        {running
          ? <path d="M7.5 5.5 V14.5 M12.5 5.5 V14.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          : <path d="M7 5.5 L15 10 L7 14.5 Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />}
      </svg>
    </button>
  );
}
