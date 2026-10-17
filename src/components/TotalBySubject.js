import React, { useMemo, useState } from "react";
import Sheet from "./Sheet";
import { RECORDS_FROM } from "../lib/constants";
import { dayStart, keyToDate } from "../lib/time";

const R = 70, W = 22, C = 2 * Math.PI * R, GAP = 2; // ドーナツの半径・太さ・円周・すきま
const hm = (secs) => { const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60); return h ? h + "時間" + m + "分" : m + "分"; };
const md = (key) => { const d = keyToDate(key); return d.getMonth() + 1 + "/" + d.getDate(); };

// 記録タブの「⏱ 累計」を押すと出る、科目ごとの累計（ドーナツの円グラフと、長い順の一覧）。
// 数えるのは累計と同じ（RECORDS_FROM からの止めた勉強の記録）。マスか行を押すと、その科目を真ん中に出す
export default function TotalBySubject({ app, onClose }) {
  const { logs, getSub } = app;
  const [picked, setPicked] = useState(null);
  const rows = useMemo(() => {
    const from = dayStart(RECORDS_FROM);
    const by = {};
    logs.forEach((l) => { if (l.start >= from && l.end > l.start) by[l.subjectId] = (by[l.subjectId] || 0) + (l.end - l.start) / 1000; });
    return Object.entries(by).map(([id, secs]) => ({ sub: getSub(id), secs })).sort((a, b) => b.secs - a.secs);
  }, [logs, getSub]);
  const total = rows.reduce((s, r) => s + r.secs, 0);
  let at = 0;
  const segs = rows.map((r) => {
    const len = (r.secs / total) * C;
    const seg = { ...r, start: at, len: rows.length > 1 ? Math.max(0.5, len - GAP) : len };
    at += len;
    return seg;
  });
  const sel = rows.find((r) => r.sub.id === picked);
  return (
    <Sheet title="科目ごとの累計" subtitle={md(RECORDS_FROM) + " から"} onClose={onClose}>
      {total > 0 ? (
        <>
          <div className="pie-wrap">
            <svg className="pie" viewBox="0 0 180 180" role="img" aria-label="科目ごとの累計の円グラフ">
              {segs.map((s) => (
                <circle key={s.sub.id} cx="90" cy="90" r={R} fill="none" stroke={s.sub.color} strokeWidth={picked === s.sub.id ? W + 6 : W}
                  strokeDasharray={s.len + " " + (C - s.len)} strokeDashoffset={-s.start} transform="rotate(-90 90 90)"
                  opacity={picked && picked !== s.sub.id ? 0.35 : 1} onClick={() => setPicked(picked === s.sub.id ? null : s.sub.id)} style={{ cursor: "pointer" }} />
              ))}
            </svg>
            <div className="pie-center">
              {sel ? <><small>{sel.sub.label}</small><b>{hm(sel.secs)}</b><small>{Math.round((sel.secs / total) * 100)}%</small></>
                : <><small>合計</small><b>{hm(total)}</b></>}
            </div>
          </div>
          <ul className="pie-list">
            {rows.map((r) => (
              <li key={r.sub.id} className={picked === r.sub.id ? "on" : ""} onClick={() => setPicked(picked === r.sub.id ? null : r.sub.id)}>
                <i style={{ background: r.sub.color }} />
                <span className="pie-name">{r.sub.label}</span>
                <span className="pie-time">{hm(r.secs)}</span>
                <span className="pie-pct">{Math.round((r.secs / total) * 100)}%</span>
              </li>
            ))}
          </ul>
        </>
      ) : <p className="muted">まだ記録がありません</p>}
    </Sheet>
  );
}
