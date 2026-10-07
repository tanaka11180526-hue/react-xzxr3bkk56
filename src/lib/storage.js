import { useEffect, useState } from "react";

export function load(key, fallback) {
  let raw = null;
  try {
    raw = localStorage.getItem(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    // 旧バージョンは一部の値を JSON ではなく文字列のまま保存していた
    return typeof fallback === "string" && raw != null ? raw : fallback;
  }
}

export function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export function remove(key) {
  try {
    localStorage.removeItem(key);
  } catch {}
}

export function usePersisted(key, init) {
  const [value, setValue] = useState(() => (typeof init === "function" ? init() : load(key, init)));
  useEffect(() => save(key, value), [key, value]);
  return [value, setValue];
}

export function makeId(prefix) {
  return prefix + "_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7);
}
