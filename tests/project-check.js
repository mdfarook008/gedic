const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const scripts = [
  ...fs.readdirSync(path.join(root, 'js')).filter(file => file.endsWith('.js')).map(file => path.join(root, 'js', file)),
  ...fs.readdirSync(path.join(root, 'scripts')).filter(file => file.endsWith('.js')).map(file => path.join(root, 'scripts', file))
  , path.join(root, 'functions', 'index.js')
];
for (const script of scripts) execFileSync(process.execPath, ['--check', script], { stdio: 'inherit' });
new vm.Script(fs.readFileSync(path.join(root, 'apps-script', 'Code.gs'), 'utf8'), { filename: 'apps-script/Code.gs' });

for (const file of ['package.json', 'firebase.json', 'firebase.blaze.json', 'vercel.json', 'functions/package.json']) {
  JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
}

console.log(`Checked ${scripts.length + 1} JavaScript files and 5 JSON configuration files.`);
