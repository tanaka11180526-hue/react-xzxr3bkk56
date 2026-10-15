import React, { useEffect, useState } from "react";

// アプリを一から起動したとき（タスキルのあとなど）だけ出す画面。
// 真ん中にアプリのロゴ（輪っかが伸びてオレンジの点が出る）、右下に猫の GIF（public/splash/room.gif。背景は止めて猫だけ動かしたもの）。
// 5秒で消え、押すとすぐ消える。裏ではアプリがふつうに立ち上がっている
const R = 80;
const LEN = 2 * Math.PI * R;

export default function Splash() {
  const [phase, setPhase] = useState("show"); // show → hide（フェード）→ gone
  useEffect(() => {
    const t = setTimeout(() => setPhase("hide"), 5000);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (phase !== "hide") return;
    const t = setTimeout(() => setPhase("gone"), 300);
    return () => clearTimeout(t);
  }, [phase]);
  if (phase === "gone") return null;
  return (
    <div className={"splash" + (phase === "hide" ? " hide" : "")} onClick={() => setPhase("hide")} role="button" aria-label="閉じる">
      <svg className="splash-logo" viewBox="0 0 200 200" aria-hidden="true">
        <circle cx="100" cy="100" r={R} fill="none" stroke="#D9D0C5" strokeWidth="12" />
        <circle className="splash-arc" cx="100" cy="100" r={R} fill="none" stroke="#1E2536" strokeWidth="12" strokeLinecap="round"
          transform="rotate(-90 100 100)" style={{ "--len": LEN }} />
        <circle className="splash-dot" cx="20" cy="100" r="13" fill="#C2410C" />
        <g className="splash-text">
          <text x="100" y="108" textAnchor="middle" fontSize="44" fontWeight="700" fill="#1E2536" fontFamily="Georgia, 'Times New Roman', serif">CPA</text>
          <text x="100" y="138" textAnchor="middle" fontSize="15" letterSpacing="5" fill="#6B6B6B" fontFamily="Helvetica, Arial, sans-serif">STUDY</text>
        </g>
      </svg>
      <img className="splash-room" src={process.env.PUBLIC_URL + "/splash/room.gif"} alt="" />
    </div>
  );
}
