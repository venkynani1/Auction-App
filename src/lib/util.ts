export const uid = (p = '') => p + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);

const r2 = (n: number) => Math.round(n * 100) / 100;

/** ₹50 L / ₹1.5 Cr. Money is always stored in crores. */
export function money(cr: number) {
  if (cr === 0) return '₹0';
  const neg = cr < 0 ? '−' : '';
  const a = Math.abs(cr);
  if (a < 1) return `${neg}₹${Math.round(a * 100)} L`;
  return `${neg}₹${+r2(a).toFixed(2)} Cr`;
}
export const MONEY = (cr: number) => money(cr).toUpperCase();
export const round2 = r2;

export const pad2 = (n: number) => String(n).padStart(2, '0');

export const initials = (name: string) =>
  name.replace(/\(.*\)/, '').split(/[\s.]+/).filter((w) => /^[A-Za-z]/.test(w)).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('');

export const timeOfDay = (t: number) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/** 25 well-separated team colours around the wheel. */
export function teamColor(i: number) {
  const hue = (i * 137.508 + 20) % 360;
  return `hsl(${hue.toFixed(0)} 78% 62%)`;
}

export async function copyText(text: string) {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

type DownloadsNs = { save: (r: { filename: string; data: string }) => Promise<unknown> };
let dlNs: Promise<DownloadsNs | null> | null = null;
function hostDownloads(): Promise<DownloadsNs | null> {
  const c = (window as unknown as { claude?: { use?: (n: string) => Promise<DownloadsNs | null> } }).claude;
  if (!c?.use) return Promise.resolve(null);
  dlNs ??= c.use('downloads').catch(() => null);
  return dlNs;
}

/** Save a text file: a normal browser download, or the host's save prompt when embedded. */
export async function saveFile(filename: string, text: string, mime = 'text/plain'): Promise<'saved' | 'declined' | 'failed'> {
  const ns = await hostDownloads();
  if (ns) {
    try { await ns.save({ filename, data: text }); return 'saved'; } catch (e) { return (e as { code?: string })?.code === 'declined' ? 'declined' : 'failed'; }
  }
  try {
    const url = URL.createObjectURL(new Blob([text], { type: mime }));
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return 'saved';
  } catch { return 'failed'; }
}

/** Downscale an image file to a portrait JPEG data URL (keeps saves small). */
export function fileToPhoto(file: File, maxW = 600, maxH = 750): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const scale = Math.min(1, maxW / img.width, maxH / img.height);
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', 0.85));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

/** Loose name key for matching photo file names to players. */
export const nameKey = (s: string) => s.toLowerCase().replace(/\.[a-z0-9]+$/, '').replace(/[^a-z0-9]/g, '');
