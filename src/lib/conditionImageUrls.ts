// Vite glob import — bundles all condition icon assets and returns their hashed URLs at runtime.
// This is the correct way to reference assets in src/assets/ so they work in production.

const pngFiles = import.meta.glob('../assets/Condition Icons/**/*.png', { eager: true, import: 'default' }) as Record<string, string>
const webpFiles = import.meta.glob('../assets/Condition Icons/**/*.webp', { eager: true, import: 'default' }) as Record<string, string>

// Build lookup: "De-Buffs/Blinded.png" → hashed URL
function buildMap(files: Record<string, string>) {
  const map: Record<string, string> = {}
  for (const [path, url] of Object.entries(files)) {
    // path looks like: "../assets/Condition Icons/De-Buffs/Blinded.png"
    const match = path.match(/Condition Icons\/(.+)$/)
    if (match) map[match[1]] = url
  }
  return map
}

const pngMap = buildMap(pngFiles)
const webpMap = buildMap(webpFiles)

/**
 * Returns { webp, png } URLs for a given folder + filename.
 * e.g. getConditionImageUrls('De-Buffs', 'Blinded.png')
 */
export function getConditionImageUrls(folder: string, filename: string): { webp: string | undefined; png: string | undefined } {
  const key = `${folder}/${filename}`
  const webpKey = key.replace(/\.(png|jpg|jpeg)$/i, '.webp')
  return {
    webp: webpMap[webpKey],
    png: pngMap[key],
  }
}
