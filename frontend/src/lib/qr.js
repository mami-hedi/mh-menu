import QRCode from 'qrcode';

export const QR_COLORS = [
  { id: '#0B1F4B', label: 'Bleu nuit' },
  { id: '#000000', label: 'Noir' },
];

const opts = (color) => ({ errorCorrectionLevel: 'M', margin: 2, color: { dark: color, light: '#FFFFFF' } });

/** URL publique encodée dans le QR Code : stable, basée sur le slug (jamais sur les produits ou les prix). */
export const qrTarget = (slug, table) => `${window.location.origin}/r/${slug}${table ? `?table=${encodeURIComponent(table)}` : ''}`;

export const qrPng = (text, color, width = 1024) => QRCode.toDataURL(text, { ...opts(color), width });
export const qrSvg = (text, color) => QRCode.toString(text, { ...opts(color), type: 'svg' });

export const safeName = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'qr';

export function download(href, filename) {
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export async function downloadQr({ text, color, format, filename }) {
  if (format === 'svg') {
    const svg = await qrSvg(text, color);
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    download(url, `${filename}.svg`);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } else {
    download(await qrPng(text, color), `${filename}.png`);
  }
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Ouvre une page prête à imprimer (une carte par QR Code). Retourne false si le navigateur bloque la fenêtre. */
export async function printQrSheet({ restaurantName, items, color }) {
  const w = window.open('', '_blank');
  if (!w) return false;
  const cards = await Promise.all(items.map(async (it) => `
    <section class="card">
      <p class="name">${esc(restaurantName)}</p>
      ${it.label ? `<p class="table">Table ${esc(it.label)}</p>` : ''}
      <div class="qr">${await qrSvg(it.text, color)}</div>
      <p class="hint">Scannez pour voir le menu</p>
    </section>`));
  w.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>QR Codes – ${esc(restaurantName)}</title>
  <style>
    body{font-family:system-ui,sans-serif;margin:0;padding:16px;color:#0b1f4b}
    .grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px}
    .card{border:2px solid #0b1f4b;border-radius:16px;padding:20px;text-align:center;break-inside:avoid}
    .name{margin:0;font-size:18px;font-weight:800}.table{margin:6px 0 0;font-size:28px;font-weight:800}
    .qr svg{width:100%;max-width:260px;height:auto;margin:10px auto 0;display:block}.hint{margin:8px 0 0;font-size:14px}
    @media print{body{padding:0}}
  </style></head><body><div class="grid">${cards.join('')}</div>
  </body></html>`);
  w.document.close();
  // Impression déclenchée depuis cette page (la politique CSP interdit les scripts en ligne dans la fenêtre)
  setTimeout(() => { try { w.focus(); w.print(); } catch { /* fenêtre fermée */ } }, 500);
  return true;
}
