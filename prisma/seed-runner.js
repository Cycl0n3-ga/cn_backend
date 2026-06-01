const fs = require('fs');
const cp = require('child_process');

if (fs.existsSync('dist/prisma/seed.js')) {
  cp.execSync('node dist/prisma/seed.js', { stdio: 'inherit' });
} else {
  cp.execSync('npx ts-node prisma/seed.ts', { stdio: 'inherit' });
}
