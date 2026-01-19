/**
 * K-12 Buddy Asset Generator
 * Generates all app icons, splash screens, and store images
 *
 * Run: cd scripts && npm install && npm run generate-assets
 */

import { createCanvas, registerFont } from 'canvas';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Output directories
const MOBILE_ASSETS = path.join(__dirname, '../apps/mobile/assets');
const STORE_ASSETS = path.join(__dirname, '../apps/mobile/assets/store');

// Ensure directories exist
[MOBILE_ASSETS, STORE_ASSETS].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Brand colors - Modern gradient palette
const COLORS = {
  primary: '#4F46E5',      // Indigo
  primaryDark: '#3730A3',  // Dark indigo
  secondary: '#06B6D4',    // Cyan
  accent: '#8B5CF6',       // Purple
  white: '#FFFFFF',
  lightBg: '#F0F4FF',
};

/**
 * Create a modern gradient background
 */
function createGradientBackground(ctx, width, height, vertical = true) {
  let gradient;
  if (vertical) {
    gradient = ctx.createLinearGradient(0, 0, width, height);
  } else {
    gradient = ctx.createLinearGradient(0, 0, width, 0);
  }
  gradient.addColorStop(0, COLORS.primary);
  gradient.addColorStop(0.5, COLORS.accent);
  gradient.addColorStop(1, COLORS.secondary);

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

/**
 * Draw the K-12 Buddy logo icon
 * Modern design with graduation cap + lightbulb fusion
 */
function drawLogoIcon(ctx, centerX, centerY, size) {
  const scale = size / 512;

  // Draw circular background with subtle gradient
  ctx.save();
  const bgGradient = ctx.createRadialGradient(
    centerX, centerY, 0,
    centerX, centerY, size * 0.5
  );
  bgGradient.addColorStop(0, 'rgba(255,255,255,0.2)');
  bgGradient.addColorStop(1, 'rgba(255,255,255,0.05)');

  ctx.beginPath();
  ctx.arc(centerX, centerY, size * 0.42, 0, Math.PI * 2);
  ctx.fillStyle = bgGradient;
  ctx.fill();
  ctx.restore();

  // Draw stylized book/page with lightbulb
  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.scale(scale, scale);

  // Book base - open book shape
  ctx.fillStyle = COLORS.white;
  ctx.beginPath();
  ctx.moveTo(-120, 60);
  ctx.quadraticCurveTo(-140, 0, -120, -60);
  ctx.lineTo(-20, -80);
  ctx.lineTo(-20, 80);
  ctx.lineTo(-120, 60);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(120, 60);
  ctx.quadraticCurveTo(140, 0, 120, -60);
  ctx.lineTo(20, -80);
  ctx.lineTo(20, 80);
  ctx.lineTo(120, 60);
  ctx.fill();

  // Book spine
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath();
  ctx.moveTo(-20, -80);
  ctx.lineTo(0, -90);
  ctx.lineTo(20, -80);
  ctx.lineTo(20, 80);
  ctx.lineTo(0, 90);
  ctx.lineTo(-20, 80);
  ctx.closePath();
  ctx.fill();

  // Lightbulb above book - representing ideas/learning
  const bulbY = -140;

  // Bulb glow
  const glowGradient = ctx.createRadialGradient(0, bulbY, 0, 0, bulbY, 80);
  glowGradient.addColorStop(0, 'rgba(255,220,100,0.6)');
  glowGradient.addColorStop(0.5, 'rgba(255,220,100,0.2)');
  glowGradient.addColorStop(1, 'rgba(255,220,100,0)');
  ctx.fillStyle = glowGradient;
  ctx.beginPath();
  ctx.arc(0, bulbY, 80, 0, Math.PI * 2);
  ctx.fill();

  // Bulb shape
  ctx.fillStyle = '#FFE066';
  ctx.beginPath();
  ctx.arc(0, bulbY, 45, 0, Math.PI * 2);
  ctx.fill();

  // Bulb highlight
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.beginPath();
  ctx.arc(-12, bulbY - 15, 15, 0, Math.PI * 2);
  ctx.fill();

  // Bulb base
  ctx.fillStyle = '#D4D4D8';
  ctx.fillRect(-18, bulbY + 40, 36, 15);
  ctx.fillStyle = '#A1A1AA';
  ctx.fillRect(-15, bulbY + 52, 30, 5);
  ctx.fillRect(-12, bulbY + 55, 24, 5);

  // Stars/sparkles around (representing learning/achievement)
  ctx.fillStyle = COLORS.white;
  drawStar(ctx, -100, -120, 12, 5, 0.5);
  drawStar(ctx, 100, -100, 10, 5, 0.5);
  drawStar(ctx, -80, 20, 8, 5, 0.5);
  drawStar(ctx, 90, 30, 10, 5, 0.5);

  ctx.restore();
}

/**
 * Draw a star shape
 */
function drawStar(ctx, cx, cy, radius, points, inset) {
  ctx.save();
  ctx.beginPath();
  ctx.translate(cx, cy);
  ctx.moveTo(0, -radius);
  for (let i = 0; i < points; i++) {
    ctx.rotate(Math.PI / points);
    ctx.lineTo(0, -radius * inset);
    ctx.rotate(Math.PI / points);
    ctx.lineTo(0, -radius);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/**
 * Draw text with proper styling
 */
function drawText(ctx, text, x, y, fontSize, color = COLORS.white, bold = true) {
  ctx.fillStyle = color;
  ctx.font = `${bold ? 'bold ' : ''}${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
}

/**
 * Generate App Icon (1024x1024)
 */
function generateAppIcon() {
  console.log('Generating app icon (1024x1024)...');
  const size = 1024;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Rounded rectangle background
  const radius = size * 0.22; // iOS style rounded corners
  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.lineTo(size - radius, 0);
  ctx.quadraticCurveTo(size, 0, size, radius);
  ctx.lineTo(size, size - radius);
  ctx.quadraticCurveTo(size, size, size - radius, size);
  ctx.lineTo(radius, size);
  ctx.quadraticCurveTo(0, size, 0, size - radius);
  ctx.lineTo(0, radius);
  ctx.quadraticCurveTo(0, 0, radius, 0);
  ctx.closePath();
  ctx.clip();

  createGradientBackground(ctx, size, size);
  drawLogoIcon(ctx, size / 2, size / 2, size * 0.7);

  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(path.join(MOBILE_ASSETS, 'icon.png'), buffer);
  console.log('  ✓ icon.png');
}

/**
 * Generate Adaptive Icon for Android (1024x1024 foreground)
 */
function generateAdaptiveIcon() {
  console.log('Generating adaptive icon (1024x1024)...');
  const size = 1024;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Transparent background - icon only, centered for safe zone
  ctx.clearRect(0, 0, size, size);
  createGradientBackground(ctx, size, size);
  drawLogoIcon(ctx, size / 2, size / 2, size * 0.5); // Smaller for safe zone

  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(path.join(MOBILE_ASSETS, 'adaptive-icon.png'), buffer);
  console.log('  ✓ adaptive-icon.png');
}

/**
 * Generate Splash Screen (1284x2778 - iPhone 14 Pro Max)
 */
function generateSplashScreen() {
  console.log('Generating splash screen (1284x2778)...');
  const width = 1284;
  const height = 2778;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  createGradientBackground(ctx, width, height);

  // Logo in center-upper area
  const logoY = height * 0.38;
  drawLogoIcon(ctx, width / 2, logoY, width * 0.5);

  // App name below logo
  drawText(ctx, 'K-12 Buddy', width / 2, logoY + width * 0.35, 72);

  // Tagline
  ctx.globalAlpha = 0.8;
  drawText(ctx, 'Your AI Learning Companion', width / 2, logoY + width * 0.42, 32, COLORS.white, false);
  ctx.globalAlpha = 1;

  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(path.join(MOBILE_ASSETS, 'splash.png'), buffer);
  console.log('  ✓ splash.png');
}

/**
 * Generate Favicon (32x32)
 */
function generateFavicon() {
  console.log('Generating favicon (32x32)...');
  const size = 32;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  createGradientBackground(ctx, size, size);

  // Simple icon for small size
  ctx.fillStyle = COLORS.white;
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('K', size / 2, size / 2);

  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(path.join(MOBILE_ASSETS, 'favicon.png'), buffer);
  console.log('  ✓ favicon.png');
}

/**
 * Generate Apple App Store Screenshots
 * Required sizes:
 * - 6.7" (1290x2796) - iPhone 14 Pro Max
 * - 6.5" (1284x2778) - iPhone 14 Plus
 * - 5.5" (1242x2208) - iPhone 8 Plus
 * - 12.9" iPad (2048x2732)
 */
function generateAppleStoreImages() {
  console.log('Generating Apple App Store images...');

  const sizes = [
    { name: 'iphone-6.7', width: 1290, height: 2796 },
    { name: 'iphone-6.5', width: 1284, height: 2778 },
    { name: 'iphone-5.5', width: 1242, height: 2208 },
    { name: 'ipad-12.9', width: 2048, height: 2732 },
  ];

  sizes.forEach(({ name, width, height }) => {
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    createGradientBackground(ctx, width, height);

    const logoSize = Math.min(width, height) * 0.4;
    const logoY = height * 0.35;

    drawLogoIcon(ctx, width / 2, logoY, logoSize);

    // App name
    const titleSize = Math.min(width * 0.07, 80);
    drawText(ctx, 'K-12 Buddy', width / 2, logoY + logoSize * 0.6, titleSize);

    // Tagline
    const taglineSize = Math.min(width * 0.035, 36);
    ctx.globalAlpha = 0.9;
    drawText(ctx, 'AI-Powered Learning for Every Student', width / 2, logoY + logoSize * 0.7, taglineSize, COLORS.white, false);
    ctx.globalAlpha = 1;

    // Feature highlights at bottom
    const features = [
      '📚 Curriculum-Aligned Tutoring',
      '📷 Scan & Learn from Textbooks',
      '💡 Personalized Explanations',
    ];

    const featureY = height * 0.75;
    const featureSpacing = height * 0.05;
    const featureSize = Math.min(width * 0.03, 28);

    features.forEach((feature, i) => {
      ctx.globalAlpha = 0.85;
      drawText(ctx, feature, width / 2, featureY + i * featureSpacing, featureSize, COLORS.white, false);
    });
    ctx.globalAlpha = 1;

    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(path.join(STORE_ASSETS, `apple-${name}.png`), buffer);
    console.log(`  ✓ apple-${name}.png`);
  });
}

/**
 * Generate Google Play Store Images
 * Required:
 * - Feature Graphic (1024x500)
 * - Phone Screenshots (1080x1920 or 1080x2340)
 * - 7" Tablet (1200x1920)
 * - 10" Tablet (1920x1200 landscape or 1200x1920 portrait)
 */
function generateGooglePlayImages() {
  console.log('Generating Google Play Store images...');

  // Feature Graphic (1024x500) - Landscape promotional
  const fgWidth = 1024;
  const fgHeight = 500;
  let canvas = createCanvas(fgWidth, fgHeight);
  let ctx = canvas.getContext('2d');

  // Horizontal gradient for feature graphic
  const fgGradient = ctx.createLinearGradient(0, 0, fgWidth, 0);
  fgGradient.addColorStop(0, COLORS.primary);
  fgGradient.addColorStop(0.5, COLORS.accent);
  fgGradient.addColorStop(1, COLORS.secondary);
  ctx.fillStyle = fgGradient;
  ctx.fillRect(0, 0, fgWidth, fgHeight);

  // Logo on left
  drawLogoIcon(ctx, fgWidth * 0.22, fgHeight * 0.5, fgHeight * 0.7);

  // Text on right
  drawText(ctx, 'K-12 Buddy', fgWidth * 0.62, fgHeight * 0.4, 56);
  ctx.globalAlpha = 0.9;
  drawText(ctx, 'AI Learning Companion', fgWidth * 0.62, fgHeight * 0.58, 28, COLORS.white, false);
  drawText(ctx, 'for Every Student', fgWidth * 0.62, fgHeight * 0.68, 28, COLORS.white, false);
  ctx.globalAlpha = 1;

  let buffer = canvas.toBuffer('image/png');
  fs.writeFileSync(path.join(STORE_ASSETS, 'google-feature-graphic.png'), buffer);
  console.log('  ✓ google-feature-graphic.png');

  // Phone screenshots
  const phoneSizes = [
    { name: 'phone', width: 1080, height: 1920 },
    { name: 'phone-tall', width: 1080, height: 2340 },
  ];

  phoneSizes.forEach(({ name, width, height }) => {
    canvas = createCanvas(width, height);
    ctx = canvas.getContext('2d');

    createGradientBackground(ctx, width, height);

    const logoSize = width * 0.55;
    const logoY = height * 0.35;

    drawLogoIcon(ctx, width / 2, logoY, logoSize);
    drawText(ctx, 'K-12 Buddy', width / 2, logoY + logoSize * 0.55, 52);

    ctx.globalAlpha = 0.9;
    drawText(ctx, 'Your AI Learning Companion', width / 2, logoY + logoSize * 0.65, 24, COLORS.white, false);
    ctx.globalAlpha = 1;

    // Features
    const features = ['📚 Smart Tutoring', '📷 Scan Textbooks', '💡 Step-by-Step Help'];
    const featureY = height * 0.72;
    features.forEach((f, i) => {
      ctx.globalAlpha = 0.85;
      drawText(ctx, f, width / 2, featureY + i * 50, 26, COLORS.white, false);
    });
    ctx.globalAlpha = 1;

    buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(path.join(STORE_ASSETS, `google-${name}.png`), buffer);
    console.log(`  ✓ google-${name}.png`);
  });

  // Tablet screenshots
  const tabletSizes = [
    { name: 'tablet-7', width: 1200, height: 1920 },
    { name: 'tablet-10', width: 1920, height: 1200 },
  ];

  tabletSizes.forEach(({ name, width, height }) => {
    canvas = createCanvas(width, height);
    ctx = canvas.getContext('2d');

    const isLandscape = width > height;

    if (isLandscape) {
      // Horizontal gradient
      const gradient = ctx.createLinearGradient(0, 0, width, 0);
      gradient.addColorStop(0, COLORS.primary);
      gradient.addColorStop(0.5, COLORS.accent);
      gradient.addColorStop(1, COLORS.secondary);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      // Logo on left, text on right
      drawLogoIcon(ctx, width * 0.28, height * 0.5, height * 0.65);
      drawText(ctx, 'K-12 Buddy', width * 0.68, height * 0.4, 64);
      ctx.globalAlpha = 0.9;
      drawText(ctx, 'AI-Powered Learning', width * 0.68, height * 0.52, 32, COLORS.white, false);
      drawText(ctx, 'for Every Student', width * 0.68, height * 0.6, 32, COLORS.white, false);
      ctx.globalAlpha = 1;
    } else {
      createGradientBackground(ctx, width, height);

      const logoSize = width * 0.5;
      const logoY = height * 0.35;

      drawLogoIcon(ctx, width / 2, logoY, logoSize);
      drawText(ctx, 'K-12 Buddy', width / 2, logoY + logoSize * 0.55, 56);

      ctx.globalAlpha = 0.9;
      drawText(ctx, 'Your AI Learning Companion', width / 2, logoY + logoSize * 0.65, 28, COLORS.white, false);
      ctx.globalAlpha = 1;
    }

    buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(path.join(STORE_ASSETS, `google-${name}.png`), buffer);
    console.log(`  ✓ google-${name}.png`);
  });
}

/**
 * Generate all assets
 */
async function main() {
  console.log('\n🎨 K-12 Buddy Asset Generator\n');
  console.log('=' .repeat(40));

  try {
    generateAppIcon();
    generateAdaptiveIcon();
    generateSplashScreen();
    generateFavicon();
    generateAppleStoreImages();
    generateGooglePlayImages();

    console.log('=' .repeat(40));
    console.log('\n✅ All assets generated successfully!\n');
    console.log('Output locations:');
    console.log(`  App assets: ${MOBILE_ASSETS}`);
    console.log(`  Store images: ${STORE_ASSETS}\n`);
  } catch (error) {
    console.error('\n❌ Error generating assets:', error.message);
    process.exit(1);
  }
}

main();
