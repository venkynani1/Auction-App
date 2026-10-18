import { useEffect, useRef } from 'react';

type P = { x: number; y: number; vx: number; vy: number; r: number; w: number; h: number; c: string; spin: number; life: number };
let fire: ((colors: string[], count?: number, origin?: 'top' | 'center' | 'sides') => void) | null = null;

export function confetti(colors: string[] = ['#f5b833', '#ffd977', '#ffffff'], count = 160, origin: 'top' | 'center' | 'sides' = 'center') {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  fire?.(colors, count, origin);
}

export function ConfettiLayer() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    const ctx = c.getContext('2d')!;
    let parts: P[] = [];
    let raf = 0;
    const resize = () => {
      c.width = window.innerWidth * devicePixelRatio;
      c.height = window.innerHeight * devicePixelRatio;
    };
    resize();
    window.addEventListener('resize', resize);
    const loop = () => {
      ctx.clearRect(0, 0, c.width, c.height);
      parts = parts.filter((p) => p.life > 0 && p.y < c.height + 40);
      for (const p of parts) {
        p.vy += 0.18 * devicePixelRatio;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.r += p.spin;
        p.life -= 1;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        ctx.scale(1, Math.cos(p.r * 2));
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      raf = parts.length ? requestAnimationFrame(loop) : 0;
    };
    fire = (colors, count = 160, origin = 'center') => {
      const d = devicePixelRatio;
      for (let i = 0; i < count; i++) {
        let x = c.width / 2, y = c.height * 0.45, ang = Math.random() * Math.PI * 2, sp = (4 + Math.random() * 10) * d;
        if (origin === 'top') { x = Math.random() * c.width; y = -20; ang = Math.PI / 2; sp = (1 + Math.random() * 4) * d; }
        if (origin === 'sides') {
          const left = i % 2 === 0;
          x = left ? 0 : c.width; y = c.height * 0.8;
          ang = left ? -Math.PI / 3 - Math.random() * 0.4 : -2 * Math.PI / 3 + Math.random() * 0.4;
          sp = (10 + Math.random() * 12) * d;
        }
        parts.push({
          x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - (origin === 'center' ? 4 * d : 0),
          r: Math.random() * 6, w: (6 + Math.random() * 6) * d, h: (10 + Math.random() * 8) * d,
          c: colors[i % colors.length]!, spin: (Math.random() - 0.5) * 0.3, life: 220 + Math.random() * 120,
        });
      }
      if (!raf) raf = requestAnimationFrame(loop);
    };
    return () => {
      fire = null;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);
  return <canvas ref={ref} className="pointer-events-none fixed inset-0 z-[70] h-full w-full" aria-hidden />;
}
