/**
 * Renders the SpeakStream app icons from the logo SVG motif.
 * One-off generator: `node scripts/make-icons.mjs` (requires dev dep `sharp`).
 */

import { mkdirSync } from 'node:fs';

let sharp;
try {
  sharp = (await import('sharp')).default;
} catch {
  console.warn('[make-icons] sharp unavailable — skipping icon generation');
  process.exit(0);
}

const BG = '#0B0F17';
const DIM = '#39455C';
const AMBER = '#FFB454';

/** The teleprompter glyph, drawn in a 1024×1024 box. */
function glyph({ mono = false } = {}) {
  const line = mono ? '#FFFFFF' : DIM;
  const hot = mono ? '#FFFFFF' : AMBER;
  const bandFill = mono ? 'rgba(255,255,255,0.14)' : 'rgba(255,180,84,0.16)';
  const bandStroke = mono ? 'rgba(255,255,255,0.28)' : 'rgba(255,180,84,0.30)';
  return `
    <rect x="192" y="412" width="640" height="200" rx="100" fill="${bandFill}"
          stroke="${bandStroke}" stroke-width="6"/>
    <rect x="288" y="268" width="448" height="60" rx="30" fill="${line}"/>
    <rect x="240" y="482" width="420" height="60" rx="30" fill="${hot}"/>
    <path d="M700 452 L784 512 L700 572 Z" fill="${hot}"/>
    <rect x="328" y="696" width="368" height="60" rx="30" fill="${line}"/>
  `;
}

function svg(size, inner) {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1024 1024">${inner}</svg>`,
  );
}

const iconSvg = svg(
  1024,
  `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#101724"/>
      <stop offset="1" stop-color="${BG}"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#bg)"/>
  ${glyph()}
`,
);

// Adaptive foreground: glyph scaled into the 66% safe zone, transparent bg.
const foregroundSvg = svg(
  1024,
  `<g transform="translate(512 512) scale(0.68) translate(-512 -512)">${glyph()}</g>`,
);

const monochromeSvg = svg(
  1024,
  `<g transform="translate(512 512) scale(0.68) translate(-512 -512)">${glyph({ mono: true })}</g>`,
);

// Splash: glyph on transparent (backgroundColor comes from the plugin).
const splashSvg = svg(1024, glyph());

mkdirSync('assets', { recursive: true });

await sharp(iconSvg).resize(1024, 1024).png().toFile('assets/icon.png');
await sharp(foregroundSvg).resize(1024, 1024).png().toFile('assets/android-icon-foreground.png');
await sharp(monochromeSvg).resize(1024, 1024).png().toFile('assets/android-icon-monochrome.png');
await sharp(splashSvg).resize(512, 512).png().toFile('assets/splash-icon.png');
await sharp(iconSvg).resize(48, 48).png().toFile('assets/favicon.png');

console.log('icons written to assets/');
