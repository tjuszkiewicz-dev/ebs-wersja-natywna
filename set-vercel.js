const fs = require('fs');
const execSync = require('child_process').execSync;

const env = fs.readFileSync('.env.local', 'utf8');
env.split('\n').filter(l => l && !l.startsWith('#') && l.includes('=')).forEach(l => {
  const idx = l.indexOf('=');
  const k = l.splice(0, idx).trim();
  const v = l.slice(idx + 1).trim();

  if (!k || !v) return;

  console.log(`Setting ${k}...`);
  try {
    execSync(`npx vercel env add ${k} production`, {
      input: v, // Pipe value to stdin
      stdio: ['pipe', 'inherit', 'inherit']
    });
  } catch(e) {}
});
