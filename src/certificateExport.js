// AAI Journal certificate exporter. The live DOM is the single export source.
import { toBlob, toJpeg } from 'html-to-image';
const encoder = new TextEncoder();
const bytes = value => typeof value === 'string' ? encoder.encode(value) : value;
function concat(parts) {
  const chunks = parts.map(bytes);
  const output = new Uint8Array(chunks.reduce((n, chunk) => n + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.length; }
  return output;
}

function inlineStyles(source, target) {
  const computed = getComputedStyle(source);
  for (const property of computed) {
    // CSS animations, transforms, and filters can interfere with SVG capture.
    if (/^(animation|transition)/.test(property)) continue;
    target.style.setProperty(property, computed.getPropertyValue(property), 'important');
  }
  target.style.setProperty('animation', 'none', 'important');
  target.style.setProperty('transition', 'none', 'important');
  for (let i = 0; i < source.children.length; i++) {
    inlineStyles(source.children[i], target.children[i]);
  }
}

async function svgCanvas(element) {
  await document.fonts?.ready;
  const bounds = element.getBoundingClientRect();
  const width = Math.round(bounds.width);
  const height = Math.round(bounds.height);
  if (!width || !height) throw new Error('Certificate has no visible dimensions.');
  const clone = element.cloneNode(true);
  inlineStyles(element, clone);
  clone.style.width = `${width}px`;
  clone.style.height = `${height}px`;
  clone.style.margin = '0';
  clone.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
  const markup = new XMLSerializer().serializeToString(clone);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><foreignObject x="0" y="0" width="100%" height="100%">${markup}</foreignObject></svg>`;
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const image = new Image();
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('Browser rejected SVG foreignObject certificate capture.'));
      image.src = url;
    });
    const scale = Math.min(3, Math.max(2, window.devicePixelRatio || 1));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D context is unavailable.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    // Detect tainted canvases before returning them to the export pipeline.
    context.getImageData(0, 0, 1, 1);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Draws a clean, self-contained certificate when a browser cannot rasterize
// the original DOM. Uses text and theme colors from the actual certificate.
function fallbackCanvas(element) {
  const width = 1600, height = 1130;
  const scale = Math.min(3, Math.max(2, window.devicePixelRatio || 1));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context is unavailable.');
  ctx.scale(scale, scale);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const get = selector => element.querySelector(selector)?.textContent?.trim() || '';
  const color = (variable, defaultColor) => {
    const probe = document.createElement('span');
    probe.style.cssText = `position:absolute;pointer-events:none;color:var(${variable},${defaultColor})`;
    element.appendChild(probe);
    try { return getComputedStyle(probe).color || defaultColor; }
    finally { probe.remove(); }
  };
  const text = color('--text', '#13221b');
  const muted = color('--muted', '#607168');
  const accent = color('--accent', '#087e51');
  const gold = color('--celebrate-gold', '#d4a72c');
  const surface = color('--surface', '#fffaf0');

  const round = (x, y, w, h, r) => {
    ctx.beginPath(); ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.closePath();
  };
  const centered = (value, x, y, maxWidth, lineHeight = 30) => {
    const words = String(value || '').split(/\s+/);
    const lines = []; let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(candidate).width > maxWidth) { lines.push(line); line = word; }
      else line = candidate;
    }
    if (line) lines.push(line);
    lines.forEach((value, i) => ctx.fillText(value, x, y + i * lineHeight, maxWidth));
    return lines.length;
  };

  const background = ctx.createRadialGradient(width / 2, 0, 20, width / 2, 0, width);
  background.addColorStop(0, '#fffdf8'); background.addColorStop(1, surface);
  ctx.fillStyle = background; ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = gold; ctx.lineWidth = 3;
  round(25, 25, width - 50, height - 50, 28); ctx.stroke();
  ctx.globalAlpha = .55; ctx.lineWidth = 1;
  round(46, 46, width - 92, height - 92, 18); ctx.stroke(); ctx.globalAlpha = 1;

  ctx.fillStyle = accent; ctx.font = '700 19px Arial';
  ctx.fillText(get('.cc2-brand'), width / 2, 94, 1100);
  ctx.fillStyle = text; ctx.font = '600 60px Georgia';
  centered(get('.cc2-ttl'), width / 2, 154, 1100, 60);
  ctx.fillStyle = gold; ctx.font = '700 20px Arial'; ctx.fillText('◆', width / 2, 285);
  ctx.fillStyle = muted; ctx.font = '700 17px Arial'; ctx.fillText('THIS CERTIFIES THAT', width / 2, 338);
  ctx.fillStyle = text; ctx.font = 'italic 600 100px Georgia';
  ctx.fillText(get('.cc2-nm'), width / 2, 435, 1200);
  ctx.fillStyle = muted; ctx.font = '500 21px Arial';
  centered(get('.cc2-txt'), width / 2, 505, 1120, 30);

  const stats = [...element.querySelectorAll('.cc2-row div')].map(item => [
    item.querySelector('b')?.textContent || '—', item.querySelector('span')?.textContent || ''
  ]);
  const rowX = 265, rowY = 620, rowW = 1070, rowH = 115, col = rowW / 4;
  ctx.globalAlpha = .55; ctx.strokeStyle = gold; ctx.lineWidth = 1; ctx.beginPath();
  ctx.moveTo(rowX, rowY); ctx.lineTo(rowX + rowW, rowY);
  ctx.moveTo(rowX, rowY + rowH); ctx.lineTo(rowX + rowW, rowY + rowH);
  for (let i = 1; i < 4; i++) { ctx.moveTo(rowX + col * i, rowY); ctx.lineTo(rowX + col * i, rowY + rowH); }
  ctx.stroke(); ctx.globalAlpha = 1;
  stats.slice(0, 4).forEach(([value, label], i) => {
    const x = rowX + col * (i + .5);
    ctx.fillStyle = text; ctx.font = '700 31px Georgia'; ctx.fillText(value, x, rowY + 43, col - 12);
    ctx.fillStyle = muted; ctx.font = '700 15px Arial'; ctx.fillText(label.toUpperCase(), x, rowY + 78, col - 12);
  });

  const bars = [...element.querySelectorAll('.cc2-bars i')];
  const chartX = 265, chartY = 820, chartW = 1070, chartH = 78, gap = 5;
  const barW = (chartW - gap * Math.max(0, bars.length - 1)) / Math.max(1, bars.length);
  ctx.fillStyle = muted; ctx.globalAlpha = .5;
  ctx.fillRect(chartX, chartY + chartH - 2, chartW, 2); ctx.globalAlpha = 1;
  bars.forEach((bar, i) => {
    const fraction = Number.parseFloat(bar.style.getPropertyValue('--h')) / 40;
    const h = Math.min(chartH, Math.max(5, chartH * (Number.isFinite(fraction) ? fraction : .2)));
    const gradient = ctx.createLinearGradient(0, chartY + chartH - h, 0, chartY + chartH);
    gradient.addColorStop(0, accent);
    // Do NOT concatenate '55' to a computed rgb()/color() value: that is invalid CSS.
    gradient.addColorStop(1, accent);
    ctx.globalAlpha = .75;
    ctx.fillStyle = gradient;
    ctx.fillRect(chartX + i * (barW + gap), chartY + chartH - h, Math.max(1, barW), h);
    ctx.globalAlpha = 1;
  });

  const date = get('.cc2-foot .cc2-sg:first-child .cc2-l');
  const issuer = get('.cc2-foot .cc2-sg:last-child .cc2-l');
  ctx.strokeStyle = muted; ctx.globalAlpha = .65; ctx.beginPath();
  ctx.moveTo(165, 995); ctx.lineTo(455, 995);
  ctx.moveTo(1145, 995); ctx.lineTo(1435, 995);
  ctx.stroke(); ctx.globalAlpha = 1;
  ctx.fillStyle = text; ctx.font = 'italic 600 32px Georgia';
  ctx.fillText(date, 310, 966, 350); ctx.fillText(issuer, 1290, 966, 350);
  ctx.fillStyle = muted; ctx.font = '700 14px Arial';
  ctx.fillText('DATE COMPLETED', 310, 1023);
  ctx.fillText('ISSUED BY', 1290, 1023);
  ctx.fillText(get('.cc2-cid'), width / 2, 1060, 1100);
  return canvas;
}

function canvasBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error(`Canvas could not encode ${type}.`)), type, quality);
    } catch (error) { reject(error); }
  });
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = filename; link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  // iOS/Safari may start the download asynchronously; do not revoke immediately.
  setTimeout(() => { link.remove(); URL.revokeObjectURL(url); }, 60000);
}

function imagePdf(jpeg, width, height) {
  const pageWidth = 842;
  const pageHeight = Math.round(pageWidth * height / width);
  const stream = `q\n${pageWidth} 0 0 ${pageHeight} 0 0 cm\n/Certificate Do\nQ\n`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /Certificate 4 0 R >> >> /Contents 5 0 R >>`,
    concat([`<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`, jpeg, '\nendstream']),
    `<< /Length ${encoder.encode(stream).length} >>\nstream\n${stream}endstream`
  ];
  // Exact bytes, including the binary marker, so xref offsets are valid.
  const header = concat([encoder.encode('%PDF-1.4\n%'), new Uint8Array([0xff, 0xff, 0xff, 0xff]), encoder.encode('\n')]);
  const chunks = [header];
  const offsets = [0];
  let length = header.length;
  objects.forEach((object, index) => {
    offsets.push(length);
    const objectBytes = concat([`${index + 1} 0 obj\n`, object, '\nendobj\n']);
    chunks.push(objectBytes);
    length += objectBytes.length;
  });
  const xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${length}\n%%EOF\n`;
  return new Blob([...chunks, encoder.encode(xref)], { type: 'application/pdf' });
}

export async function downloadCertificate(element, name, kind) {
  if (!element) throw new Error('Certificate preview is unavailable.');
  if (kind !== 'image' && kind !== 'pdf') throw new Error(`Unsupported certificate export type: ${kind}`);
  const safeName = String(name || 'certificate').trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'certificate';
  await document.fonts?.ready;
  const options = {pixelRatio:3,cacheBust:true,skipAutoScale:true};
  if (kind === 'image') {
    const image = await toBlob(element, options);
    if (!image) throw new Error('Certificate image encoding failed.');
    download(image, `${safeName}-certificate.png`);
    return;
  }
  const jpegUrl = await toJpeg(element, {...options,quality:.96});
  const jpeg = new Uint8Array(await (await fetch(jpegUrl)).arrayBuffer());
  const box = element.getBoundingClientRect();
  download(imagePdf(jpeg, Math.round(box.width * 3), Math.round(box.height * 3)), `${safeName}-certificate.pdf`);
}
