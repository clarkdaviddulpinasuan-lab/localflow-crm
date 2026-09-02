// Generates PWA icons from the LocalFlow brand without external dependencies.
// Pure Node built-ins (zlib + fs). Run: node scripts/generate-pwa-icons.mjs
// Output: public/icon-192.png, public/icon-512.png, public/icon-maskable-512.png, public/apple-touch-icon.png

import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'public')

const NAVY = [15, 23, 36] // #0f1724
const WHITE = [255, 255, 255]

function lerp(a, b, t) {
  return a + (b - a) * t
}

// Signed distance to an "L" glyph made of two rounded bars, normalized to [0,1] space.
// Negative = inside the glyph.
function roundedBarSDF(x, y, cx, cy, hx, hy, r) {
  const qx = Math.abs(x - cx) - hx + r
  const qy = Math.abs(y - cy) - hy + r
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r
}

function lGlyphDist(x, y) {
  const v = roundedBarSDF(x, y, 0.37, 0.51, 0.09, 0.27, 0.08) // vertical bar
  const h = roundedBarSDF(x, y, 0.5, 0.69, 0.22, 0.1, 0.08) // horizontal bar (bottom)
  return Math.min(v, h)
}

function roundedRectDist(x, y, r) {
  // returns signed distance (<0 inside) for a square icon with corner radius r (fraction of size)
  const cx = Math.abs(x - 0.5) - 0.5
  const cy = Math.abs(y - 0.5) - 0.5
  const dx = cx + r
  const dy = cy + r
  return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0) - r
}

function render(size, { maskable = false, round = true } = {}) {
  const cx = new Uint8Array(size * size * 4)
  const glyphScale = maskable ? 0.5 : 0.62 // keep glyph inside the maskable safe zone
  const safe = (1 - glyphScale) / 2
  const glyph = (x, y) => lGlyphDist((x - safe) / glyphScale, (y - safe) / glyphScale)

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const ux = (px + 0.5) / size
      const uy = (py + 0.5) / size
      const idx = (py * size + px) * 4

      let bgA = 1
      if (round) {
        const edge = roundedRectDist(ux, uy, 0.22)
        bgA = clamp01(0.5 - edge * size * 1.5)
      }

      const d = glyph(ux, uy)
      const glyphA = clamp01(0.5 - d * size * 1.5)

      const r = lerp(NAVY[0], WHITE[0], glyphA)
      const g = lerp(NAVY[1], WHITE[1], glyphA)
      const b = lerp(NAVY[2], WHITE[2], glyphA)
      cx[idx] = Math.round(r)
      cx[idx + 1] = Math.round(g)
      cx[idx + 2] = Math.round(b)
      cx[idx + 3] = Math.round(255 * bgA)
    }
  }
  return cx
}

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

function crc32(buf) {
  let c
  let table = crc32.table
  if (!table) {
    table = new Int32Array(256)
    for (let n = 0; n < 256; n++) {
      c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      table[n] = c
    }
    crc32.table = table
  }
  c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crc])
}

function encodePng(size, rgbaData) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  const stride = size * 4
  const raw = Buffer.alloc((stride + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0 // filter: none
    rgbaData.subarray(y * stride, (y + 1) * stride).forEach((v, i) => (raw[y * (stride + 1) + 1 + i] = v))
  }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}

const jobs = [
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  { file: 'icon-maskable-512.png', size: 512, opts: { maskable: true } },
  { file: 'apple-touch-icon.png', size: 180 },
]

mkdirSync(outDir, { recursive: true })
for (const job of jobs) {
  const pixels = render(job.size, job.opts)
  writeFileSync(join(outDir, job.file), encodePng(job.size, pixels))
  console.log('wrote', join(outDir, job.file))
}