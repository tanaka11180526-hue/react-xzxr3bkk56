import React, { useState } from "react";
import ScheduleItem, { RowPlay } from "./ScheduleItem";
import { UNKNOWN_COLOR } from "../lib/constants";
import { isPrevDayReview, isTaskDone, prevDayReviewTitle, prevDayReviewTopic } from "../lib/tasks";

// その日の予定の一覧（カレンダーの日の一覧・タイマーの今日の予定）。
// 予定は科目ごとのまとまりにする（1件だけの科目もまとまりにする）。
// 並びは、科目のまとまり → 「前日の復習」（一番下）。それぞれの中はシートに出てくる順。
// 科目のまとまりは最初から開いておき、見出しを押すと閉じる（閉じたことは覚えない）。
// 「前日の復習」は App でその日1つの予定にまとめてある（parts に元の行）。ふつうの予定と同じカードで、文字を押すと論点の一覧が開く
export default function PlanList({ app, plans, canStart, overdue = [] }) {
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
      {overdue.length > 0 && <OverdueGroup app={app} items={overdue} canStart={canStart} />}
      {groups.map((g) => {
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

// 遅れ（今日より前の日の、まだ済でない予定）。見出しは「遅れ 3件」、中の行に元の日付と科目を付ける
function OverdueGroup({ app, items, canStart }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="plan-group plan-overdue" style={{ "--c": "#C0503A" }}>
      <button className="plan plan-group-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <div className="plan-body plan-group-line">
          <span className="plan-content">遅れ</span>
          <span className="plan-note">{items.length}件</span>
        </div>
        <span className="plan-group-arrow">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <ul className="plan-rows">
          {items.map((it, i) => <PlanRow key={i} app={app} item={it} canStart={canStart}
            tag={md(it.date) + "・" + (isPrevDayReview(it) ? "前日復習" : it.subject)} label={isPrevDayReview(it) ? prevDayReviewTitle(it.parts || [it]) : null} />)}
        </ul>
      )}
    </div>
  );
}
const md = (key) => Number(key.slice(5, 7)) + "/" + Number(key.slice(8, 10));

// まとまり1つ。見出しに「3件中2件済・計画 30分」（1件だけなら「計画 30分」、済なら「済・計画 30分」）。label を渡すと中の予定の名前を短くして出す
function PlanGroup({ app, items, canStart, title, label }) {
  const { matchSubject } = app;
  const [open, setOpen] = useState(true);
  const done = items.filter(isTaskDone).length;
  const plan = items.reduce((s, it) => s + (parseFloat(it.plan) || 0), 0);
  const sub = matchSubject(items[0].subject);
  return (
    <div className="plan-group" style={{ "--c": sub ? sub.color : UNKNOWN_COLOR }}>
      <button className={"plan plan-group-head" + (done === items.length ? " done" : "")} onClick={() => setOpen(!open)} aria-expanded={open}>
        <div className="plan-body plan-group-line">
          <span className="plan-content">{title}</span>
          <span className="plan-note">{items.length > 1
            ? items.length + "件中" + done + "件済" + (plan > 0 ? "・計画 " + plan + "分" : "")
            : [done ? "済" : "", plan > 0 ? "計画 " + plan + "分" : ""].filter(Boolean).join("・")}</span>
        </div>
        <span className="plan-group-arrow">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <ul className="plan-rows">
          {items.map((it, i) => <PlanRow key={i} app={app} item={it} canStart={canStart} />)}
        </ul>
      )}
    </div>
  );
}

// 科目のまとまりの中の予定1件（小さい行）。左に ✓、右に計画の分と ▷（計測中は ⏸）
function PlanRow({ app, item, canStart, tag, label }) {
  const { matchSubject, timer, timerActions, canMarkDone, markDone } = app;
  const finished = isTaskDone(item);
  const sub = matchSubject(item.subject);
  const task = item.content || "";
  const active = sub && (timer.mode === "study" || timer.mode === "paused") && timer.subjectId === sub.id && (timer.task || "") === task;
  const running = active && timer.mode === "study";
  const plan = parseFloat(item.plan);
  return (
    <li className={"plan-row" + (finished ? " done" : "") + (active ? " active" : "")}>
      {canMarkDone && item.row ? (
        <button className={"row-check" + (finished ? " on" : "")} onClick={() => markDone(item, !finished)}
          aria-label={finished ? "終わったを取り消す" : "終わった"}>{finished ? "✓" : ""}</button>
      ) : <span className="row-check-space" />}
      <span className="row-name">{tag && <em className="row-tag">{tag}</em>}{label || task}{item.note && <small>{item.note}</small>}</span>
      {plan > 0 && <span className="row-plan">{plan}分</span>}
      {canStart && sub && <RowPlay running={running} active={active} onClick={() => timerActions.toggleSubject(sub.id, task)} />}
    </li>
  );
}
