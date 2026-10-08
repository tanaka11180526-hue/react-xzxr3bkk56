import React from "react";

// 月ごとの落書きと、猫の季節の服装。どちらも本やマグと同じ描き方（細い黒の線、色は線から少しずらして塗る）
const INK = "#2F2F2F";
const line = { fill: "none", stroke: INK, strokeWidth: 1.2, strokeLinecap: "round", strokeLinejoin: "round" };

// ── 猫の頭にのせるもの（猫の絵の座標。頭のてっぺんは y≈23、耳の先は (20,17) と (48,16)）──
const HATS = {
  // 冬：毛糸の帽子
  beanie: (
    <g>
      <path d="M23 27c-1-10 6-15 12-15s12.6 5 11 15z" fill="#9DBBDD" transform="translate(1 .8)" />
      <path d="M22.4 26.6c-.6-9.4 5.6-14.6 12-14.6s12.8 5.2 11.6 14.4" {...line} />
      <path d="M22 26.8c8 1.6 16 1.6 24.4-.2l.4 3.4c-8.6 1.8-16.8 1.8-25-.2z" fill="#F4F0E6" stroke={INK} strokeWidth="1.1" strokeLinejoin="round" />
      <path d="M27 18.6l1.2 6 M33 15.8v8.4 M39.4 16.6l-1 7.6" {...line} strokeWidth=".9" />
      <circle cx="34.6" cy="10.4" r="3.2" fill="#F4F0E6" stroke={INK} strokeWidth="1.1" />
    </g>
  ),
  // 春：耳に桜の花
  sakura: (
    <g>
      <Flower cx={46} cy={20} r={4.4} fill="#F6C1CC" />
      <Flower cx={22.6} cy={22.6} r={3} fill="#F9D6DD" />
    </g>
  ),
  // 5月：新聞紙のかぶと
  kabuto: (
    <g>
      <path d="M22 27l12.4-15 12.4 15z" fill="#EDE6D6" transform="translate(1 .8)" />
      <path d="M21.6 26.8l12.8-15.2 12.8 15.2z" {...line} fill="none" />
      <path d="M20 27h28.6l-2.4 3.6H22.4z" fill="#EDE6D6" stroke={INK} strokeWidth="1.1" strokeLinejoin="round" />
      <path d="M27 19.6l7.4 7.2 7.4-7.2" {...line} strokeWidth=".9" />
      <path d="M26 22.6h4 M38.6 22.6h4" stroke="#8A8A8A" strokeWidth=".8" strokeLinecap="round" />
    </g>
  ),
  // 6月：耳にアジサイ
  ajisai: (
    <g>
      <Flower cx={46} cy={20} r={3.4} fill="#B9B4E6" />
      <Flower cx={42} cy={17.6} r={2.8} fill="#A9C6EC" />
      <Flower cx={49.4} cy={16.6} r={2.6} fill="#C8B2E2" />
    </g>
  ),
  // 夏：麦わら帽子
  straw: (
    <g>
      <ellipse cx="35" cy="25.4" rx="18" ry="4" fill="#EBCB86" />
      <path d="M26.4 25c-.6-7 3.8-11 8.6-11s9.2 4 8.6 11" fill="#EBCB86" />
      <path d="M17.4 25.4c4 3 30 3.4 35.4-.4 M17.4 25.4c3-2.6 9.4-3.4 9.4-3.4 M52.8 25c-2.6-2.4-9.2-3.2-9.2-3.2 M26.6 24.6c-.6-6.8 3.8-10.8 8.4-10.8s9 4 8.4 10.8" {...line} />
      <path d="M26.8 21.4c5.4 1.4 11.2 1.4 16.6 0" stroke="#D9534F" strokeWidth="2" strokeLinecap="round" />
    </g>
  ),
  // 秋：ベレー帽
  beret: (
    <g>
      <path d="M22.6 24.4c-2-5.6 6-10 14.4-9.6 7.6.4 13.4 4.6 11 9.6-6.6 2-18.8 2.2-25.4 0z" fill="#B9724A" transform="translate(1 .8)" />
      <path d="M22.4 24c-2-5.6 6-10 14.4-9.6 7.6.4 13.4 4.6 11 9.6-6.6 2-18.8 2.2-25.4 0z" {...line} />
      <path d="M35.6 14.4l.6-3" {...line} />
    </g>
  ),
  // 10月：魔女の帽子
  witch: (
    <g>
      <path d="M27 24l9-21c1-1 1.6-.4 1.4.6L42.4 24z" fill="#5B4A80" transform="translate(1 .8)" />
      <ellipse cx="35" cy="25" rx="16.4" ry="3.4" fill="#5B4A80" transform="translate(1 .8)" />
      <path d="M26.6 23.8l9.2-21c.8-1.4 1.8-.8 1.6.4l4.6 20.4 M18.6 25.4c5 2.8 27.4 2.8 32.8-.2-3.4-2.4-28.8-2.6-32.8.2z" {...line} />
      <path d="M27.4 21.6c4.8 1 10 1 14.6-.2" stroke="#F0A04B" strokeWidth="2.2" strokeLinecap="round" />
    </g>
  ),
  // 12月：サンタ帽
  santa: (
    <g>
      <path d="M24 25c0-8 6-13 14-12 6 .8 10 5 12 11-3-2-5-2.6-6.4-2.4L44 25z" fill="#D9534F" transform="translate(1 .8)" />
      <path d="M23.6 24.6c-.2-8 6-12.8 13.8-12 6.2.8 10.4 5 12.6 11.2" {...line} />
      <path d="M21.6 24.6c8.2 1.8 16.6 1.8 25 0l.4 3.6c-8.6 1.8-17 1.8-25.6 0z" fill="#F7F3EA" stroke={INK} strokeWidth="1.1" strokeLinejoin="round" />
      <circle cx="50.4" cy="24.6" r="3.2" fill="#F7F3EA" stroke={INK} strokeWidth="1.1" />
    </g>
  ),
};

