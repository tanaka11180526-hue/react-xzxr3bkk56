// ノートの右下に出すイラスト（本人が iPhone の写真から入れる）。
// 画像はこの端末の IndexedDB にだけ置く（コード・公開アドレス・シート・バックアップの書き出しには入れない。
// localStorage は記録用なので使わない）
const DB = "cpa_illust";
const STORE = "images";
const MAX_SIDE = 900; // 入れるときにこの大きさまで縮めて保存する
// 表示用の画像の作り方の版。v2：背景の紙の色を透明にした（Safari では CSS の mix-blend-mode や mask が効かないため）。
// v3：淡い色も透けすぎないようにし、鮮やかさを少し上げた（2026-10-13 本人が「少し濃く」を選んだ）。
// 作り方を変えたら版を上げる。元の画像（orig）から作り直す
const VERSION = 3;
const LOW = 0.06, HIGH = 0.18; // 紙からの濃さがこれ未満は透明、これ以上は不透明
const SATURATE = 1.35, DARKEN = 0.97; // 鮮やかさを上げ、ほんの少し暗くする
const EDGE = 0.05; // 四辺のこの割合をぼかす
const PAPER = [236, 231, 222]; // 元の画像が残っていない v2 の画像を作り直すとき、この紙の色の上に置いてから作り直す

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function run(mode, fn) {
  return open().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const out = fn(tx.objectStore(STORE));
    tx.oncomplete = () => { db.close(); resolve(out && out.result); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  }));
}

// 入れた順に並べて返す（{ id, blob, orig, added, v }）。前の版の画像は、ここで一度だけ作り直して保存し直す
export async function listIllusts() {
  const all = (await run("readonly", (s) => s.getAll())) || [];
  for (const it of all) {
    if (it.v === VERSION) continue;
    if (!it.orig) {
      // v1 は保存した画像がそのまま元の画像。v2 は透過にしたものしかないので、紙の色の上に置いて元の代わりにする
      it.orig = it.v === 2 ? await flatten(it.blob) : it.blob;
    }
    it.blob = await toTransparent(it.orig);
    it.v = VERSION;
    await run("readwrite", (s) => s.put(it));
  }
  return all.sort((a, b) => a.added - b.added);
}

export function removeIllust(id) {
  return run("readwrite", (s) => s.delete(id));
}

// 写真を縮めて、元の画像と表示用（透過）の画像の両方を保存する
export async function addIllust(file) {
  const orig = await flatten(file);
  const blob = await toTransparent(orig);
  const item = { id: "i_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), blob, orig, added: Date.now(), v: VERSION };
  await run("readwrite", (s) => s.put(item));
  return item;
}

// 画像を読んで、縮めた canvas に描く（透けているところは紙の色で埋める）
function draw(file, fill) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      const ctx = c.getContext("2d");
      if (fill) { ctx.fillStyle = "rgb(" + PAPER.join(",") + ")"; ctx.fillRect(0, 0, c.width, c.height); }
      ctx.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

const toBlob = (c, type, q) => new Promise((resolve) => c.toBlob(resolve, type, q));

// 元の画像として残す版（縮めて、透けていれば紙の色で埋めた JPEG）
async function flatten(file) {
  const c = await draw(file, true);
  return (c && (await toBlob(c, "image/jpeg", 0.9))) || file;
}

// 表示用：背景の紙の色（四辺の色の中央値）を透明にした PNG。
// 紙より暗いところだけを残し（色の濃さで不透明度を決め、色は紙の色を引いた元の色に戻す）、うすい点や紙のむらは消す。四辺は少しぼかす
async function toTransparent(file) {
  const c = await draw(file, true);
  if (!c) return file;
  const ctx = c.getContext("2d");
  const data = ctx.getImageData(0, 0, c.width, c.height);
  clearBackground(data.data, c.width, c.height);
  ctx.putImageData(data, 0, 0);
  return (await toBlob(c, "image/png")) || file;
}

function clearBackground(px, w, h) {
  const bg = borderColor(px, w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      let a = 0;
      for (let ch = 0; ch < 3; ch++) a = Math.max(a, (bg[ch] - px[i + ch]) / Math.max(bg[ch], 1));
      let alpha = Math.min(1, Math.max(0, (a - LOW) / (HIGH - LOW)));
      const edge = Math.min(x / w, (w - 1 - x) / w, y / h, (h - 1 - y) / h) / EDGE;
      if (edge < 1) alpha *= Math.max(0, edge);
      if (alpha <= 0) { px[i + 3] = 0; continue; }
      // 紙の色を引いた元の色に戻し（うすい部分が白っぽくならないように）、鮮やかさを上げる
      const strength = Math.min(1, Math.max(a, 0.001) / HIGH);
      for (let ch = 0; ch < 3; ch++) px[i + ch] = bg[ch] - (bg[ch] - px[i + ch]) / strength;
      const gray = 0.3 * px[i] + 0.59 * px[i + 1] + 0.11 * px[i + 2];
      for (let ch = 0; ch < 3; ch++) px[i + ch] = Math.max(0, Math.min(255, (gray + (px[i + ch] - gray) * SATURATE) * DARKEN));
      px[i + 3] = Math.round(alpha * 255);
    }
  }
}

function borderColor(px, w, h) {
  const rs = [], gs = [], bs = [];
  const take = (x, y) => { const i = (y * w + x) * 4; rs.push(px[i]); gs.push(px[i + 1]); bs.push(px[i + 2]); };
  for (let x = 0; x < w; x += 3) { take(x, 2); take(x, h - 3); }
  for (let y = 0; y < h; y += 3) { take(2, y); take(w - 3, y); }
  const med = (a) => a.sort((p, q) => p - q)[a.length >> 1];
  return [med(rs), med(gs), med(bs)];
}
