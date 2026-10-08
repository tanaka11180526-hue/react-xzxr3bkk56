import React, { useEffect, useState } from "react";

const DURATION_MS = 2500;
// 表紙のあとにパラパラめくれるページの枚数
const LEAVES = 4;

// アプリを開いたときのアニメーション：机の上の閉じたノートの表紙がめくれ、ページが数枚パラパラめくれて、そのままアプリの画面になる。
// タップで飛ばせる。「視差効果を減らす」の設定の端末では出さない
export default function Splash({ onDone }) {
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    const t = setTimeout(onDone, DURATION_MS);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className={"splash" + (leaving ? " leaving" : "")} onClick={() => { setLeaving(true); setTimeout(onDone, 250); }} aria-hidden="true">
      <div className="splash-book">
        <div className="splash-page">
          <div className="splash-sticky">合格!</div>
          <div className="splash-lines" />
        </div>
        {Array.from({ length: LEAVES }, (_, i) => (
          <div key={i} className="splash-leaf" style={{ "--i": i, zIndex: LEAVES - i }}>
            <div className="splash-leaf-front"><i /><i /><i /><i /></div>
            <div className="splash-leaf-back" />
          </div>
        ))}
        <div className="splash-cover">
          <div className="splash-cover-front">
            <div className="splash-label">
              <span className="splash-eyebrow">CPA</span>
              <span className="splash-title">STUDY</span>
              <span className="splash-sub">NOTE</span>
            </div>
          </div>
          <div className="splash-cover-back" />
        </div>
        <div className="splash-rings" />
      </div>
    </div>
  );
}

// 試し：URL に ?splash を付けたときだけ出す（まだ本番では出さない）
export function shouldShowSplash() {
  try {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
    return new URLSearchParams(window.location.search).has("splash");
  } catch {
    return false;
  }
}
