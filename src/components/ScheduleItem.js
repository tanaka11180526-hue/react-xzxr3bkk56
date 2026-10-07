import React from "react";
import { UNKNOWN_COLOR } from "../lib/constants";

// スプレッドシートの「予定」1行分
export default function ScheduleItem({ app, item, canStart }) {
  const { matchSubject, timer, timerActions } = app;
  const sub = matchSubject(item.subject);
  const color = sub ? sub.color : UNKNOWN_COLOR;
  const running = sub && timer.mode === "study" && timer.subjectId === sub.id;
  const time = item.start ? item.start + (item.end ? "–" + item.end : "") : "";
  return (
    <div className="plan" style={{ "--c": color }}>
      <div className="plan-body">
        <div className="plan-meta">
          {time && <span className="plan-time">{time}</span>}
          {item.subject && <span className="plan-subject">{item.subject}</span>}
        </div>
        {item.content && <div className="plan-content">{item.content}</div>}
        {item.note && <div className="plan-note">{item.note}</div>}
      </div>
      {canStart && sub && (
        <button className={"btn small" + (running ? "" : " primary")} onClick={() => timerActions.toggleSubject(sub.id)}>
          {running ? "⏸" : "▶ 開始"}
        </button>
      )}
    </div>
  );
}
