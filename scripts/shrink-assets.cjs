// One-off asset shrink: condition icons 1024→512 (webp q80 + smaller png fallback),
// and webp versions of the large UI images that only had heavy PNGs.
// Run: node scripts/shrink-assets.cjs
const sharp = require('sharp')
const fs = require('fs')
const path = require('path')

const ICON_ROOT = path.resolve(__dirname, '../src/assets/Condition Icons')
const FOLDERS = ['Buffs', 'Combat Status', 'De-Buffs']
const ICON_SIZE = 512

async function shrinkIcons() {
  for (const folder of FOLDERS) {
    const dir = path.join(ICON_ROOT, folder)
    for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.png'))) {
      const pngPath = path.join(dir, file)
      const webpPath = pngPath.replace(/\.png$/i, '.webp')
      const src = await sharp(pngPath).resize(ICON_SIZE, ICON_SIZE).toBuffer()
      await sharp(src).webp({ quality: 80 }).toFile(webpPath)
      await sharp(src).png({ compressionLevel: 9, palette: true }).toFile(pngPath + '.tmp')
      fs.renameSync(pngPath + '.tmp', pngPath)
      console.log(`icon: ${folder}/${file}`)
    }
  }
}

// UI images: create webp next to the png at a sane max width
const UI_IMAGES = [
  { file: 'lockedin.png', width: 512 },
  { file: 'crossedaxes.png', width: 256 },
  { file: 'crossedswords.png', width: 256 },
]

async function shrinkUi() {
  const assets = path.resolve(__dirname, '../src/assets')
  for (const { file, width } of UI_IMAGES) {
    const src = path.join(assets, file)
    const dst = src.replace(/\.png$/i, '.webp')
    await sharp(src).resize({ width, withoutEnlargement: true }).webp({ quality: 82 }).toFile(dst)
    console.log(`ui: ${file} -> ${path.basename(dst)}`)
  }
}

;(async () => {
  await shrinkIcons()
  await shrinkUi()
  console.log('done')
})()
