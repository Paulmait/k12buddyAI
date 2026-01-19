const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const SOURCE_IMAGE = path.join(__dirname, '../apps/mobile/assets/logo-source.png');
const ASSETS_DIR = path.join(__dirname, '../apps/mobile/assets');
const STORE_DIR = path.join(__dirname, '../apps/mobile/assets/store');

// Ensure store directory exists
if (!fs.existsSync(STORE_DIR)) {
  fs.mkdirSync(STORE_DIR, { recursive: true });
}

async function generateAssets() {
  console.log('Generating app assets from logo-source.png...\n');

  if (!fs.existsSync(SOURCE_IMAGE)) {
    console.error('Error: Source image not found at', SOURCE_IMAGE);
    process.exit(1);
  }

  const sourceMetadata = await sharp(SOURCE_IMAGE).metadata();
  console.log(`Source image: ${sourceMetadata.width}x${sourceMetadata.height}\n`);

  console.log('=== App Icons ===\n');

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

  // App Store icon - 1024x1024 (no alpha channel required by App Store)
  await sharp(SOURCE_IMAGE)
    .resize(1024, 1024, {
      fit: 'contain',
      background: '#FFFFFF'
    })
    .flatten({ background: '#FFFFFF' })
    .png()
    .toFile(path.join(STORE_DIR, 'app-store-icon-1024x1024.png'));
  console.log('✓ Generated store/app-store-icon-1024x1024.png (1024x1024)');

  // Adaptive icon for Android - needs safe zone padding
  const adaptiveSize = 1024;
  const adaptivePadding = Math.round(adaptiveSize * 0.17);
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

  console.log('\n=== Splash Screen ===\n');

  // Splash screen - 1284x2778
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

  console.log('\n=== App Store Screenshots ===\n');

  // iPhone screenshot sizes
  const iphoneScreenshots = [
    { name: 'apple-iphone-6.7.png', width: 1290, height: 2796, desc: 'iPhone 14 Pro Max (6.7")' },
    { name: 'apple-iphone-6.5.png', width: 1284, height: 2778, desc: 'iPhone 11 Pro Max (6.5")' },
    { name: 'apple-iphone-5.5.png', width: 1242, height: 2208, desc: 'iPhone 8 Plus (5.5")' },
  ];

  // iPad screenshot sizes
  const ipadScreenshots = [
    { name: 'apple-ipad-12.9.png', width: 2048, height: 2732, desc: 'iPad Pro 12.9" (3rd gen)' },
  ];

  // Google Play screenshot sizes
  const googleScreenshots = [
    { name: 'google-feature-graphic.png', width: 1024, height: 500, desc: 'Feature Graphic' },
    { name: 'google-phone.png', width: 1080, height: 1920, desc: 'Phone (16:9)' },
    { name: 'google-phone-tall.png', width: 1080, height: 2340, desc: 'Phone Tall (19.5:9)' },
    { name: 'google-tablet-7.png', width: 1200, height: 1920, desc: 'Tablet 7"' },
    { name: 'google-tablet-10.png', width: 1920, height: 1200, desc: 'Tablet 10" (landscape)' },
  ];

  // Generate iPhone screenshots (promotional images with logo)
  for (const screenshot of iphoneScreenshots) {
    await generatePromoImage(screenshot.width, screenshot.height, screenshot.name, screenshot.desc, sourceMetadata);
  }

  // Generate iPad screenshots
  for (const screenshot of ipadScreenshots) {
    await generatePromoImage(screenshot.width, screenshot.height, screenshot.name, screenshot.desc, sourceMetadata);
  }

  // Generate Google Play screenshots
  for (const screenshot of googleScreenshots) {
    await generatePromoImage(screenshot.width, screenshot.height, screenshot.name, screenshot.desc, sourceMetadata);
  }

  console.log('\n=== Asset Generation Complete! ===\n');
}

async function generatePromoImage(width, height, filename, description, sourceMetadata) {
  // Calculate logo size (about 40% of the smaller dimension)
  const minDim = Math.min(width, height);
  const logoSize = Math.round(minDim * 0.5);
  const logoHeight = Math.round(logoSize * (sourceMetadata.height / sourceMetadata.width));

  const logo = await sharp(SOURCE_IMAGE)
    .resize(logoSize, logoHeight, { fit: 'contain' })
    .toBuffer();

  await sharp({
    create: {
      width: width,
      height: height,
      channels: 4,
      background: '#FFFFFF'
    }
  })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toFile(path.join(STORE_DIR, filename));

  console.log(`✓ Generated store/${filename} (${width}x${height}) - ${description}`);
}

generateAssets().catch(console.error);
