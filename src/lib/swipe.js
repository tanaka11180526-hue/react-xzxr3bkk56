import { useEffect, useRef } from "react";

// 横にしっかり指を動かしたときだけ反応するスワイプ（縦スクロールやタップでは動かない）。
// 左にスライドで onNext、右にスライドで onPrev。カレンダーの月めくりと同じ判定。
// 動かし始めが横向きなら、その指の動きのあいだは縦にスクロールさせない（横スライド中に画面が上下にぶれないように）。
// 返す ref をスライドさせたい要素に付ける
// 指が動き始めた最初の瞬間の向きで、横スライドか縦スクロールかを決める。
// 待つとそのあいだに iPhone が縦スクロールを始めてしまい、あとから止められないため
const LOCK_PX = 1;

export function useSwipe(onPrev, onNext) {
  const ref = useRef(null);
  const handlers = useRef({ onPrev, onNext });
  handlers.current = { onPrev, onNext };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let start = null, dir = null; // dir: "x"（横スライド）/ "y"（縦スクロール）
    const onStart = (e) => {
      const t = e.touches[0];
      start = { x: t.clientX, y: t.clientY };
      dir = null;
    };
    const onMove = (e) => {
      if (!start) return;
      const t = e.touches[0];
      const dx = t.clientX - start.x, dy = t.clientY - start.y;
      if (!dir && Math.max(Math.abs(dx), Math.abs(dy)) >= LOCK_PX) dir = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      if (dir === "x" && e.cancelable) e.preventDefault();
    };
    const onEnd = (e) => {
      if (!start) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - start.x, dy = t.clientY - start.y;
      start = null;
      if (dir !== "y" && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) (dx < 0 ? handlers.current.onNext : handlers.current.onPrev)();
    };
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
    };
  }, []);

  return ref;
}
