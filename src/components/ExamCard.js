import React, { useRef, useState } from "react";
import { keyToDate } from "../lib/time";

// 答練の結果（シートの「答練結果」「答練の小問」タブを Claude が書き、アプリは読むだけ）
const DOTS_MAX = 10; // めくる位置の点は、この回数までなら出す
const NEAR = 2; // 今のカードの前後この枚数だけ中身を描く（回数が多くても重くならないように）
const CHART_MAX = 10; // グラフに出す直近の回数
const CHART_LABELS = 5; // 日付は多くてもこの数まで
const SUBJECT_ALIAS = { 財務: "財計" }; // 答練は財務会計論で1科目。色は財計に合わせる
const LOW_DIFF = -1; // 平均よりこれ以上低い小問を「落とした小問」に出す
const PARTS_COLOR = ["#C0563F", "#3E7CB1", "#5E8A3C", "#C9952B", "#8A5FB0"];
const GRADE_COLOR = { A: "#5E8A3C", B: "#8DAA5B", C: "#C9952B", D: "#D9783F", E: "#B4432F" };

const num = (v) => (v === "" || v === null || v === undefined || isNaN(Number(v)) ? null : Number(v));
const md = (key) => { const d = keyToDate(key); return d.getMonth() + 1 + "/" + d.getDate(); };
const r1 = (v) => Math.round(v * 10) / 10;
const signed = (v) => (v > 0 ? "+" : v < 0 ? "−" : "±") + r1(Math.abs(v));
const qLabel = (it) => [it.part, it.q, it.sub].filter(Boolean).join(" ");

function Grade({ g }) {
  if (!g) return null;
  return <span className="ex-grade" style={{ background: GRADE_COLOR[g] || "#8C8274" }}>{g}</span>;
}

// 答練1回分（答練ID）にまとめる。新しい順
function groupExams(results) {
  const map = {};
  results.forEach((r) => {
    const e = (map[r.id] = map[r.id] || { id: r.id, date: r.date, subject: r.subject, name: r.name, parts: [], total: null });
    if (r.part === "合計") e.total = r;
    else e.parts.push(r);
  });
  return Object.values(map).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}

// 記録タブのボタン（今日のレポートと同じ形）。押すと答練のページが開く
export function ExamButton({ app, onOpen }) {
  const { exams, examsOn, examsStatus, loadExams } = app;
  if (!examsOn) return null;
  // まだ読めていないとき：読み込み中か、読めなかったこと（押すと読み直す）を出す
  if (!exams) {
    const failed = examsStatus === "error";
    return (
      <button className="report-cta" onClick={failed ? loadExams : undefined} disabled={!failed}>
        <span>📝</span>
        <span><b>答練</b><small>{failed ? "読み込めませんでした。押すともう一度読みます" : "読み込み中…"}</small></span>
        <span>{failed ? "↻" : ""}</span>
      </button>
    );
  }
  const all = groupExams(exams.results || []);
  // 科目ごとの回数（多い順）。例：4回分（財務3・管理1）
  const count = {};
  all.forEach((e) => { count[e.subject] = (count[e.subject] || 0) + 1; });
  const bySubject = Object.entries(count).sort((a, b) => b[1] - a[1]).map(([s, n]) => s + n).join("・");
  return (
    <button className="report-cta" onClick={onOpen}>
      <span>📝</span>
      <span>
        <b>答練</b>
        <small>{all.length ? all.length + "回分（" + bySubject + "）" : "結果はまだありません"}</small>
      </span>
      <span>›</span>
    </button>
  );
}

