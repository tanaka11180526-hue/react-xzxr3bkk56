import React, { useState } from "react";
import ScheduleItem from "./ScheduleItem";
import { UNKNOWN_COLOR } from "../lib/constants";
import { isPrevDayReview, isTaskDone, prevDayReviewTitle, prevDayReviewTopic } from "../lib/tasks";

// その日の予定の一覧（カレンダーの日の一覧・タイマーの今日の予定）。
// 予定は科目ごとのまとまりにする（その科目の予定が1件だけならまとめずにそのまま出す）。
// 並びは、まとめなかった予定 → 科目のまとまり → 「前日の復習」（一番下）。それぞれの中はシートに出てくる順。
// 科目のまとまりは最初は閉じておき（計測中の予定があれば開く）、押すと中の予定が開く。
// 「前日の復習」は App でその日1つの予定にまとめてある（parts に元の行）。ふつうの予定と同じカードで、文字を押すと論点の一覧が開く
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
      {groups.filter((g) => g.items.length === 1).map((g) => (
        <ScheduleItem key={"s:" + g.key} app={app} item={g.items[0]} canStart={canStart} />
      ))}
      {groups.filter((g) => g.items.length > 1).map((g) => {
        const sub = app.matchSubject(g.key);
        return <PlanGroup key={"s:" + g.key} app={app} items={g.items} canStart={canStart} title={sub ? sub.label : g.key || "科目なし"} />;
      })}
      {prev.map((p, i) => <PrevReviewPlan key={"prev" + i} app={app} item={p} canStart={canStart} />)}
    </>
  );
}

// その日の「前日の復習」（1つの予定）。文字を押すと論点の一覧（見るだけ）が開く
function PrevReviewPlan({ app, item, canStart }) {
  const parts = item.parts || [item];
  const [open, setOpen] = useState(false);
  return (
    <div className="plan-group">
      <ScheduleItem app={app} item={item} canStart={canStart} label={prevDayReviewTitle(parts)}
        topics={parts.length} open={open} onToggle={() => setOpen(!open)} />
      {open && (
        <ul className="prev-topics">
          {parts.map((p, i) => (
            <li key={i} className={isTaskDone(p) ? "done" : ""}>
              <span className="prev-topic-mark">{isTaskDone(p) ? "〇" : "・"}</span>
              <span className="prev-topic-name">{prevDayReviewTopic(p)}</span>
              {parseFloat(p.plan) > 0 && <span className="prev-topic-plan">{parseFloat(p.plan)}分</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
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
