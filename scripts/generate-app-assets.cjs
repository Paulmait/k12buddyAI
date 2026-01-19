const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const SOURCE_IMAGE = path.join(__dirname, '../apps/mobile/assets/logo-source.png');
const ASSETS_DIR = path.join(__dirname, '../apps/mobile/assets');

async function generateAssets() {
  console.log('Generating app assets from logo-source.png...\n');

  if (!fs.existsSync(SOURCE_IMAGE)) {
    console.error('Error: Source image not found at', SOURCE_IMAGE);
    process.exit(1);
  }

  const sourceMetadata = await sharp(SOURCE_IMAGE).metadata();
  console.log(`Source image: ${sourceMetadata.width}x${sourceMetadata.height}\n`);

  // App icon - 1024x1024, white background, logo fills most of the space
  // iOS will add rounded corners automatically
  await sharp(SOURCE_IMAGE)
    .resize(1024, 1024, {
      fit: 'contain',
      background: '#FFFFFF'
    })
    .flatten({ background: '#FFFFFF' })
    .png()
    .toFile(path.join(ASSETS_DIR, 'icon.png'));
  console.log('✓ Generated icon.png (1024x1024)');

  // Adaptive icon for Android - needs safe zone padding
  // Logo should be in center 66% to account for different mask shapes
  const adaptiveSize = 1024;
  const adaptivePadding = Math.round(adaptiveSize * 0.17); // ~17% padding each side
  const adaptiveLogoSize = adaptiveSize - (adaptivePadding * 2);

  const adaptiveLogo = await sharp(SOURCE_IMAGE)
    .resize(adaptiveLogoSize, adaptiveLogoSize, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 0 }
    })
    .toBuffer();

  await sharp({
    create: {
      width: adaptiveSize,
      height: adaptiveSize,
      channels: 4,
      background: '#FFFFFF'
    }
  })
    .composite([{ input: adaptiveLogo, gravity: 'center' }])
    .png()
    .toFile(path.join(ASSETS_DIR, 'adaptive-icon.png'));
  console.log('✓ Generated adaptive-icon.png (1024x1024)');

  // Splash screen - 1284x2778, indigo background with logo centered
  const splashWidth = 1284;
  const splashHeight = 2778;
  const splashLogoWidth = Math.round(splashWidth * 0.65);
  const splashLogoHeight = Math.round(splashLogoWidth * (sourceMetadata.height / sourceMetadata.width));

  const splashLogo = await sharp(SOURCE_IMAGE)
    .resize(splashLogoWidth, splashLogoHeight, { fit: 'contain' })
    .toBuffer();

  await sharp({
    create: {
      width: splashWidth,
      height: splashHeight,
      channels: 4,
      background: '#FFFFFF'
    }
  })
    .composite([{ input: splashLogo, gravity: 'center' }])
    .png()
    .toFile(path.join(ASSETS_DIR, 'splash.png'));
  console.log(`✓ Generated splash.png (${splashWidth}x${splashHeight})`);

  // Favicon - 48x48
  await sharp(SOURCE_IMAGE)
    .resize(48, 48, {
      fit: 'contain',
      background: '#FFFFFF'
    })
    .flatten({ background: '#FFFFFF' })
    .png()
    .toFile(path.join(ASSETS_DIR, 'favicon.png'));
  console.log('✓ Generated favicon.png (48x48)');

  console.log('\nAsset generation complete!');
}

generateAssets().catch(console.error);
