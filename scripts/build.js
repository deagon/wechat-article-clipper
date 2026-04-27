#!/usr/bin/env node
/**
 * Build script: copies vendor JS libs into vendor/.
 * Run: npm run build
 * Icons in icons/ are static assets managed manually.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const VENDOR = path.join(ROOT, 'vendor');

fs.mkdirSync(VENDOR, { recursive: true });

// ─── Copy vendor libraries ────────────────────────────────────────────────────

function copyVendor(moduleName, srcFile, destName) {
  const src = path.join(ROOT, 'node_modules', moduleName, srcFile);
  const dest = path.join(VENDOR, destName);
  if (!fs.existsSync(src)) {
    console.error(`✗ Not found: ${src}`);
    console.error(`  Run: npm install`);
    process.exit(1);
  }
  fs.copyFileSync(src, dest);
  const size = (fs.statSync(dest).size / 1024).toFixed(1);
  console.log(`✓ vendor/${destName} (${size} KB)`);
}

copyVendor('turndown', 'lib/turndown.umd.js', 'turndown.umd.js');
copyVendor('jszip', 'dist/jszip.min.js', 'jszip.min.js');

console.log('\nBuild complete. Load the extension from:');
console.log(`  ${ROOT}`);
