import React, { useState } from "react";
import ScheduleItem from "./ScheduleItem";
import { UNKNOWN_COLOR } from "../lib/constants";
import { isPrevDayReview, isTaskDone, prevDayReviewTitle, prevDayReviewTopic } from "../lib/tasks";

// その日の予定の一覧（カレンダーの日の一覧・タイマーの今日の予定）。
// 予定は科目ごとのまとまりにして、シートに出てくる順に並べる。「前日の復習」は一番下に1つのまとまり。
// どのまとまりも最初は閉じておき（計測中の予定があれば開く）、押すと中の予定が開く
export default function PlanList({ app, plans, canStart }) {
  const rest = plans.filter((p) => !isPrevDayReview(p));
  const prev = plans.filter(isPrevDayReview);
  const groups = [];
  rest.forEach((p) => {
    const key = String(p.subject || "").trim();
    let g = groups.find((x) => x.key === key);
    if (!g) groups.push((g = { key, items: [] }));
    g.items.push(p);
  });
  return (
    <>
      {groups.map((g) => {
        const sub = app.matchSubject(g.key);
        return <PlanGroup key={"s:" + g.key} app={app} items={g.items} canStart={canStart} title={sub ? sub.label : g.key || "科目なし"} />;
      })}
      {prev.length > 0 && (
        <PlanGroup app={app} items={prev} canStart={canStart} title={prevDayReviewTitle(prev)} label={prevDayReviewTopic} />
      )}
    </>
  );
}

// まとまり1つ。見出しに「3件中2件済・計画 30分」。label を渡すと中の予定の名前を短くして出す
function PlanGroup({ app, items, canStart, title, label }) {
  const { matchSubject, timer } = app;
  const measuring = (timer.mode === "study" || timer.mode === "paused") && items.some((it) => (timer.task || "") === (it.content || ""));
  const [open, setOpen] = useState(measuring);
  const done = items.filter(isTaskDone).length;
  const plan = items.reduce((s, it) => s + (parseFloat(it.plan) || 0), 0);
  const sub = matchSubject(items[0].subject);
  return (
    <div className="plan-group" style={{ "--c": sub ? sub.color : UNKNOWN_COLOR }}>
      <button className={"plan plan-group-head" + (done === items.length ? " done" : "")} onClick={() => setOpen(!open)} aria-expanded={open}>
        <div className="plan-body">
          <div className="plan-content">{title}</div>
          <div className="plan-note">{items.length}件中{done}件済{plan > 0 ? "・計画 " + plan + "分" : ""}</div>
        </div>
        <span className="plan-group-arrow">{open ? "▾" : "▸"}</span>
      </button>
      {open && items.map((it, i) => <ScheduleItem key={i} app={app} item={it} canStart={canStart} inGroup label={label ? label(it) : undefined} />)}
    </div>
  );
}
