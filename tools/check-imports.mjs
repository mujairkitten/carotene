#!/usr/bin/env node

import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const SKIP_DIRS = new Set(['node_modules', '.git', 'icons', 'deploy', 'tools', '.github']);

const dirs = process.argv.slice(2);
if (dirs.length === 0) dirs.push('.');

function jsFiles(root) {
  const out = [];
  const walk = d => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
        walk(p);
      } else if (entry.isFile() && entry.name.endsWith('.js')) {
        out.push(p);
      }
    }
  };
  walk(root);
  return out;
}

function exportsOf(text) {
  const names = new Set();

  for (const m of text.matchAll(
    /^[ \t]*export[ \t]+(?:async[ \t]+)?(?:function\*?|const|let|var|class)[ \t]+([A-Za-z_$][\w$]*)/gm
  )) names.add(m[1]);

  if (/^[ \t]*export[ \t]+default[ \t]/m.test(text)) names.add('default');

  for (const m of text.matchAll(/^[ \t]*export[ \t]*\{([^}]*)\}/gm)) {
    for (const part of m[1].split(',')) {
      const n = part.split(/\s+as\s+/).pop().trim();
      if (n) names.add(n);
    }
  }

  return { names, starFrom: [...text.matchAll(/^[ \t]*export[ \t]*\*[ \t]*from[ \t]*['"]([^'"]+)['"]/gm)].map(m => m[1]) };
}

function importsOf(text) {
  const out = [];
  const re = /import\s+([\s\S]*?)\s+from\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(text))) {
    const clause = m[1];
    const line = text.slice(0, m.index).split('\n').length;
    const brace = clause.match(/\{([\s\S]*)\}/);
    const names = [];
    if (brace) {
      for (const part of brace[1].split(',')) {
        const n = part.split(/\s+as\s+/)[0].trim();
        if (n) names.push(n);
      }
    }
    const bare = clause.replace(/\{[\s\S]*\}/, '').replace(/,/g, '').trim();
    if (bare && !bare.startsWith('*')) names.push('default');

    out.push({ line, names, source: m[2] });
  }
  return out;
}

let failures = 0;
let checked = 0;

for (const dir of dirs) {
  const root = resolve(dir);
  if (!existsSync(root) || !statSync(root).isDirectory()) {
    console.log(`::error::check-imports: not a directory: ${dir}`);
    failures++;
    continue;
  }

  const files = jsFiles(root);
  if (files.length === 0) {
    console.log(`::error::check-imports: no .js files found in ${dir}`);
    failures++;
    continue;
  }

  const table = new Map();
  const ensure = f => {
    if (table.has(f)) return table.get(f);
    if (!existsSync(f)) return null;
    const info = exportsOf(readFileSync(f, 'utf8'));
    table.set(f, info);
    return info;
  };
  for (const f of files) ensure(f);
  for (const [f, info] of [...table]) {
    for (const src of info.starFrom) {
      const t = ensure(resolve(dirname(f), src));
      if (t) for (const n of t.names) info.names.add(n);
    }
  }

  const problems = [];
  for (const f of files) {
    const text = readFileSync(f, 'utf8');
    for (const imp of importsOf(text)) {
      if (!imp.source.startsWith('.')) continue;
      const target = resolve(dirname(f), imp.source);
      const t = table.get(target) || ensure(target);
      if (!t) {
        problems.push({ f, line: imp.line, msg: `cannot resolve module '${imp.source}'` });
        continue;
      }
      for (const n of imp.names) {
        checked++;
        if (!t.names.has(n)) {
          problems.push({ f, line: imp.line, msg: `imports { ${n} } from '${imp.source}', which does not export it` });
        }
      }
    }
  }

  const label = relative(process.cwd(), root) || '.';
  if (problems.length === 0) {
    console.log(`OK  ${label}: ${files.length} module(s), ${checked} import binding(s) all resolve`);
  } else {
    for (const p of problems) {
      console.log(`::error file=${relative(process.cwd(), p.f).split(sep).join('/')},line=${p.line}::${p.msg}`);
    }
    console.log(`FAIL ${label}: ${problems.length} unresolved import(s) in ${files.length} module(s)`);
    failures += problems.length;
  }
}

if (failures > 0) {
  console.error(`\ncheck-imports: ${failures} problem(s) found. An unresolved import is a runtime`);
  console.error(`SyntaxError in the browser, not caught by node --check or terser.`);
  process.exit(1);
}
console.log('\ncheck-imports: all imports resolve.');
