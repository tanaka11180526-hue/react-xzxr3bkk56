import React, { useMemo, useState } from "react";
import { rotationProgress } from "../lib/rotation";
import { keyToDate } from "../lib/time";
import { UNKNOWN_COLOR } from "../lib/constants";

const md = (key) => { const d = keyToDate(key); return d.getMonth() + 1 + "/" + d.getDate(); };

// 記録タブの「回転教材」。科目（教材）ごとに、何章（問・回）終わったかと、1つずつのマスを出す。
// マスは、終わったら科目の色で塗り、復習①〜④が済むほど濃くする。予定に入っていてまだのマスは点線、次にやるマスは太いふち
export default function RotationCard({ app }) {
  const { schedule, matchSubject } = app;
  const mats = useMemo(() => rotationProgress(schedule.items || []), [schedule]);
  const [open, setOpen] = useState(null);
  const [picked, setPicked] = useState(null);
  return (
    <section className="section">
      <div className="section-head"><div className="section-title">回転教材</div></div>
      <div className="card rot-card">
        {mats.map((m) => {
          const sub = matchSubject(m.subject);
          const color = sub ? sub.color : UNKNOWN_COLOR;
          const isOpen = open === m.id;
          const sel = isOpen && m.units.find((u) => u.key === picked);
          return (
            <div key={m.id} className="rot-mat" style={{ "--c": color }}>
              <button className="rot-head" onClick={() => { setOpen(isOpen ? null : m.id); setPicked(null); }} aria-expanded={isOpen}>
                <span className="rot-name"><b>{m.subject}</b>{m.title}</span>
                <span className="rot-count">{m.done}<small>/{m.units.length}{m.unit}</small></span>
                <span className="rot-bar"><i style={{ width: (m.done / Math.max(1, m.units.length)) * 100 + "%" }} /></span>
                <span className="rot-arrow">{isOpen ? "▾" : "▸"}</span>
              </button>
              {isOpen && (
                <div className="rot-body">
                  <div className="rot-grid">
                    {m.units.map((u) => {
                      const level = u.done ? (u.reviewTotal ? 0.3 + 0.7 * (u.reviews / 4) : 0.75) : 0;
                      return (
                        <button key={u.key} className={"rot-cell" + (u.done ? " done" : u.planned ? " planned" : "") + (m.next === u.key ? " next" : "") + (picked === u.key ? " picked" : "")}
                          style={{ "--a": level }} onClick={() => setPicked(picked === u.key ? null : u.key)} aria-label={u.name}>
                          {u.label}
                        </button>
                      );
                    })}
                  </div>
                  {sel ? (
                    <div className="rot-info">
                      <b>{sel.name}</b>
                      <span>{sel.done ? "済" + (sel.reviewTotal ? (sel.reviews ? "・復習" + "①②③④"[sel.reviews - 1] + "まで済" : "・復習はまだ") : "") + (sel.pre && !sel.planned ? "（シートに入れる前に終わった分）" : "")
                        : sel.planned ? "予定 " + sel.dates.map(md).join("・") : "まだ予定に入っていない"}</span>
                    </div>
                  ) : (
                    <div className="rot-legend">
                      <span><i className="rot-cell done" style={{ "--a": 0.75 }} />済</span>
                      {m.units.some((u) => u.reviewTotal) && <span><i className="rot-cell done" style={{ "--a": 0.3 }} /><i className="rot-cell done" style={{ "--a": 1 }} />復習が進むほど濃い</span>}
                      <span><i className="rot-cell planned" />予定あり</span>
                      <span><i className="rot-cell next" />次</span>
                      <span className="rot-tip">マスを押すと中身</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
