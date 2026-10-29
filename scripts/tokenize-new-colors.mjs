// Mechanical, appearance-preserving cleanup of newly introduced CSS literals.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
const tokenPath = 'src/themeTokens.css';
let tokens = readFileSync(tokenPath, 'utf8');
const registry = new Map([['#fff', '--color-white'], ['#ffffff', '--color-white']]);
const normalize = value => value.toLowerCase().replace(/\s/g, '');
for (const match of tokens.slice(0, tokens.indexOf(':root[data-theme="light"]')).matchAll(/(--[\w-]+):\s*(#[\da-f]+|rgba?\([^)]*\));/gi)) {
  if (!registry.has(normalize(match[2]))) registry.set(normalize(match[2]), match[1]);
}
const additions = [];
for (const name of readdirSync('src').filter(name => /\.(css|jsx)$/.test(name) && name !== 'themeTokens.css')) {
  const path = `src/${name}`;
  const original = readFileSync(path, 'utf8');
  const updated = original.replace(/#[\da-f]{3,8}\b|rgba?\([^)]*\)/gi, value => {
    const key = normalize(value);
    if (!registry.has(key)) {
      const token = `--redesign-color-${additions.length + 1}`;
      registry.set(key, token);
      additions.push(`  ${token}: ${value};`);
    }
    return `var(${registry.get(key)})`;
  });
  if (updated !== original) { writeFileSync(path, updated); console.log(path); }
}
if (additions.length) writeFileSync(tokenPath, `${tokens}\n/* Fixed illustration, swatch and overlay colours shared by both themes. */\n:root {\n${additions.join('\n')}\n}\n`);
