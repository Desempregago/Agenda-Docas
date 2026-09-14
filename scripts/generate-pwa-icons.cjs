/**
 * Gera public/pwa-192.png e public/pwa-512.png rasterizando a geometria do
 * favicon.svg (cubo isométrico em fundo azul arredondado) — sem dependências.
 * Uso: node scripts/generate-pwa-icons.cjs
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** RGBA buffer -> PNG (sem compressão prévia, zlib level 9). */
function encodePng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const hex = (h) => {
  const v = parseInt(h.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
};

/** Desenha o ícone em size×size: rounded-rect azul + cubo isométrico com linhas brancas. */
function drawIcon(size) {
  const bg = hex('#2563EB');
  const white = [255, 255, 255, 255];
  const light = [...hex('#93C5FD'), 255];
  const rgba = Buffer.alloc(size * size * 4);

  const radius = size * 0.25; // rx=8 de 32
  const scale = size / 32;
  const inRect = (x, y) => {
    // rounded rect coverage (SDF simples)
    const cx = Math.min(Math.max(x, radius), size - radius);
    const cy = Math.min(Math.max(y, radius), size - radius);
    const dx = x - cx, dy = y - cy;
    return dx * dx + dy * dy <= radius * radius;
  };
  const distToSeg = (px, py, x1, y1, x2, y2) => {
    const vx = x2 - x1, vy = y2 - y1;
    const wx = px - x1, wy = py - y1;
    const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / (vx * vx + vy * vy || 1)));
    const dx = px - (x1 + t * vx), dy = py - (y1 + t * vy);
    return Math.sqrt(dx * dx + dy * dy);
  };
  // Geometria do favicon (coordenadas 0..32)
  const P = (x, y) => [x * scale, y * scale];
  const edges = [
    // outline do cubo
    [[16, 6], [7, 11]], [[7, 11], [7, 21]], [[7, 21], [16, 26]], [[16, 26], [25, 21]], [[25, 21], [25, 11]], [[25, 11], [16, 6]],
    // verticais + internas
    [[16, 16], [16, 26]], [[25, 11], [16, 16]], [[7, 11], [16, 16]],
  ];
  const highlight = [[[11.5, 8.5], [20.5, 13.5]]];
  const strokeWidth = 1.6 * scale;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      if (!inRect(x + 0.5, y + 0.5)) continue; // transparente fora
      rgba[idx] = bg[0]; rgba[idx + 1] = bg[1]; rgba[idx + 2] = bg[2]; rgba[idx + 3] = 255;

      let isWhite = false, isLight = false;
      for (const [[x1, y1], [x2, y2]] of edges) {
        const [ax, ay] = P(x1, y1), [bx, by] = P(x2, y2);
        if (distToSeg(x + 0.5, y + 0.5, ax, ay, bx, by) <= strokeWidth / 2) { isWhite = true; break; }
      }
      if (!isWhite) {
        for (const [[x1, y1], [x2, y2]] of highlight) {
          const [ax, ay] = P(x1, y1), [bx, by] = P(x2, y2);
          if (distToSeg(x + 0.5, y + 0.5, ax, ay, bx, by) <= strokeWidth * 0.75 / 2 * 1.5) { isLight = true; break; }
        }
      }
      const c = isWhite ? white : isLight ? light : null;
      if (c) { rgba[idx] = c[0]; rgba[idx + 1] = c[1]; rgba[idx + 2] = c[2]; rgba[idx + 3] = 255; }
    }
  }
  return rgba;
}

const outDir = path.join(process.cwd(), 'public');
for (const size of [192, 512]) {
  const png = encodePng(size, size, drawIcon(size));
  const file = path.join(outDir, `pwa-${size}.png`);
  fs.writeFileSync(file, png);
  console.log(`ok: ${file} (${Math.round(png.length / 1024)} KB)`);
}
