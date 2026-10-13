// ノートの右下に出すイラスト（本人が iPhone の写真から入れる）。
// 画像はこの端末の IndexedDB にだけ置く（コード・公開アドレス・シート・バックアップの書き出しには入れない。
// localStorage は記録用なので使わない）
const DB = "cpa_illust";
const STORE = "images";
const MAX_SIDE = 900; // 入れるときにこの大きさまで縮めて保存する
// 背景の紙の色を透明にした版（v2）。Safari では CSS の mix-blend-mode や mask が効かないことがあるので、画像そのものを透過にする
const VERSION = 2;

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

// 入れた順に並べて返す（{ id, blob, added }）。前の版で入れた画像は、ここで一度だけ透過に作り直して保存し直す
export async function listIllusts() {
  const all = (await run("readonly", (s) => s.getAll())) || [];
  for (const it of all) {
    if (it.v === VERSION) continue;
    it.blob = await toTransparent(it.blob);
    it.v = VERSION;
    await run("readwrite", (s) => s.put(it));
  }
  return all.sort((a, b) => a.added - b.added);
}

export function removeIllust(id) {
  return run("readwrite", (s) => s.delete(id));
}

// 写真を縮めて保存する
export async function addIllust(file) {
  const blob = await toTransparent(file);
  const item = { id: "i_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), blob, added: Date.now(), v: VERSION };
  await run("readwrite", (s) => s.put(item));
  return item;
}

// 縮めて、背景の紙の色（四辺の色の中央値）を透明にした PNG を作る。
// 紙より暗いところだけを残し（色の濃さで不透明度を決め、色は紙の色を引いた元の色に戻す）、うすい点や紙のむらは消す。四辺は少しぼかす
function toTransparent(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
      const w = Math.round(img.width * k), h = Math.round(img.height * k);
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      const ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      const data = ctx.getImageData(0, 0, w, h);
      clearBackground(data.data, w, h);
      ctx.putImageData(data, 0, 0);
      c.toBlob((b) => resolve(b || file), "image/png");
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

const LOW = 0.07, HIGH = 0.32; // 紙からの濃さがこれ未満は透明、これ以上は不透明
const EDGE = 0.05; // 四辺のこの割合をぼかす
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
      // 紙の色を引いた元の色に戻す（うすい部分が白っぽくならないように）
      const strength = Math.max(a, 0.001);
      for (let ch = 0; ch < 3; ch++) {
        const v = bg[ch] - (bg[ch] - px[i + ch]) / Math.min(1, strength / HIGH);
        px[i + ch] = Math.max(0, Math.min(255, v));
      }
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
