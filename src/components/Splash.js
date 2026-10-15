import React, { useEffect, useState } from "react";

// アプリを一から起動したとき（タスキルのあとなど）だけ出す猫の GIF。public/splash の3つからランダムに1つ。
// 5秒で消え、押すとすぐ消える。裏ではアプリがふつうに立ち上がっている
const SPLASHES = ["cat1", "cat2", "cat3"];

export default function Splash() {
  const [src] = useState(() => process.env.PUBLIC_URL + "/splash/" + SPLASHES[Math.floor(Math.random() * SPLASHES.length)] + ".gif");
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
      <img src={src} alt="" />
    </div>
  );
}
