const textEncoder = new TextEncoder();

const copyComputedStyles = (source, target) => {
  const style = getComputedStyle(source);
  target.style.cssText = Array.from(style).map(name => `${name}:${style.getPropertyValue(name)}!important`).join(';');
  target.style.animation = 'none';
  target.style.transition = 'none';
  [...source.children].forEach((child, index) => copyComputedStyles(child, target.children[index]));
};

const toBytes = value => typeof value === 'string' ? textEncoder.encode(value) : value;
const joinBytes = values => {
  const chunks = values.map(toBytes);
  const result = new Uint8Array(chunks.reduce((size, chunk) => size + chunk.length, 0));
  let offset = 0;
  chunks.forEach(chunk => { result.set(chunk, offset); offset += chunk.length; });
  return result;
};

async function certificateCanvas(element) {
  const box = element.getBoundingClientRect();
  const width = Math.max(1, Math.round(box.width));
  const height = Math.max(1, Math.round(box.height));
  const clone = element.cloneNode(true);
  copyComputedStyles(element, clone);
  clone.style.width = `${width}px`;
  clone.style.height = `${height}px`;
  clone.style.margin = '0';
  const markup = new XMLSerializer().serializeToString(clone);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><foreignObject width="100%" height="100%">${markup}</foreignObject></svg>`;
  const image = new Image();
  const url = URL.createObjectURL(new Blob([svg], {type:'image/svg+xml;charset=utf-8'}));
  try {
    await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; image.src = url; });
    const scale = Math.min(3, Math.max(2, window.devicePixelRatio || 1));
    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Canvas is the dependable fallback for browsers that reject SVG foreignObject
// rasterisation. It deliberately reads the visible certificate copy and theme
// tokens, so the saved asset still matches the user's active light/dark theme.
function fallbackCanvas(element) {
  const scale = Math.min(3, Math.max(2, window.devicePixelRatio || 1));
  const width = 1600, height = 1130;
  const canvas = document.createElement('canvas');
  canvas.width = width * scale; canvas.height = height * scale;
  const ctx = canvas.getContext('2d'); ctx.scale(scale, scale); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const resolve = (variable, fallback) => {
    const probe = document.createElement('i'); probe.style.cssText = `position:absolute;color:var(${variable},${fallback})`; element.append(probe);
    const value = getComputedStyle(probe).color; probe.remove(); return value || fallback;
  };
  const text = resolve('--text', '#13221b'), muted = resolve('--muted', '#607168'), accent = resolve('--accent', '#087e51'), gold = resolve('--celebrate-gold', '#d4a72c'), surface = resolve('--surface', '#fffaf0');
  const round = (x, y, w, h, r) => {
    // Avoid CanvasRenderingContext2D.roundRect: some Chromium builds used by
    // the desktop app still expose an older 2D canvas implementation.
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r); ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.closePath();
  };
  const centered = (value, x, y, maxWidth, gap = 30) => {
    const words = String(value || '').split(' '); const lines = []; let line = '';
    words.forEach(word => { const next = line ? `${line} ${word}` : word; if (line && ctx.measureText(next).width > maxWidth) { lines.push(line); line = word; } else line = next; });
    if (line) lines.push(line); lines.forEach((lineValue, index) => ctx.fillText(lineValue, x, y + index * gap)); return lines.length;
  };
  const gradient = ctx.createRadialGradient(width / 2, 0, 20, width / 2, 0, width); gradient.addColorStop(0, '#fffdf8'); gradient.addColorStop(1, surface); ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = gold; ctx.lineWidth = 3; round(25, 25, width - 50, height - 50, 28); ctx.stroke(); ctx.globalAlpha = .55; ctx.lineWidth = 1; round(46, 46, width - 92, height - 92, 18); ctx.stroke(); ctx.globalAlpha = 1;
  const get = selector => element.querySelector(selector)?.textContent?.trim() || '';
  ctx.fillStyle = accent; ctx.font = '700 19px Arial'; ctx.fillText(get('.cc2-brand'), width / 2, 94);
  ctx.fillStyle = text; ctx.font = '600 60px Georgia'; centered(get('.cc2-ttl'), width / 2, 154, 1000, 60);
  ctx.fillStyle = gold; ctx.font = '700 20px Arial'; ctx.fillText('◆', width / 2, 285);
  ctx.fillStyle = muted; ctx.font = '700 17px Arial'; ctx.fillText('THIS CERTIFIES THAT', width / 2, 338);
  ctx.fillStyle = text; ctx.font = 'italic 600 100px Georgia'; ctx.fillText(get('.cc2-nm'), width / 2, 435);
  ctx.fillStyle = muted; ctx.font = '500 21px Arial'; centered(get('.cc2-txt'), width / 2, 505, 1120, 30);
  const stats = [...element.querySelectorAll('.cc2-row div')].map(item => [item.querySelector('b')?.textContent, item.querySelector('span')?.textContent]); const rowX = 265, rowY = 620, rowW = 1070, rowH = 115, col = rowW / 4;
  ctx.globalAlpha = .55; ctx.strokeStyle = gold; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(rowX, rowY); ctx.lineTo(rowX + rowW, rowY); ctx.moveTo(rowX, rowY + rowH); ctx.lineTo(rowX + rowW, rowY + rowH); for (let index = 1; index < 4; index += 1) { ctx.moveTo(rowX + col * index, rowY); ctx.lineTo(rowX + col * index, rowY + rowH); } ctx.stroke(); ctx.globalAlpha = 1;
  stats.forEach(([value, label], index) => { const x = rowX + col * (index + .5); ctx.fillStyle = text; ctx.font = '700 31px Georgia'; ctx.fillText(value || '—', x, rowY + 43); ctx.fillStyle = muted; ctx.font = '700 15px Arial'; ctx.fillText(String(label || '').toUpperCase(), x, rowY + 78); });
  const bars = [...element.querySelectorAll('.cc2-bars i')], chartX = 265, chartY = 820, chartW = 1070, chartH = 78, gap = 5, barW = (chartW - gap * Math.max(0, bars.length - 1)) / Math.max(1, bars.length); ctx.fillStyle = '#81928a'; ctx.fillRect(chartX, chartY + chartH - 2, chartW, 2);
  bars.forEach((bar, index) => { const h = Math.max(5, chartH * (Number.parseFloat(bar.style.getPropertyValue('--h')) / 40 || .2)); const fill = ctx.createLinearGradient(0, chartY + chartH - h, 0, chartY + chartH); fill.addColorStop(0, accent); fill.addColorStop(1, `${accent}55`); ctx.fillStyle = fill; ctx.fillRect(chartX + index * (barW + gap), chartY + chartH - h, barW, h); });
  const date = get('.cc2-foot .cc2-sg:first-child .cc2-l'), issuer = get('.cc2-foot .cc2-sg:last-child .cc2-l'); ctx.strokeStyle = muted; ctx.globalAlpha = .65; ctx.beginPath(); ctx.moveTo(165, 995); ctx.lineTo(455, 995); ctx.moveTo(1145, 995); ctx.lineTo(1435, 995); ctx.stroke(); ctx.globalAlpha = 1; ctx.fillStyle = text; ctx.font = 'italic 600 32px Georgia'; ctx.fillText(date, 310, 966); ctx.fillText(issuer, 1290, 966); ctx.fillStyle = muted; ctx.font = '700 14px Arial'; ctx.fillText('DATE COMPLETED', 310, 1023); ctx.fillText('ISSUED BY', 1290, 1023); ctx.fillText(get('.cc2-cid'), width / 2, 1060);
  return canvas;
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.append(link);
  link.click();
  setTimeout(() => { link.remove(); URL.revokeObjectURL(url); }, 0);
}

function imagePdf(jpeg, width, height) {
  const ratio = width / height;
  const pageWidth = 842;
  const pageHeight = Math.round(pageWidth / ratio);
  const content = `q\n${pageWidth} 0 0 ${pageHeight} 0 0 cm\n/Certificate Do\nQ\n`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /Certificate 4 0 R >> >> /Contents 5 0 R >>`,
    joinBytes([`<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`, jpeg, '\nendstream']),
    `<< /Length ${textEncoder.encode(content).length} >>\nstream\n${content}endstream`,
  ];
  const head = '%PDF-1.4\n%\xFF\xFF\xFF\xFF\n';
  const chunks = [head];
  const offsets = [0];
  let size = textEncoder.encode(head).length;
  objects.forEach((object, index) => {
    offsets.push(size);
    const objectBytes = joinBytes([`${index + 1} 0 obj\n`, object, '\nendobj\n']);
    chunks.push(objectBytes);
    size += objectBytes.length;
  });
  const xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${size}\n%%EOF`;
  return new Blob([...chunks, xref], {type:'application/pdf'});
}

export async function downloadCertificate(element, name, kind) {
  if (!element) throw new Error('Certificate preview is unavailable.');
  const safeName = String(name || 'certificate').trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'certificate';
  let canvas;
  try { canvas = await certificateCanvas(element); }
  catch { canvas = fallbackCanvas(element); }
  if (kind === 'image') {
    const image = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!image) throw new Error('Could not create certificate image.');
    download(image, `${safeName}-certificate.png`);
    return;
  }
  const jpeg = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', .96));
  if (!jpeg) throw new Error('Could not create certificate PDF.');
  download(imagePdf(new Uint8Array(await jpeg.arrayBuffer()), canvas.width, canvas.height), `${safeName}-certificate.pdf`);
}
