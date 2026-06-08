const sharp = require('sharp')
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '../src/assets/Condition Icons')
const FOLDERS = ['Buffs', 'Combat Status', 'De-Buffs']
const TARGET_SIZE = 1024
const PAD_FRAC = 0.08

async function normalise(filePath) {
  const trimmed = await sharp(filePath).trim({ threshold: 10 }).toBuffer()
  const fitSize = Math.round(TARGET_SIZE * (1 - PAD_FRAC * 2))
  const resized = await sharp(trimmed)
    .resize({ width: fitSize, height: fitSize, fit: 'inside', withoutEnlargement: false, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer()
  const rMeta = await sharp(resized).metadata()
  const left = Math.round((TARGET_SIZE - rMeta.width) / 2)
  const top = Math.round((TARGET_SIZE - rMeta.height) / 2)

  const webpBuf = await sharp({ create: { width: TARGET_SIZE, height: TARGET_SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: resized, left, top }])
    .webp({ quality: 75 })
    .toBuffer()

  const pngBuf = await sharp({ create: { width: TARGET_SIZE, height: TARGET_SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: resized, left, top }])
    .png()
    .toBuffer()

  return { webpBuf, pngBuf }
}

async function main() {
  for (const folder of FOLDERS) {
    const dir = path.join(ROOT, folder)
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.png'))
    for (const file of files) {
      const srcPng = path.join(dir, file)
      const dstWebp = path.join(dir, file.replace(/\.png$/i, '.webp'))
      console.log(`Normalising: ${folder}/${file}`)
      const { webpBuf, pngBuf } = await normalise(srcPng)
      fs.writeFileSync(dstWebp, webpBuf)
      fs.writeFileSync(srcPng, pngBuf)
    }
  }
  console.log('Done — all icons normalised to 1024×1024 with uniform padding')
}

main().catch(err => { console.error(err); process.exit(1) })