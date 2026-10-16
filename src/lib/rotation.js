// 回転教材（記録タブの「回転教材」）。どこまで進んだかは「ToDo・実績」の予定から出す（〇で終わり、復習①〜④の済で復習の段階）。
// 教材の中身は Google ドキュメント「CPA勉強方針メモ(クロード引継ぎ用)」の「教材と進み具合」「資料」から。教材が変わったらここを直す
import { isTaskDone } from "./tasks";

const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

const CONTORE_K = ["有価証券", "貸倒引当金", "棚卸資産", "固定資産", "社債", "純資産", "繰延資産", "引当金", "外貨換算会計",
  "ストック・オプション等", "資産除去債務", "収益認識", "金融商品会計", "デリバティブ取引・ヘッジ会計", "リース会計(現行基準)"];
const CONTORE_K2 = ["退職給付会計(個別)", "固定資産の減損会計", "研究開発費・ソフトウェア", "税効果会計(個別)", "株主資本等変動計算書",
  "包括利益計算書(個別)", "会計上の変更及び誤謬の訂正", "中間財務諸表", "セグメント情報", "１株当たり情報", "分配可能額"];
const CONTORE_R = ["連結会計基礎", "持分の変動", "その他の包括利益累計額", "資本連結応用", "退職給付会計(連結)", "間接所有の子会社",
  "在外子会社", "連結会計その他の論点", "個別キャッシュ・フロー計算書", "連結キャッシュ・フロー計算書", "企業結合①(取得)",
  "企業結合②(共通支配下の取引等・共同支配企業の形成)", "事業分離等"];

// 財理テキストの章（論文の優先度★〜★★★。財務理論の学習ガイダンスから。番号はテキスト（2026-2027年版）のもの）。ほかの章もシートに出てくれば足す。
// この時期は★の章もやる（2026-10-16 本人談）
const ZAIRI = {
  4: ["収益費用アプローチと資産負債アプローチ", 1], 8: ["流動資産・固定資産", 1], 12: ["概念フレームワーク", 3], 21: ["棚卸資産の評価", 1],
  22: ["研究開発費等", 1], 23: ["固定資産の減損", 3], 24: ["退職給付", 3], 25: ["資産除去債務", 2], 26: ["資本会計(会計基準論点)", 3],
  27: ["ストック・オプション等", 2], 28: ["外貨建取引", 3], 29: ["税効果会計", 3], 30: ["リース", 3], 31: ["会計方針の開示等", 1],
  32: ["期中財務諸表(中間)", 1], 33: ["金融商品", 3], 34: ["収益認識", 3], 35: ["連結財務諸表", 3], 36: ["持分法", 3],
  37: ["包括利益の表示", 1], 38: ["企業結合", 2], 39: ["事業分離", 1], 40: ["連結キャッシュ・フロー計算書等", 2],
};

const RONTAI = ["部門別計算", "個別原価計算⑴", "個別原価計算⑵", "個別原価計算⑶", "総合原価計算⑴", "総合原価計算⑵", "総合原価計算⑶",
  "総合原価計算⑷", "総合原価計算⑸", "総合原価計算⑹", "標準原価計算⑴", "標準原価計算⑵", "標準原価計算⑶", "標準原価計算⑷", "標準原価計算⑸",
  "標準原価計算⑹", "標準原価計算⑺", "標準原価計算⑻", "予算管理⑴", "予算管理⑵", "資金管理とCF管理⑴", "資金管理とCF管理⑵",
  "資金管理とCF管理⑶", "差額原価収益分析⑴", "差額原価収益分析⑵", "差額原価収益分析⑶", "設備投資の経済性計算⑴", "設備投資の経済性計算⑵",
  "設備投資の経済性計算⑶", "設備投資の経済性計算⑷", "原価管理⑴", "原価管理⑵", "原価管理⑶", "ABC⑴", "ABC⑵", "ABC⑶",
  "分権組織とグループ経営の管理会計⑴", "分権組織とグループ経営の管理会計⑵", "分権組織とグループ経営の管理会計⑶", "財務情報分析"];
const RONTAI_SKIP = [18, 25, 32, 33, 36]; // 重要度C（回さない）

