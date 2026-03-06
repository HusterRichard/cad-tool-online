// Step 1: Convert all .mwsvg files to standalone SVG and PNG
// Extracts the SVG content from <variant> tags in .mwsvg files
// Renders to PNG using sharp at 32x32 and 16x16 sizes

import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const RESOURCE_DIR = 'ref/src/mw_cad_toolbox/src/resource';
const OUTPUT_DIR = 'public/icons';

// Ensure output directories exist
for (const sub of ['svg/32', 'svg/16', 'png/32', 'png/16']) {
  fs.mkdirSync(path.join(OUTPUT_DIR, sub), { recursive: true });
}

// Find all .mwsvg files recursively
function findFiles(dir, ext, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) findFiles(full, ext, results);
    else if (entry.name.endsWith(ext)) results.push(full);
  }
  return results;
}

const mwsvgFiles = findFiles(RESOURCE_DIR, '.mwsvg');
console.log(`Found ${mwsvgFiles.length} .mwsvg files`);

// Extract SVG from <variant> tag
function extractVariant(content, variantId) {
  const regex = new RegExp(
    `<variant[^>]*id="${variantId}"[^>]*>\\s*(<svg[\\s\\S]*?</svg>)\\s*</variant>`,
    'i'
  );
  const match = content.match(regex);
  if (!match) return null;
  return match[1].trim();
}

// Process all files
const results = [];
let successCount = 0;
let failCount = 0;

for (const filePath of mwsvgFiles) {
  const content = fs.readFileSync(filePath, 'utf8');
  const relPath = path.relative(RESOURCE_DIR, filePath);
  const baseName = path.basename(filePath, '.mwsvg');
  // Include subdirectory in output name to avoid collisions
  const subDir = path.dirname(relPath);
  const prefix = subDir === '.' ? '' : subDir.replace(/[/\\]/g, '_') + '_';
  const outputName = prefix + baseName;

  // Extract large (32x32) variant
  const largeSvg = extractVariant(content, 'large');
  // Extract small (20x20) variant
  const smallSvg = extractVariant(content, 'small');

  if (largeSvg) {
    fs.writeFileSync(path.join(OUTPUT_DIR, 'svg/32', outputName + '.svg'), largeSvg);
  }
  if (smallSvg) {
    fs.writeFileSync(path.join(OUTPUT_DIR, 'svg/16', outputName + '.svg'), smallSvg);
  }

  results.push({
    source: relPath,
    outputName,
    hasLarge: !!largeSvg,
    hasSmall: !!smallSvg,
  });
}

console.log(`Extracted SVGs: ${results.filter(r => r.hasLarge).length} large, ${results.filter(r => r.hasSmall).length} small`);

// Now convert SVGs to PNGs using sharp
async function convertAll() {
  let pngOk = 0, pngFail = 0;

  for (const r of results) {
    // Convert large SVG to 32x32 PNG
    if (r.hasLarge) {
      try {
        const svgPath = path.join(OUTPUT_DIR, 'svg/32', r.outputName + '.svg');
        const svgBuf = fs.readFileSync(svgPath);
        const pngBuf = await sharp(svgBuf, { density: 150 })
          .resize(32, 32, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .png()
          .toBuffer();
        fs.writeFileSync(path.join(OUTPUT_DIR, 'png/32', r.outputName + '.png'), pngBuf);
        pngOk++;
      } catch (e) {
        console.error(`FAIL 32: ${r.outputName}: ${e.message}`);
        pngFail++;
      }
    }

    // Convert small SVG to 16x16 PNG
    if (r.hasSmall) {
      try {
        const svgPath = path.join(OUTPUT_DIR, 'svg/16', r.outputName + '.svg');
        const svgBuf = fs.readFileSync(svgPath);
        const pngBuf = await sharp(svgBuf, { density: 150 })
          .resize(16, 16, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
          .png()
          .toBuffer();
        fs.writeFileSync(path.join(OUTPUT_DIR, 'png/16', r.outputName + '.png'), pngBuf);
        pngOk++;
      } catch (e) {
        console.error(`FAIL 16: ${r.outputName}: ${e.message}`);
        pngFail++;
      }
    }
  }

  console.log(`PNG conversion: ${pngOk} success, ${pngFail} fail`);
}

await convertAll();

// Write the mapping manifest
const manifest = results.map(r => ({
  source: r.source,
  key: r.outputName,
  sizes: {
    ...(r.hasLarge ? { '32': `png/32/${r.outputName}.png` } : {}),
    ...(r.hasSmall ? { '16': `png/16/${r.outputName}.png` } : {}),
  }
}));

fs.writeFileSync(
  path.join(OUTPUT_DIR, 'manifest.json'),
  JSON.stringify(manifest, null, 2)
);

console.log(`\nManifest written to ${OUTPUT_DIR}/manifest.json with ${manifest.length} entries`);
