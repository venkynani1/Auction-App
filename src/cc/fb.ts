// Code & Chaos ↔ Firebase Realtime Database. Same Firebase project and env vars as Classic's team rooms.
//
//   cc/<CODE>/owner          host laptop's anonymous uid
//   cc/<CODE>/pub            public game state (projector + phones)            host writes
//   cc/<CODE>/allowed/<no>   team numbers that may register                    host writes
//   cc/<CODE>/regcode        optional registration code (never readable)       host writes
//   cc/<CODE>/pins/<no>      team PINs (never readable; rules compare)         team creates once, host can reset
//   cc/<CODE>/reg/<no>       four member names                                 team writes once
//   cc/<CODE>/sess/<no>      the one phone allowed to act for the team         team (with PIN) or host
//   cc/<CODE>/online/<no>    presence                                          the team's phone
//   cc/<CODE>/priv/<no>      the team's own purse, points, purchases           host writes, team reads
//   cc/<CODE>/bids/<lot>/<no>/<id>   mobile bids (server time, host reads)     team writes
//   cc/<CODE>/ans/<win>/<no>         answers (server time, host reads)         team writes once
//   cc/<CODE>/host           full host state (backup)                          host only
import type { FirebaseApp } from 'firebase/app';
import type { Database } from 'firebase/database';
import type { Auth } from 'firebase/auth';
import { useEffect, useState } from 'react';

const env = (import.meta.env ?? {}) as Record<string, string | undefined>;
const config = {
  apiKey: env.VITE_FIREBASE_API_KEY, authDomain: env.VITE_FIREBASE_AUTH_DOMAIN, databaseURL: env.VITE_FIREBASE_DATABASE_URL,
  projectId: env.VITE_FIREBASE_PROJECT_ID, appId: env.VITE_FIREBASE_APP_ID,
};
const EMU = env.VITE_FIREBASE_EMULATOR; // "127.0.0.1" for local tests
export const ccConfigured = !!(config.apiKey && config.databaseURL && config.projectId);

let ready: Promise<{ app: FirebaseApp; db: Database; auth: Auth }> | null = null;
export function fb() {
  ready ??= (async () => {
    const { initializeApp, getApps, getApp } = await import('firebase/app');
    const { getDatabase, connectDatabaseEmulator } = await import('firebase/database');
    const { getAuth, connectAuthEmulator } = await import('firebase/auth');
    const app = getApps().length ? getApp() : initializeApp(config);
    const db = getDatabase(app);
    const auth = getAuth(app);
    if (EMU) {
      try { connectDatabaseEmulator(db, EMU, 9000); } catch { /* already connected */ }
      try { connectAuthEmulator(auth, `http://${EMU}:9099`, { disableWarnings: true }); } catch { /* already connected */ }
    }
    return { app, db, auth };
  })();
  return ready;
}

let uidP: Promise<string> | null = null;
export function signIn() {
  uidP ??= (async () => {
    const { auth } = await fb();
    const { signInAnonymously } = await import('firebase/auth');
    await auth.authStateReady();
    return (auth.currentUser ?? (await signInAnonymously(auth)).user).uid;
  })().catch((e) => { uidP = null; throw e; });
  return uidP;
}

