// 今日以外の日を見ているときに、ノートに出すひとこと。
// その日の勉強時間と科目から選ぶ。同じ日はいつ開いても同じ文になるよう、日付から選ぶ
const H = 3600;

function pick(list, key) {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return list[h % list.length];
}

export function dayMessage(dateKey, day, getSub) {
  const total = day.total || 0;
  const ranked = Object.entries(day.by || {}).filter(([, s]) => s > 0).sort((a, b) => b[1] - a[1]);
  const top = ranked.length ? getSub(ranked[0][0]).label : "";
  const many = ranked.length >= 3;

  if (total < 60) {
    return pick([
      "この日はおやすみ。休むのも大事やで",
      "充電の日。次の日に期待やな",
      "ノートは真っ白。猫と昼寝してたんかな",
      "休んだ分、また走ればええ",
    ], dateKey);
  }
  if (total < H) {
    return pick([
      `${top}をちょこっと。ゼロやないのがえらい`,
      "短くても机に向かった日",
      `${top}に触れた日。続けるのが勝ち`,
      "少しでもやった、それで十分",
    ], dateKey);
  }
  if (total < 3 * H) {
    return pick([
      `${top}をしっかり進めた日`,
      many ? "いろんな科目に手を出せた日" : `${top}に集中できた日`,
      "コツコツ積み上げた一日",
      `${top}、ええ感じに進んだな`,
    ], dateKey);
  }
  if (total < 5 * H) {
    return pick([
      `${top}をがっつりやった日`,
      many ? "バランスよく回せた、ええ日" : `${top}の日やったな`,
      "よう粘った！この調子",
      "猫もびっくりの集中っぷり",
    ], dateKey);
  }
  return pick([
    "がんばりすぎや。ちゃんと寝たか？",
    `${top}を鬼のようにやった日`,
    "合格に一歩どころか三歩近づいた日",
    "この日の自分、誇ってええで",
  ], dateKey);
}
