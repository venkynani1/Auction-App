// Photos live in IndexedDB (too big for localStorage). Every window keeps an in-memory copy.
import { useEffect, useState } from 'react';

const DB = 'bidwars-live-photos';
const STORE = 'photos';
const cache = new Map<string, string>();
const listeners = new Set<() => void>();
let chan: BroadcastChannel | null = null;
let ready: Promise<void> | null = null;

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const r = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(r ? (r as IDBRequest<T>).result : undefined);
    t.onerror = () => reject(t.error);
  });
}

const emit = () => listeners.forEach((l) => l());

async function loadAll() {
  try {
    const db = await open();
    await new Promise<void>((resolve) => {
      const t = db.transaction(STORE, 'readonly');
      const req = t.objectStore(STORE).openCursor();
      cache.clear();
      req.onsuccess = () => {
        const c = req.result;
        if (c) { cache.set(String(c.key), c.value as string); c.continue(); } else resolve();
      };
      req.onerror = () => resolve();
    });
  } catch { /* storage blocked: photos work for this session only */ }
  emit();
}

export function initPhotos() {
  if (ready) return ready;
  try {
    chan = new BroadcastChannel('bidwars-live-photos');
    chan.onmessage = () => { void loadAll(); };
  } catch { /* ignore */ }
  ready = loadAll();
  return ready;
}

export async function setPhoto(id: string, dataUrl: string | null) {
  if (dataUrl) cache.set(id, dataUrl); else cache.delete(id);
  emit();
  try {
    if (dataUrl) await tx('readwrite', (s) => s.put(dataUrl, id));
    else await tx('readwrite', (s) => s.delete(id));
  } catch { /* keep in memory */ }
  try { chan?.postMessage('changed'); } catch { /* ignore */ }
}

export async function clearPhotos() {
  cache.clear(); emit();
  try { await tx('readwrite', (s) => s.clear()); } catch { /* ignore */ }
  try { chan?.postMessage('changed'); } catch { /* ignore */ }
}

export const getPhoto = (id: string) => cache.get(id);
export const photoCount = () => cache.size;
export const allPhotos = () => Object.fromEntries(cache);

export function usePhotos() {
  const [, set] = useState(0);
  useEffect(() => {
    const l = () => set((x) => x + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  return getPhoto;
}
