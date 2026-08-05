const sharp = require('sharp')
const path = require('path')

const SRC = path.resolve(__dirname, '../src/assets/logo-icon.png')
const OUT = path.resolve(__dirname, '../public')
const BG = '#1c1c1c'

async function makeIcon({ file, size, logoRatio, background = BG, flatten = false }) {
  const logoSize = Math.round(size * logoRatio)
  const logo = await sharp(SRC)
    .resize(logoSize, logoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer()

  let img = sharp({
    create: { width: size, height: size, channels: 4, background },
  }).composite([{ input: logo, gravity: 'center' }])

  if (flatten) img = img.flatten({ background })

  await img.png().toFile(path.join(OUT, file))
  console.log('wrote', file)
}

async function main() {
  await makeIcon({ file: 'pwa-192.png', size: 192, logoRatio: 0.72 })
  await makeIcon({ file: 'pwa-512.png', size: 512, logoRatio: 0.72 })
  await makeIcon({ file: 'pwa-maskable-512.png', size: 512, logoRatio: 0.5 })
  await makeIcon({ file: 'apple-touch-icon.png', size: 180, logoRatio: 0.68, flatten: true })
  await makeIcon({ file: 'favicon-32.png', size: 32, logoRatio: 0.78, flatten: true })
  await makeIcon({ file: 'favicon-16.png', size: 16, logoRatio: 0.8, flatten: true })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
