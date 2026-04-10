import { execSync } from 'child_process';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8');
env.split('\n').filter(l => l && !l.startsWith('#') && l.includes('=')).forEach(l => {
  const idx = l.indexOf('=');
  const k = l.slice(0, idx).trim();
  const v = l.slice(idx + 1).trim();
  
  if (!k || !v) return;

  console.log(`Removing old ${k}...`);
  try { execSync(`npx vercel env rm ${k} production -y`, { stdio: 'pipe' }); } catch (e) {}

  console.log(`Setting ${k}...`);
  try {
    execSync(`npx vercel env add ${k} production "${v.replace(/"/g, '\\"')}"`, { stdio: 'inherit' });
  } catch (err) {
    console.error(`Failed to add ${k}`);
  }
});
