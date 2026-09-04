const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const jsFiles = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
  const target = path.join(directory, entry.name);
  return entry.isDirectory() ? (entry.name === 'node_modules' ? [] : jsFiles(target)) : entry.name.endsWith('.js') ? [target] : [];
});
const scripts = [
  ...jsFiles(path.join(root, 'js')),
  ...jsFiles(path.join(root, 'scripts')),
  ...jsFiles(path.join(root, 'functions')),
  path.join(root, 'sw.js')
];
for (const script of scripts) execFileSync(process.execPath, ['--check', script], { stdio: 'inherit' });
new vm.Script(fs.readFileSync(path.join(root, 'apps-script', 'Code.gs'), 'utf8'), { filename: 'apps-script/Code.gs' });

for (const file of ['package.json', 'firebase.json', 'firebase.blaze.json', 'firestore.indexes.json', 'vercel.json', 'functions/package.json']) {
  JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
}

console.log(`Checked ${scripts.length + 1} JavaScript files and 6 JSON configuration files.`);
