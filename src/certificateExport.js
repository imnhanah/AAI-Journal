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
  const canvas = await certificateCanvas(element);
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
