// ノートの右下に出すイラスト（本人が iPhone の写真から入れる）。
// 画像はこの端末の IndexedDB にだけ置く（コード・公開アドレス・シート・バックアップの書き出しには入れない。
// localStorage は記録用なので使わない）
const DB = "cpa_illust";
const STORE = "images";
const MAX_SIDE = 900; // 入れるときにこの大きさまで縮めて保存する

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

// 入れた順に並べて返す（{ id, blob, added }）
export async function listIllusts() {
  const all = (await run("readonly", (s) => s.getAll())) || [];
  return all.sort((a, b) => a.added - b.added);
}

export function removeIllust(id) {
  return run("readwrite", (s) => s.delete(id));
}

// 写真を縮めて保存する
export async function addIllust(file) {
  const blob = await shrink(file);
  const item = { id: "i_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), blob, added: Date.now() };
  await run("readwrite", (s) => s.put(item));
  return item;
}

function shrink(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob((b) => resolve(b || file), "image/jpeg", 0.88);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}
