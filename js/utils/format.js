function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function n(v) {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

function b(v) {
  if (typeof v === 'boolean') return v;
  const t = String(v ?? '').trim().toLowerCase();
  return ['true', '1', 'yes', 'y'].includes(t);
}

function money(v) {
  return 'INR ' + n(v).toFixed(0);
}

function parseDate(v) {
  if (!v) return null;
  if (Object.prototype.toString.call(v) === '[object Date]') return Number.isNaN(v.getTime()) ? null : v;
  let t = String(v).trim().replace(/\//g, '-');
  if (!t) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) t += 'T00:00:00';
  else if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}(:\d{2})?$/.test(t)) t = t.replace(' ', 'T');
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d;
}

function fmtDate(d, tz) {
  if (!d) return 'Date TBA';
  try {
    return new Intl.DateTimeFormat('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: tz || undefined
    }).format(d);
  } catch (e) {
    return d.toLocaleString();
  }
}

function cleanDisplayText(value) {
  const text = String(value || '');
  if (!/[ÃƒÃ‚Ã¢]/.test(text)) return text;
  try {
    const bytes = Uint8Array.from(Array.from(text).map(ch => ch.charCodeAt(0) & 255));
    return new TextDecoder('utf-8').decode(bytes);
  } catch (e) {
    return text;
  }
}

function shade(hex, pct) {
  const v = hex.replace('#', '');
  if (v.length !== 6) return hex;
  const num = parseInt(v, 16);
  const r = Math.max(0, Math.min(255, (num >> 16) + pct));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + pct));
  const b2 = Math.max(0, Math.min(255, (num & 0x0000FF) + pct));
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b2).toString(16).slice(1);
}
