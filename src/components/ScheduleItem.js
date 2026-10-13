import React from "react";
import { UNKNOWN_COLOR } from "../lib/constants";
import { isTaskDone } from "../lib/tasks";

// スプレッドシートの予定1件（「ToDo・実績」の1行、または復習日）
// inGroup：「前日の復習」のまとまりの中（分類と科目は見出しでわかるので出さない。label は短くした名前）
export default function ScheduleItem({ app, item, canStart, inGroup, label }) {
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
  const planText = item.plan ? "計画 " + item.plan + "分" : "";
  const actualText = item.actual !== "" && item.actual != null ? "実績 " + item.actual + "分" : "";
  return (
    <div className={"plan" + (finished ? " done" : "") + (inGroup ? " in-group" : "")} style={{ "--c": color }}>
      {checkable && (
        <button className={"done-btn" + (finished ? " on" : "")} onClick={() => markDone(item, !finished)}
          aria-label={finished ? "終わったを取り消す" : "終わった"}>{finished ? "✓" : ""}</button>
      )}
      <div className="plan-body">
        <div className="plan-meta">
          {!inGroup && item.category && <span className="plan-cat">{item.category}</span>}
          {time && <span className="plan-time">{time}</span>}
          {!inGroup && item.subject && <span className="plan-subject">{item.subject}</span>}
          {!checkable && item.achieved && <span className="plan-achieved">{item.achieved}</span>}
          {!checkable && item.done && <span className="plan-achieved">済</span>}
        </div>
        {item.content && <div className="plan-content">{label || item.content}</div>}
        {(planText || actualText) && <div className="plan-note">{[planText, actualText].filter(Boolean).join("／")}</div>}
        {item.note && <div className="plan-note">{item.note}</div>}
      </div>
      {canStart && sub && (
        <button className={"btn small" + (running ? "" : " primary")} onClick={() => timerActions.toggleSubject(sub.id, task)}>
          {running ? "⏸" : active ? "▶ 再開" : "▶ 開始"}
        </button>
      )}
    </div>
  );
}
