// BID WARS 2.0 game selection. Classic keeps its old links (#console, #join/…); Code & Chaos lives under #cc and #play.
import { useState } from 'react';
import { Paddle } from './components/Brand';

export function Landing() {
  const [code, setCode] = useState('');
  const join = (e: React.FormEvent) => {
    e.preventDefault();
    const c = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (c.length >= 4) location.hash = `play/${c}`;
  };
  return (
    <div className="min-h-screen bg-[#05060a] text-[#f3efe6]">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(900px_420px_at_20%_-10%,rgba(212,166,74,.16),transparent_70%),radial-gradient(900px_520px_at_95%_110%,rgba(34,227,255,.14),transparent_70%)]" />
      <main className="relative mx-auto flex min-h-screen max-w-[1400px] flex-col px-4 py-[clamp(20px,5vh,56px)]">
        <header className="flex flex-col items-center text-center">
          <Paddle className="h-12 w-auto" />
          <h1 className="mt-3 font-[family-name:var(--font-display)] text-[clamp(44px,8vw,112px)] font-black leading-[.85] tracking-tight">
            <span className="gold-text">BID WARS</span> <span className="text-white/90">2.0</span>
          </h1>
          <p className="mt-3 font-[family-name:var(--font-cond)] text-[clamp(14px,1.6vw,22px)] font-semibold uppercase tracking-[.3em] text-white/60">Bid smart · Think fast · Rule the arena</p>
        </header>

        <div className="mt-[clamp(24px,5vh,56px)] grid flex-1 grid-cols-1 gap-5 lg:grid-cols-2">
          <a href="#console" className="group relative flex min-h-[360px] flex-col justify-end overflow-hidden rounded-[28px] border border-[#3a2c14] p-[clamp(20px,3vw,40px)] transition duration-500 hover:-translate-y-1 hover:border-[#d4a64a] focus-visible:-translate-y-1"
            style={{ background: 'radial-gradient(700px 380px at 80% 0%, rgba(200,16,46,.28), transparent 65%), radial-gradient(600px 400px at 0% 100%, rgba(212,166,74,.22), transparent 70%), linear-gradient(160deg, #110d08, #050403)' }}>
            <div className="pointer-events-none absolute -right-10 -top-10 h-72 w-72 rounded-full border border-[#d4a64a]/20 transition duration-700 group-hover:scale-110" />
            <div className="pointer-events-none absolute right-8 top-8 font-[family-name:var(--font-display)] text-[clamp(90px,14vw,200px)] font-black leading-none text-[#d4a64a]/10">01</div>
            <div className="relative">
              <div className="font-[family-name:var(--font-cond)] text-sm font-bold uppercase tracking-[.3em] text-[#e4485f]">Game 01</div>
              <h2 className="mt-2 font-[family-name:var(--font-display)] text-[clamp(40px,5vw,76px)] font-black uppercase leading-[.85]"><span className="gold-text">Bid Wars</span><br />Classic</h2>
              <p className="mt-3 max-w-md text-lg text-white/70">The original auction experience. Actors, cricketers, singers and the mystery round, with the console, projector and team rooms you already know.</p>
              <div className="mt-6 inline-flex items-center gap-3 rounded-full bg-gradient-to-b from-[#f2d48a] to-[#d4a64a] px-6 py-3 font-bold text-[#241a05] shadow-[0_10px_40px_-10px_#d4a64a] transition group-hover:gap-5">Open Classic <span aria-hidden>→</span></div>
            </div>
          </a>

          <a href="#cc" className="theme-cc group relative flex min-h-[360px] flex-col justify-end overflow-hidden rounded-[28px] border border-[#1a2f5e] p-[clamp(20px,3vw,40px)] transition duration-500 hover:-translate-y-1 hover:border-[#22e3ff] focus-visible:-translate-y-1"
            style={{ background: 'radial-gradient(700px 380px at 85% 0%, rgba(139,92,255,.35), transparent 65%), radial-gradient(600px 420px at 0% 100%, rgba(34,227,255,.22), transparent 70%), linear-gradient(160deg, #071433, #030712)' }}>
            <div className="circuit pointer-events-none absolute inset-0 opacity-70" />
            <div className="pointer-events-none absolute -right-16 -top-16 h-80 w-80 rounded-full border-2 border-dashed border-[#22e3ff]/25 animate-spin-slow" />
            <div className="pointer-events-none absolute right-8 top-8 font-[family-name:var(--font-display)] text-[clamp(90px,14vw,200px)] font-bold leading-none text-[#22e3ff]/10">02</div>
            <div className="relative">
              <div className="font-[family-name:var(--font-cond)] text-sm font-bold uppercase tracking-[.3em] text-[#22e3ff]">Game 02 · New</div>
              <h2 className="mt-2 font-[family-name:var(--font-display)] text-[clamp(40px,5vw,76px)] font-bold uppercase leading-[.9]"><span className="cyan-text">Code</span> <span className="text-[#ffc83d]">&amp;</span><br /><span className="cyan-text">Chaos</span></h2>
              <p className="mt-3 max-w-md text-lg text-[#b9cbec]">The ultimate tech &amp; entertainment auction. Bid for a question, answer it in 10 seconds, and if you miss it, every other team gets a shot.</p>
              <div className="mt-6 inline-flex items-center gap-3 rounded-full bg-gradient-to-r from-[#22e3ff] to-[#8b5cff] px-6 py-3 font-bold text-[#030712] shadow-[0_10px_40px_-10px_#22e3ff] transition group-hover:gap-5">Host Code &amp; Chaos <span aria-hidden>→</span></div>
            </div>
          </a>
        </div>

        <form onSubmit={join} className="theme-cc mx-auto mt-6 flex w-full max-w-md flex-col items-center gap-2 rounded-2xl border border-[#1a2f5e] bg-[#071026]/80 p-4 text-center">
          <label htmlFor="join-code" className="font-[family-name:var(--font-cond)] text-sm font-semibold uppercase tracking-[.2em] text-[#8aa3cf]">Playing Code &amp; Chaos? Enter the event code</label>
          <div className="flex w-full gap-2">
            <input id="join-code" className="field text-center font-[family-name:var(--font-display)] text-2xl tracking-[.3em] uppercase" maxLength={8} autoComplete="off" placeholder="ABC123" value={code} onChange={(e) => setCode(e.target.value)} />
            <button className="rounded-xl bg-[#22e3ff] px-5 font-bold text-[#030712] disabled:opacity-40" disabled={code.trim().length < 4}>Join</button>
          </div>
          <p className="text-xs text-[#566c98]">Or scan the QR code on the big screen.</p>
        </form>
      </main>
    </div>
  );
}
