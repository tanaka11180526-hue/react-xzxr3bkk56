import { useRef } from "react";

// 横にしっかり指を動かしたときだけ反応するスワイプ（縦スクロールやタップでは動かない）。
// 左にスライドで onNext、右にスライドで onPrev。カレンダーの月めくりと同じ判定
export function useSwipe(onPrev, onNext) {
  const start = useRef(null);
  return {
    onTouchStart(e) {
      const t = e.touches[0];
      start.current = { x: t.clientX, y: t.clientY };
    },
    onTouchEnd(e) {
      if (!start.current) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - start.current.x, dy = t.clientY - start.current.y;
      start.current = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) (dx < 0 ? onNext : onPrev)();
    },
  };
}
