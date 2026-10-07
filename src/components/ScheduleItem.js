import React from "react";
import { UNKNOWN_COLOR } from "../lib/constants";

// スプレッドシートの予定1件（「ToDo・実績」の1行、または復習日）
export default function ScheduleItem({ app, item, canStart }) {
  const { matchSubject, timer, timerActions } = app;
  const sub = matchSubject(item.subject);
  const color = sub ? sub.color : UNKNOWN_COLOR;
  const task = item.review ? "" : item.content;
  const active = sub && (timer.mode === "study" || timer.mode === "paused") && timer.subjectId === sub.id && (timer.task || "") === task;
  const running = active && timer.mode === "study";
  const time = item.start ? item.start + (item.end ? "–" + item.end : "") : "";
  const planText = item.plan ? "計画 " + item.plan + "分" : "";
  const actualText = item.actual !== "" && item.actual != null ? "実績 " + item.actual + "分" : "";
  return (
    <div className={"plan" + (item.done ? " done" : "")} style={{ "--c": color }}>
      <div className="plan-body">
        <div className="plan-meta">
          {item.category && <span className="plan-cat">{item.category}</span>}
          {time && <span className="plan-time">{time}</span>}
          {item.subject && <span className="plan-subject">{item.subject}</span>}
          {item.achieved && <span className="plan-achieved">{item.achieved}</span>}
          {item.done && <span className="plan-achieved">済</span>}
        </div>
        {item.content && <div className="plan-content">{item.content}</div>}
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