export const MATERIALS = [
  {
    id: "contore", subject: "財計", title: "コントレ", unit: "章",
    units: [
      ...CONTORE_K.map((name, i) => ({ key: "k" + (i + 1), label: String(i + 1), name: "個別論点編 第" + (i + 1) + "章 " + name, pre: i < 14 })), // 第1〜14章はシートに入れる前に終わっている（本人談）
      { key: "k15-2", label: "15-2", name: "個別論点編 第15-2章 リース会計(新基準)" },
      ...CONTORE_K2.map((name, i) => ({ key: "k" + (i + 16), label: String(i + 16), name: "個別論点編 第" + (i + 16) + "章 " + name })),
      ...CONTORE_R.map((name, i) => ({ key: "r" + (i + 1), label: "連" + (i + 1), name: "連結・組織再編・CF計算書編 第" + (i + 1) + "章 " + name })),
    ],
    match(it) {
      if (it.subject !== "財計") return null;
      const c = it.content;
      let m = c.match(/連結[^:：]*[:：]\s*第(\d+)章/);
      if (m) return "r" + m[1];
      m = c.match(/個別論点編[:：]\s*第(\d+(?:-\d)?)章/);
      if (m) return "k" + m[1];
      if (/新リース/.test(c)) return "k15-2";
      if (/旧リース/.test(c)) return "k15";
      return null;
    },
  },
  {
    id: "zairi", subject: "財理", title: "テキスト", unit: "章", extra: true,
    units: Object.entries(ZAIRI).map(([n, [name, star]]) => ({ key: "c" + n, label: n, name: "第" + n + "章 " + name + "（" + "★".repeat(star) + "）" })),
    match(it) {
      if (it.subject !== "財理") return null;
      const m = it.content.match(/テキスト\s*第(\d+)章/);
      return m ? "c" + m[1] : null;
    },
    extraUnit(key, it) { const n = key.slice(1); return { key, label: n, name: it.content.replace(/^テキスト\s*/, "") }; },
  },
  {
    id: "rontai", subject: "管理", title: "論対集", unit: "問",
    units: RONTAI.map((name, i) => ({ key: "q" + (i + 1), label: String(i + 1), name: "問" + (i + 1) + " " + name })).filter((u, i) => !RONTAI_SKIP.includes(i + 1)),
    match(it) {
      const m = it.content.match(/論対集[①②]?\s*問(\d+)/);
      return it.subject === "管理" && m ? "q" + m[1] : null;
    },
  },
  {
    id: "tax", subject: "租税", title: "論対レジュメ（講義）", unit: "回",
    units: range(1, 28).map((n) => ({ key: "l" + n, label: String(n), name: "論文対策講義" + n })),
    match(it) {
      const m = it.content.match(/^論文対策講義(\d+)/);
      return it.subject === "租税" && m ? "l" + m[1] : null;
    },
  },
  {
    id: "business", subject: "経営", title: "テキスト（講義）", unit: "回",
    units: range(1, 16).map((n) => ({ key: "l" + n, label: String(n), name: "レギュラー講義" + n })),
    match(it) {
      const m = it.content.match(/^レギュラー講義(\d+)/);
      return it.subject === "経営" && m ? "l" + m[1] : null;
    },
  },
];

// 予定の一覧から、教材ごとの進み具合を出す。
// 1つの章（問）に予定が何行あっても、全部〇で「終わった」。復習の段階は、その行の復習①〜④の済の数（行が複数なら一番少ない行）
export function rotationProgress(items) {
  const base = items.filter((it) => !it.review && it.content);
  const reviewsByRow = {};
  items.filter((it) => it.review).forEach((it) => { (reviewsByRow[it.row] = reviewsByRow[it.row] || []).push(it); });
  return MATERIALS.map((mat) => {
    const units = mat.units.map((u) => ({ ...u, rows: [] }));
    const byKey = Object.fromEntries(units.map((u) => [u.key, u]));
    base.forEach((it) => {
      const key = mat.match(it);
      if (!key) return;
      if (!byKey[key]) {
        if (!mat.extra) return;
        byKey[key] = { ...mat.extraUnit(key, it), rows: [] };
        units.push(byKey[key]);
      }
      byKey[key].rows.push(it);
    });
    if (mat.extra) units.sort((a, b) => Number(a.label) - Number(b.label));
    units.forEach((u) => {
      u.done = u.pre || (u.rows.length > 0 && u.rows.every(isTaskDone));
      u.planned = u.rows.length > 0;
      const stages = u.rows.map((r) => (reviewsByRow[r.row] || []).filter((rv) => rv.done).length);
      u.reviews = stages.length ? Math.min(...stages) : 0;
      u.reviewTotal = Math.max(0, ...u.rows.map((r) => (reviewsByRow[r.row] || []).length));
      u.dates = u.rows.map((r) => r.date).sort();
    });
    // 次にやる：予定に入っていてまだのうち、日付が一番早いもの。なければ、まだのうちで一番前のもの
    const next = units.filter((u) => !u.done && u.planned).sort((a, b) => a.dates[0].localeCompare(b.dates[0]))[0] || units.find((u) => !u.done);
    return { ...mat, units, done: units.filter((u) => u.done).length, next: next && next.key };
  });
}
