/**
 * postinstall.js — Run prisma generate safely after npm/bun install.
 * Uses child_process so it is cross-platform (Windows CMD, Linux bash, macOS zsh).
 * Failures are non-fatal: if prisma is not yet available (e.g. inside some CI
 * environments before the binary is resolved) we warn and continue.
 */
const { execSync } = require('child_process');

try {
  execSync('prisma generate', { stdio: 'inherit', shell: true });
} catch (err) {
  console.warn('[postinstall] prisma generate failed — continuing anyway. Run `npx prisma generate` manually if needed.');
  console.warn(err.message || err);
  // Exit 0 so npm/bun install does not roll back
  process.exit(0);
}