// 答練のページ（今日のレポートと同じく、画面に重ねて開く）
export default function ExamPage({ app, onClose }) {
  const { exams, matchSubject } = app;
  const [only, setOnly] = useState(null);
  const [index, setIndex] = useState(0); // 今見ているカード（0 が一番新しい）
  const [openLow, setOpenLow] = useState(null); // 「落とした小問」を開いている答練
  const track = useRef(null);
  if (!exams) return null;

  const all = groupExams(exams.results || []);
  const subjects = [...new Set(all.map((e) => e.subject))];
  const list = only ? all.filter((e) => e.subject === only) : all;
  const colorOf = (s) => { const m = matchSubject(s) || matchSubject(SUBJECT_ALIAS[s]); return m ? m.color : "#8C8274"; };
  const at = Math.min(index, Math.max(0, list.length - 1));
  const current = list[at];
  // グラフは1科目ずつ（「全部」のときは今見ている答練の科目）
  const chartSubject = only || (current || {}).subject;
  const chartExams = list.filter((e) => e.subject === chartSubject).slice(0, CHART_MAX).reverse();

  const pickSubject = (s) => {
    setOnly(s); setIndex(0); setOpenLow(null);
    if (track.current) track.current.scrollLeft = 0;
  };
  const goTo = (i) => {
    const el = track.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  };
  const onScroll = (e) => {
    const el = e.currentTarget;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== at) setIndex(i);
  };

  return (
    <div className="report-overlay ex-overlay" onClick={onClose}>
      <div className="report-wrap" onClick={(e) => e.stopPropagation()}>
        <div className="report-nav">
          <div className="ex-page-title">答練<span className="muted">{all.length ? all.length + "回分" : ""}</span></div>
          <button className="btn small ghost" onClick={onClose}>閉じる</button>
        </div>
        <section className="section">
          {subjects.length > 1 && (
            <div className="seg ex-subs">
              <button className={!only ? "on" : ""} onClick={() => pickSubject(null)}>全部</button>
              {subjects.map((s) => <button key={s} className={only === s ? "on" : ""} onClick={() => pickSubject(s)}>{s}</button>)}
            </div>
          )}

          {!list.length ? (
            <div className="card"><p className="empty">答練の結果はまだありません</p></div>
          ) : (
            <>
              <div className="ex-track" ref={track} onScroll={onScroll}>
                {list.map((e, i) => {
                  if (Math.abs(i - at) > NEAR) return <div key={e.id} className="ex-slide" />;
                  const low = lowOf((exams.items || []).filter((it) => it.id === e.id));
                  const lowOpen = openLow === e.id;
                  return (
                    <div key={e.id} className="ex-slide">
                      <div className="card ex-result">
                        <div className="ex-head">
                          <div className="ex-head-name">
                            <div className="ex-name">{e.name}</div>
                            <div className="ex-meta"><span style={{ color: colorOf(e.subject) }}>{e.subject}</span>・{md(e.date)}</div>
                          </div>
                          {e.total && <div className="ex-head-score"><b>{e.total.score}</b>/{e.total.full}</div>}
                          {e.total && <Grade g={e.total.grade} />}
                        </div>
                        <ExamResult exam={e} />
                        <button className={"ex-low-toggle" + (lowOpen ? " open" : "")} onClick={() => setOpenLow(lowOpen ? null : e.id)} aria-expanded={lowOpen}>
                          平均より大きく落とした小問<span className="muted">{low.length}問</span><span className="ex-row-arrow">{lowOpen ? "▾" : "▸"}</span>
                        </button>
                        {lowOpen && <LowItems low={low} />}
                      </div>
                    </div>
                  );
                })}
              </div>
              {list.length > 1 && (
                <div className="ex-pager">
                  <button onClick={() => goTo(at - 1)} disabled={at === 0} aria-label="新しい答練">‹</button>
                  {list.length <= DOTS_MAX
                    ? <span className="ex-dots">{list.map((e, i) => <i key={e.id} className={i === at ? "on" : ""} onClick={() => goTo(i)} />)}</span>
                    : null}
                  <span className="ex-count">{at + 1} / {list.length}</span>
                  <button onClick={() => goTo(at + 1)} disabled={at === list.length - 1} aria-label="前の答練">›</button>
                </div>
              )}
              <DevChart exams={chartExams} subject={subjects.length > 1 ? chartSubject : ""} />
              {current && <Fields items={(exams.items || []).filter((it) => it.id === current.id)} name={current.name} />}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

// 1回分の結果：合計と大問ごとの点数・判定
function ExamResult({ exam }) {
  const t = exam.total;
  return (
    <div className="ex-result">
      {t && (
        <div className="ex-total-sub">
          合計の平均 {r1(num(t.avg))}・合格 {t.pass}
          {num(t.rank) !== null && <>・{t.rank}位/{t.takers}人</>}
        </div>
      )}
      <div className="ex-parts">
        {exam.parts.map((p) => {
          const full = num(p.full) || 1, score = num(p.score) || 0;
          const avg = num(p.avg), pass = num(p.pass);
          return (
            <div key={p.part} className="ex-part">
              <div className="ex-part-top">
                <span className="ex-part-name">{p.part}</span>
                <span className="ex-part-topic">{p.topic}</span>
                <Grade g={p.grade} />
              </div>
              <div className="ex-bar">
                <i style={{ width: (score / full) * 100 + "%" }} />
                {avg !== null && <em className="avg" style={{ left: (avg / full) * 100 + "%" }} />}
                {pass !== null && <em className="pass" style={{ left: (pass / full) * 100 + "%" }} />}
              </div>
              <div className="ex-part-nums">
                <span><b>{score}</b>/{p.full}点</span>
                {avg !== null && <span className={score < avg ? "minus" : "plus"}>平均{signed(score - avg)}</span>}
                {num(p.dev) !== null && <span>偏差 {r1(num(p.dev))}</span>}
              </div>
            </div>
          );
        })}
      </div>
      <p className="hint"><span className="ex-key avg" />平均点　<span className="ex-key pass" />合格点</p>
    </div>
  );
}

// 日付を出す回（最初と最後と、そのあいだを等間隔に）
function labelAt(i, n) {
  if (n <= CHART_LABELS) return true;
  const step = (n - 1) / (CHART_LABELS - 1);
  return Array.from({ length: CHART_LABELS }, (_, k) => Math.round(k * step)).includes(i);
}

// 大問ごとの偏差点の推移（答練が2回以上で線になる）
function DevChart({ exams, subject }) {
  const parts = [...new Set(exams.flatMap((e) => e.parts.map((p) => p.part)))].sort();
  const W = 300, H = 120, L = 26, R = 8, T = 8, B = 20;
  const lo = 30, hi = 70;
  const x = (i) => (exams.length === 1 ? (L + W - R) / 2 : L + (i * (W - L - R)) / (exams.length - 1));
  const y = (v) => T + ((hi - Math.min(hi, Math.max(lo, v))) * (H - T - B)) / (hi - lo);
  return (
    <div className="card ex-chart">
      <div className="ex-sub-title">偏差点の推移<span className="muted">{subject}{exams.length > 1 ? " 直近" + exams.length + "回" : ""}</span></div>
      <svg viewBox={`0 0 ${W} ${H}`} className="ex-svg">
        {[30, 40, 50, 60, 70].map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className={v === 50 ? "mid" : "grid"} />
            <text x={L - 4} y={y(v) + 3} className="ax">{v}</text>
          </g>
        ))}
        {exams.map((e, i) => labelAt(i, exams.length) && (
          <text key={e.id} x={x(i)} y={H - 5} className="ax mid-x"
            style={{ textAnchor: exams.length > 1 && i === exams.length - 1 ? "end" : exams.length > 1 && i === 0 ? "start" : "middle" }}>{md(e.date)}</text>
        ))}
        {parts.map((part, pi) => {
          const pts = exams.map((e, i) => { const p = e.parts.find((q) => q.part === part); return p && num(p.dev) !== null ? [x(i), y(num(p.dev))] : null; }).filter(Boolean);
          const c = PARTS_COLOR[pi % PARTS_COLOR.length];
          return (
            <g key={part}>
              {pts.length > 1 && <polyline points={pts.map((p) => p.join(",")).join(" ")} fill="none" stroke={c} strokeWidth="2" strokeLinejoin="round" />}
              {pts.map(([px, py], i) => <circle key={i} cx={px} cy={py} r="3.5" fill={c} stroke="#2B2B2B" strokeWidth="1" />)}
            </g>
          );
        })}
      </svg>
      <div className="ex-legend">
        {parts.map((p, i) => <span key={p}><i style={{ background: PARTS_COLOR[i % PARTS_COLOR.length] }} />{p}</span>)}
      </div>
      {exams.length < 2 && <p className="hint">2回目の答練から線でつながります。50が平均です</p>}
    </div>
  );
}

// その回で平均より大きく落とした小問（差が大きい順）
function lowOf(items) {
  return items
    .map((it) => ({ ...it, d: num(it.score) !== null && num(it.avg) !== null ? num(it.score) - num(it.avg) : null }))
    .filter((it) => it.d !== null && it.d <= LOW_DIFF)
    .sort((a, b) => a.d - b.d);
}

function LowItems({ low }) {
  return (
    <div className="ex-low">
      {low.length === 0 && <p className="empty">平均を大きく下回った小問はありません</p>}
      {low.map((it, i) => (
        <div key={qLabel(it) + i} className={"ex-item" + (it.reviewed === true ? " done" : "")}>
          <div className="ex-item-top">
            <span className="ex-item-q">{qLabel(it)}</span>
            {it.kind && <span className="ex-tag">{it.kind}</span>}
            {it.level && <span className="ex-tag">難易度{it.level}</span>}
            {it.reviewed === true && <span className="ex-tag ok">復習済</span>}
          </div>
          <div className="ex-item-topic">{it.topic}</div>
          <div className="ex-item-nums">
            <b>{it.score}</b>/{it.full}点・平均 {r1(num(it.avg))}<em>{signed(it.d)}</em>
            {num(it.correct) !== null && <span>・平均得点率 {Math.round(num(it.correct))}%</span>}
          </div>
          {it.memo && <div className="ex-item-memo">{it.memo}</div>}
        </div>
      ))}
    </div>
  );
}

// 今見ている回の、分野ごとの得点率（平均点がわかる小問だけで比べる）
function Fields({ items, name }) {
  const map = {};
  items.forEach((it) => {
    const full = num(it.full), score = num(it.score), avg = num(it.avg);
    if (!it.field || full === null || score === null || avg === null) return;
    const f = (map[it.field] = map[it.field] || { field: it.field, full: 0, score: 0, avg: 0, n: 0 });
    f.full += full; f.score += score; f.avg += avg; f.n++;
  });
  const rows = Object.values(map)
    .map((f) => ({ ...f, me: (f.score / f.full) * 100, them: (f.avg / f.full) * 100 }))
    .sort((a, b) => (a.me - a.them) - (b.me - b.them));
  if (!rows.length) return null;
  return (
    <div className="card ex-fields">
      <div className="ex-sub-title">分野ごとの得点率<span className="muted">{name}・平均との差が大きい順</span></div>
      {rows.map((f) => (
        <div key={f.field} className="ex-field">
          <div className="ex-field-top">
            <span className="ex-field-name">{f.field}</span>
            <span className={"ex-field-diff " + (f.me < f.them ? "minus" : "plus")}>{f.me < f.them ? "−" : "+"}{Math.round(Math.abs(f.me - f.them))}%</span>
          </div>
          <div className="ex-field-bars">
            <div className="me"><i style={{ width: f.me + "%" }} /><span>自分 {Math.round(f.me)}%</span></div>
            <div className="them"><i style={{ width: f.them + "%" }} /><span>平均 {Math.round(f.them)}%</span></div>
          </div>
        </div>
      ))}
    </div>
  );
}