function Flower({ cx, cy, r, fill }) {
  const petals = [0, 72, 144, 216, 288].map((a) => {
    const rad = ((a - 90) * Math.PI) / 180;
    return <ellipse key={a} cx={cx + Math.cos(rad) * r * 0.55} cy={cy + Math.sin(rad) * r * 0.55} rx={r * 0.48} ry={r * 0.36} transform={`rotate(${a} ${cx + Math.cos(rad) * r * 0.55} ${cy + Math.sin(rad) * r * 0.55})`} />;
  });
  return (
    <g>
      <g fill={fill} stroke={INK} strokeWidth=".8">{petals}</g>
      <circle cx={cx} cy={cy} r={r * 0.2} fill="#F2C14E" />
    </g>
  );
}

const HAT_BY_MONTH = { 1: "beanie", 2: "beanie", 3: "sakura", 4: "sakura", 5: "kabuto", 6: "ajisai", 7: "straw", 8: "straw", 9: "beret", 10: "witch", 11: "beret", 12: "santa" };

export function CatHat({ month }) {
  return HATS[HAT_BY_MONTH[month]] || null;
}

// ── 本の左に置く、月ごとの小さな落書き（幅36×高さ42、下の線は y≈41.6）──
const DOODLES = {
  // 1月：鏡もち
  1: (
    <g>
      <path d="M7 40.6h22l-2 1H9z M8 41h20" {...line} />
      <ellipse cx="18" cy="35.6" rx="10.6" ry="4.6" fill="#FBF6EA" stroke={INK} strokeWidth="1.2" />
      <ellipse cx="18" cy="29.4" rx="7.6" ry="3.8" fill="#FBF6EA" stroke={INK} strokeWidth="1.2" />
      <circle cx="18" cy="23.6" r="3.2" fill="#F2A64B" transform="translate(.8 .6)" />
      <circle cx="18" cy="23.6" r="3.2" {...line} />
      <path d="M17.6 20.4l1.4-2.4" stroke="#5E8A3C" strokeWidth="1.4" strokeLinecap="round" />
    </g>
  ),
  // 2月：雪だるま
  2: (
    <g>
      <circle cx="18" cy="33" r="8" fill="#FBF8F1" stroke={INK} strokeWidth="1.2" />
      <circle cx="18" cy="20.4" r="5.6" fill="#FBF8F1" stroke={INK} strokeWidth="1.2" />
      <path d="M12.6 25.4c3.6 1.6 7.4 1.6 11 0l.4 2.2c-3.8 1.6-7.8 1.6-11.6 0z" fill="#D9534F" stroke={INK} strokeWidth=".9" />
      <circle cx="16" cy="19.4" r=".8" fill={INK} /><circle cx="20" cy="19.4" r=".8" fill={INK} />
      <path d="M18 21.4l2.4.8-2.4.6" fill="#F2A64B" stroke="none" />
      <path d="M10.4 31l-5-3 M25.6 31l5-3.4" {...line} />
      <circle cx="3" cy="10" r=".9" fill="#B7C9DC" /><circle cx="31" cy="14" r="1" fill="#B7C9DC" /><circle cx="27" cy="6" r=".8" fill="#B7C9DC" />
    </g>
  ),
  // 3月：桜の枝
  3: (
    <g>
      <path d="M4 40c6-6 12-12 24-24 M15 29c2-5 1-9-1-12 M22 22c4 0 7 2 9 4" {...line} />
      <Flower cx={28.6} cy={14.6} r={4.6} fill="#F6C1CC" />
      <Flower cx={13.6} cy={15.6} r={3.8} fill="#F9D6DD" />
      <Flower cx={31.4} cy={27.6} r={3.4} fill="#F6C1CC" />
    </g>
  ),
  // 4月：舞う桜の花びら
  4: (
    <g fill="#F6C1CC" stroke={INK} strokeWidth=".8">
      {[[8, 12, 20], [22, 7, -30], [28, 22, 50], [12, 28, -10], [24, 35, 15], [6, 38, 60]].map(([x, y, a], i) => (
        <path key={i} d={`M${x} ${y}c2-3 5-3 6 0-1 3-4 4-6 0z`} transform={`rotate(${a} ${x} ${y})`} />
      ))}
    </g>
  ),
  // 5月：こいのぼり
  5: (
    <g>
      <path d="M6 41V4" {...line} strokeWidth="1.4" />
      <circle cx="6" cy="3.4" r="1.6" fill="#F2C14E" stroke={INK} strokeWidth=".9" />
      <path d="M7 8h20l-3 3.4 3 3.4H7z" fill="#5B7FD6" transform="translate(.8 .6)" />
      <path d="M7 8h20l-3 3.4 3 3.4H7z" {...line} />
      <path d="M7 17h17l-2.6 3 2.6 3H7z" fill="#E06666" transform="translate(.8 .6)" />
      <path d="M7 17h17l-2.6 3 2.6 3H7z" {...line} />
      <circle cx="10.6" cy="10.8" r="1.2" fill="#fff" stroke={INK} strokeWidth=".7" /><circle cx="10.6" cy="19.8" r="1.1" fill="#fff" stroke={INK} strokeWidth=".7" />
    </g>
  ),
  // 6月：てるてる坊主
  6: (
    <g>
      <path d="M18 2v8" {...line} />
      <circle cx="18" cy="14" r="5" fill="#FBF8F1" stroke={INK} strokeWidth="1.2" />
      <path d="M13.6 17.6c-3 4-4 8-4.6 12 4 1.6 13.2 1.6 18 0-.6-4-1.6-8-4.6-12" fill="#FBF8F1" stroke={INK} strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M14.6 18.4c2.4 1 4.8 1 7 0" stroke="#D9534F" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M16 13.4c.6.6 1.2.6 1.6 0 M19 13.4c.6.6 1.2.6 1.6 0 M16.8 15.6c.8.8 1.8.8 2.6 0" {...line} strokeWidth=".8" />
      <path d="M4 34l-1 3 M30 31l-1 3 M33 38l-1 3" stroke="#8EB4DA" strokeWidth="1.1" strokeLinecap="round" />
    </g>
  ),
  // 7月：風鈴
  7: (
    <g>
      <path d="M18 2v6" {...line} />
      <path d="M11 17c0-6 3-9 7-9s7 3 7 9z" fill="#CFE6EE" transform="translate(.8 .6)" />
      <path d="M11 17c0-6 3-9 7-9s7 3 7 9z" {...line} />
      <path d="M14 13c1.6-1 2.6-1 4 0 1.4 1 2.4 1 4 0" stroke="#E06666" strokeWidth="1" strokeLinecap="round" fill="none" />
      <path d="M18 17v8" {...line} strokeWidth=".9" />
      <path d="M15 25h6v10h-6z" fill="#F7E6A0" transform="translate(.8 .6)" />
      <path d="M15 25h6v10h-6z" {...line} />
    </g>
  ),
  // 8月：スイカ
  8: (
    <g>
      <path d="M5 34c0-9 6-16 13-16s13 7 13 16z" fill="#E86A6A" transform="translate(1 .8)" />
      <path d="M4 34.4h28" stroke="#6CB66C" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M4.6 34c0-9 6-16.4 13.4-16.4S31.4 25 31.4 34z M4 36.2h28" {...line} />
      {[[12, 27], [18, 24], [24, 27], [15, 31], [21, 31]].map(([x, y], i) => <ellipse key={i} cx={x} cy={y} rx=".7" ry="1.1" fill={INK} />)}
    </g>
  ),
  // 9月：お月見だんご
  9: (
    <g>
      <circle cx="27" cy="9" r="6" fill="#F7E3A0" stroke={INK} strokeWidth="1.1" />
      <path d="M7 40.6h22l-2.4-4.6H9.4z" fill="#E9D7B5" stroke={INK} strokeWidth="1.1" strokeLinejoin="round" />
      {[[12, 32.4], [18, 32.4], [24, 32.4], [15, 27.4], [21, 27.4], [18, 22.6]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3" fill="#FBF8F1" stroke={INK} strokeWidth="1.1" />)}
    </g>
  ),
  // 10月：かぼちゃ
  10: (
    <g>
      <path d="M6 31c0-7 5-11 12-11s12 4 12 11-5 9-12 9-12-2-12-9z" fill="#F0A04B" transform="translate(1 .8)" />
      <path d="M6 30.6c0-7 5-11 12-11s12 4 12 11-5 9.4-12 9.4S6 37.6 6 30.6z M13 20.6c-2 4-2 14 0 19 M23 20.6c2 4 2 14 0 19" {...line} />
      <path d="M17.6 19.6c0-3 1-5 3-6" stroke="#5E8A3C" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M13.4 28l2-2 2 2z M18.6 28l2-2 2 2z M14 33c2.4 1.6 5.6 1.6 8 0" fill={INK} stroke={INK} strokeWidth=".9" strokeLinejoin="round" />
    </g>
  ),
  // 11月：もみじ
  11: (
    <g>
      <Maple x={12} y={16} s={1} fill="#E0704A" rot={-15} />
      <Maple x={25} y={30} s={0.8} fill="#F0A04B" rot={20} />
    </g>
  ),
  // 12月：小さなツリー
  12: (
    <g>
      <path d="M18 6l-8 12h4l-6 10h5l-5 9h20l-5-9h5l-6-10h4z" fill="#7FB07A" transform="translate(.8 .6)" />
      <path d="M18 6l-8 12h4l-6 10h5l-5 9h20l-5-9h5l-6-10h4z" {...line} />
      <path d="M16 37h4v4h-4z" fill="#B9865A" stroke={INK} strokeWidth="1" />
      <path d="M18 1.4l1 2.2 2.4.2-1.8 1.6.6 2.4-2.2-1.2-2.2 1.2.6-2.4-1.8-1.6 2.4-.2z" fill="#F2C14E" stroke={INK} strokeWidth=".7" />
      <circle cx="15" cy="22" r="1.2" fill="#E06666" /><circle cx="21" cy="29" r="1.2" fill="#F2C14E" /><circle cx="14" cy="32" r="1.2" fill="#5B7FD6" />
    </g>
  ),
};

function Maple({ x, y, s, fill, rot }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}>
      <path d="M0-9l2 5 4-3-1 5 5 0-4 3 3 3-5 0 0 6-4-4-4 4 0-6-5 0 3-3-4-3 5 0-1-5 4 3z" fill={fill} stroke={INK} strokeWidth="1" strokeLinejoin="round" />
      <path d="M0 4v6" stroke={INK} strokeWidth="1" strokeLinecap="round" />
    </g>
  );
}

export function SeasonDoodle({ month }) {
  const d = DOODLES[month];
  if (!d) return null;
  return (
    <svg className="nh-season" viewBox="0 0 36 42" aria-hidden="true">
      {d}
      <path d="M0 41.6c12 .2 24 .2 36 0" fill="none" stroke={INK} strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}