// ------------------------------------------------------------------ server clock
let offset = 0;
let offsetStarted = false;
export const serverNow = () => Date.now() + offset;
export async function startServerClock() {
  if (offsetStarted) return;
  offsetStarted = true;
  const { db } = await fb();
  const { ref, onValue } = await import('firebase/database');
  onValue(ref(db, '.info/serverTimeOffset'), (s) => { offset = Number(s.val()) || 0; });
}
/** Re-renders every `ms` and returns the server's current time. */
export function useServerNow(ms = 200) {
  const [t, set] = useState(serverNow());
  useEffect(() => {
    void startServerClock();
    const id = setInterval(() => set(serverNow()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return t;
}

export function useConnected() {
  const [on, set] = useState(true);
  useEffect(() => {
    let off = () => {};
    (async () => {
      const { db } = await fb();
      const { ref, onValue } = await import('firebase/database');
      off = onValue(ref(db, '.info/connected'), (s) => set(!!s.val()));
    })().catch(() => set(false));
    return () => off();
  }, []);
  return on;
}

// ------------------------------------------------------------------ generic
export async function listen<T>(path: string, cb: (v: T | null) => void, onError?: (e: Error) => void): Promise<() => void> {
  const { db } = await fb();
  const { ref, onValue } = await import('firebase/database');
  return onValue(ref(db, path), (s) => cb(s.val() as T | null), (e) => onError?.(e));
}
export async function readOnce<T>(path: string): Promise<T | null> {
  const { db } = await fb();
  const { ref, get } = await import('firebase/database');
  return (await get(ref(db, path))).val() as T | null;
}

export const P = (code: string, rest = '') => `cc/${code}${rest ? `/${rest}` : ''}`;
const isPerm = (e: unknown) => /permission|PERMISSION_DENIED/i.test(String((e as { code?: string; message?: string })?.code ?? (e as Error)?.message ?? e));

// ------------------------------------------------------------------ host
export const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const newCode = () => Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');

/** true if this browser owns the event (claims it if nobody does). */
export async function claim(code: string) {
  const uid = await signIn();
  const { db } = await fb();
  const { ref, runTransaction } = await import('firebase/database');
  const r = await runTransaction(ref(db, P(code, 'owner')), (cur: string | null) => (cur === null || cur === uid ? uid : undefined));
  return r.committed && r.snapshot.val() === uid;
}

// Moving control to another device: the current host publishes a secret key (unreadable to everyone),
// the new device proves it knows the key in the same write that makes it the owner.
export async function startHandover(code: string) {
  const key = Array.from({ length: 10 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
  const { db } = await fb();
  const { ref, set } = await import('firebase/database');
  await set(ref(db, P(code, 'handover')), key);
  return key;
}
export async function cancelHandover(code: string) {
  const { db } = await fb();
  const { ref, update } = await import('firebase/database');
  await update(ref(db, P(code)), { handover: null, handoverTry: null });
}
export async function takeOver(code: string, key: string) {
  const uid = await signIn();
  const { db } = await fb();
  const { ref, update } = await import('firebase/database');
  try {
    await update(ref(db, P(code)), { owner: uid, [`handoverTry/${uid}`]: key });
    await update(ref(db, P(code)), { handover: null, handoverTry: null });
    return true;
  } catch { return false; }
}
export const hostLink = (code: string, key: string) => `${location.origin}${location.pathname}#cc/host/${code}/${key}`;

// ------------------------------------------------------------------ second controllers (co-hosts)
// The main device runs timers and scoring. Co-hosts see the full game and send each change as a proposal;
// the main device accepts it if nothing else changed in between.
const randKey = (n: number) => Array.from({ length: n }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
export async function coKey(code: string, rotate = false) {
  const { db } = await fb();
  const { ref, get, update } = await import('firebase/database');
  const cur = rotate ? null : ((await get(ref(db, P(code, 'cokey')))).val() as string | null);
  if (cur) return cur;
  const key = randKey(10);
  await update(ref(db, P(code)), { cokey: key, ...(rotate ? { cohosts: null } : {}) });
  return key;
}
export async function joinCohost(code: string, key: string) {
  const uid = await signIn();
  const { db } = await fb();
  const { ref, set } = await import('firebase/database');
  try { await set(ref(db, P(code, `cohosts/${uid}`)), key); return true; } catch { return false; }
}
export async function propose(code: string, base: number, state: string) {
  const uid = await signIn();
  const { db } = await fb();
  const { ref, push, set } = await import('firebase/database');
  const r = push(ref(db, P(code, `prop/${uid}`)));
  await set(r, { base, state });
  return r.key!;
}
export async function ackProposal(code: string, uid: string, id: string, ok: boolean) {
  const { db } = await fb();
  const { ref, update } = await import('firebase/database');
  await update(ref(db, P(code)), { [`propAck/${uid}/${id}`]: ok, [`prop/${uid}/${id}`]: null });
}
/** A co-host makes itself the main device (e.g. the laptop died). The old main becomes a co-host. */
export async function becomeMain(code: string) {
  const uid = await signIn();
  const { db } = await fb();
  const { ref, get, update } = await import('firebase/database');
  const old = (await get(ref(db, P(code, 'owner')))).val() as string | null;
  await update(ref(db, P(code)), { owner: uid });
  const key = (await get(ref(db, P(code, 'cokey')))).val() as string | null;
  if (old && key && old !== uid) await update(ref(db, P(code)), { [`cohosts/${old}`]: key, [`cohosts/${uid}`]: null });
}

const last = new Map<string, string>();
/** Multi-path update that skips paths whose value hasn't changed since the last write. */
export async function hostWrite(code: string, parts: Record<string, unknown>, force = false) {
  const { db } = await fb();
  const { ref, update } = await import('firebase/database');
  const patch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parts)) {
    const key = `${code}/${k}`;
    const json = JSON.stringify(v ?? null);
    if (!force && last.get(key) === json) continue;
    last.set(key, json);
    patch[k] = v ?? null;
  }
  if (Object.keys(patch).length) await update(ref(db, P(code)), patch);
}
export const forgetWrites = () => last.clear();

export async function hostResetPin(code: string, team: number, pin: string) {
  const { db } = await fb();
  const { ref, update } = await import('firebase/database');
  await update(ref(db, P(code)), { [`pins/${team}`]: pin, [`sess/${team}`]: null });
}
export async function hostClearTeam(code: string, team: number) {
  const { db } = await fb();
  const { ref, update } = await import('firebase/database');
  await update(ref(db, P(code)), { [`pins/${team}`]: null, [`reg/${team}`]: null, [`sess/${team}`]: null, [`online/${team}`]: null, [`priv/${team}`]: null });
  last.delete(`${code}/priv/${team}`);
}

// ------------------------------------------------------------------ phone
export type JoinResult = 'ok' | 'taken' | 'wrong' | 'closed' | 'offline';

export async function register(code: string, team: number, members: string[], pin: string, regCode: string): Promise<JoinResult> {
  const uid = await signIn();
  const { db } = await fb();
  const { ref, update, serverTimestamp } = await import('firebase/database');
  try {
    await update(ref(db, P(code)), {
      [`pins/${team}`]: pin,
      [`reg/${team}`]: { m: members, at: serverTimestamp(), uid, ...(regCode ? { code: regCode } : {}) },
      [`sess/${team}`]: { uid, pin, at: serverTimestamp() },
    });
    return 'ok';
  } catch (e) {
    return isPerm(e) ? 'taken' : 'offline';
  }
}

/** Sign this phone in for a team (also used to take over from a lost phone). */
export async function rejoin(code: string, team: number, pin: string): Promise<JoinResult> {
  const uid = await signIn();
  const { db } = await fb();
  const { ref, set, serverTimestamp } = await import('firebase/database');
  try {
    await set(ref(db, P(code, `sess/${team}`)), { uid, pin, at: serverTimestamp() });
    return 'ok';
  } catch (e) {
    return isPerm(e) ? 'wrong' : 'offline';
  }
}

export async function setOnline(code: string, team: number) {
  const { db } = await fb();
  const { ref, set, onDisconnect } = await import('firebase/database');
  const r = ref(db, P(code, `online/${team}`));
  try { await onDisconnect(r).remove(); await set(r, true); } catch { /* not our session */ }
}

export async function placeBid(code: string, lot: string, team: number, amount: number): Promise<'ok' | 'rejected' | 'offline'> {
  const { db } = await fb();
  const { ref, push, set, serverTimestamp } = await import('firebase/database');
  try {
    await set(push(ref(db, P(code, `bids/${lot}/${team}`))), { a: amount, at: serverTimestamp() });
    return 'ok';
  } catch (e) { return isPerm(e) ? 'rejected' : 'offline'; }
}

export async function submitAnswer(code: string, win: string, team: number, c: number | string): Promise<'ok' | 'rejected' | 'offline'> {
  const { db } = await fb();
  const { ref, set, serverTimestamp } = await import('firebase/database');
  try {
    await set(ref(db, P(code, `ans/${win}/${team}`)), { c, at: serverTimestamp() });
    return 'ok';
  } catch (e) { return isPerm(e) ? 'rejected' : 'offline'; }
}

export function joinLink(code: string) {
  return `${location.origin}${location.pathname}#play/${code}`;
}
