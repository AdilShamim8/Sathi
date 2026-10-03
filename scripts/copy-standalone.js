const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const standaloneDir = path.join(rootDir, '.next', 'standalone');

if (fs.existsSync(standaloneDir)) {
  const staticSrc = path.join(rootDir, '.next', 'static');
  const staticDest = path.join(standaloneDir, '.next', 'static');
  const publicSrc = path.join(rootDir, 'public');
  const publicDest = path.join(standaloneDir, 'public');
  const mlSrc = path.join(rootDir, 'ml-artifacts');
  const mlDest = path.join(standaloneDir, 'ml-artifacts');

  try {
    if (fs.existsSync(staticSrc)) {
      fs.mkdirSync(path.dirname(staticDest), { recursive: true });
      fs.cpSync(staticSrc, staticDest, { recursive: true, force: true });
    }
    if (fs.existsSync(publicSrc)) {
      fs.cpSync(publicSrc, publicDest, { recursive: true, force: true });
    }
    if (fs.existsSync(mlSrc)) {
      fs.cpSync(mlSrc, mlDest, { recursive: true, force: true });
    }
    console.log('[standalone] Successfully copied static, public, and ml-artifacts into .next/standalone');
  } catch (err) {
    console.warn('[standalone] Warning while copying standalone assets:', err.message);
  }
} else {
  // Not building in standalone mode (e.g. Vercel deployment) — no copy needed
  console.log('[standalone] No .next/standalone directory detected (standard build output). Skipping copy.');
}
