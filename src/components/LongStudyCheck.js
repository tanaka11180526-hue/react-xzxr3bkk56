import React, { useState } from "react";
import Sheet from "./Sheet";
import { clockRange, fmtClock, fmtHM, toKey } from "../lib/time";

// 勉強の計測が長く続いたまま開いたときに、止め忘れていないか聞く
export default function LongStudyCheck({ app, onClose }) {
  const { timer, timerActions, getSub } = app;
  const [forgot, setForgot] = useState(false);
  const [end, setEnd] = useState(() => fmtClock(Math.min(Date.now(), timer.start + 3600 * 1000)));
  const elapsed = (Date.now() - timer.start) / 1000;
  const range = clockRange(toKey(new Date(timer.start)), fmtClock(timer.start), end);
  const valid = range && range.end <= Date.now();

  return (
    <Sheet title="まだ勉強してる？" onClose={onClose}>
      <p className="long-text">
        <b>{getSub(timer.subjectId).label}</b>{timer.task ? "（" + timer.task + "）" : ""}を {fmtClock(timer.start)} から
        <b> {fmtHM(elapsed)}</b> 計り続けてるで。
      </p>
      {!forgot ? (
        <div className="long-actions">
          <button className="btn block primary" onClick={onClose}>まだ勉強してる</button>
          <button className="btn block" onClick={() => setForgot(true)}>止め忘れてた</button>
        </div>
      ) : (
        <>
          <label className="field">
            <span>何時に終わった？</span>
            <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
          </label>
          {range && <p className="hint">{fmtClock(timer.start)}〜{end}（{fmtHM((range.end - range.start) / 1000)}）を記録して止めます</p>}
          {!valid && <p className="hint warn">今より前の時刻を入れてな</p>}
          <button className="btn block primary" disabled={!valid} onClick={() => { timerActions.stopAt(range.end); onClose(); }}>
            この時刻で止める
          </button>
        </>
      )}
    </Sheet>
  );
}
