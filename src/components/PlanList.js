import React, { useState } from "react";
import ScheduleItem from "./ScheduleItem";
import { UNKNOWN_COLOR } from "../lib/constants";
import { isPrevDayReview, isTaskDone, prevDayReviewTitle, prevDayReviewTopic } from "../lib/tasks";

// その日の予定の一覧。「前日の復習」は一番下に1つのまとまりにして出す（カレンダーの日の一覧・タイマーの今日の予定）
export default function PlanList({ app, plans, canStart }) {
  const rest = plans.filter((p) => !isPrevDayReview(p));
  const prev = plans.filter(isPrevDayReview);
  return (
    <>
      {rest.map((p, i) => <ScheduleItem key={i} app={app} item={p} canStart={canStart} />)}
      {prev.length > 0 && <PrevReviewGroup app={app} items={prev} canStart={canStart} />}
    </>
  );
}

function PrevReviewGroup({ app, items, canStart }) {
  const { matchSubject, timer } = app;
  // 計測中の論点があれば開いておく
  const measuring = (timer.mode === "study" || timer.mode === "paused") && items.some((it) => (timer.task || "") === (it.content || ""));
  const [open, setOpen] = useState(measuring);
  const done = items.filter(isTaskDone).length;
  const plan = items.reduce((s, it) => s + (parseFloat(it.plan) || 0), 0);
  const sub = matchSubject(items[0].subject);
  return (
    <div className="plan-group" style={{ "--c": sub ? sub.color : UNKNOWN_COLOR }}>
      <button className={"plan plan-group-head" + (done === items.length ? " done" : "")} onClick={() => setOpen(!open)} aria-expanded={open}>
        <div className="plan-body">
          <div className="plan-content">{prevDayReviewTitle(items)}</div>
          <div className="plan-note">{items.length}件中{done}件済{plan > 0 ? "・計画 " + plan + "分" : ""}</div>
        </div>
        <span className="plan-group-arrow">{open ? "▾" : "▸"}</span>
      </button>
      {open && items.map((it, i) => <ScheduleItem key={i} app={app} item={it} canStart={canStart} inGroup label={prevDayReviewTopic(it)} />)}
    </div>
  );
}
