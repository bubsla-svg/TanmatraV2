import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'node:url';

// Resolve paths relative to this script's own location so the gate runs
// identically on any machine / CI / Vercel — never a developer's absolute path.
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url)); // <repo>/scripts
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const SRC_DIR = path.join(REPO_ROOT, 'artifacts', 'tanmatra', 'src');

function shouldExcludeFile(filePath: string): boolean {
  const base = path.basename(filePath);
  if (
    base.endsWith('.spec.ts') ||
    base.endsWith('.test.ts') ||
    base === 'fixtures.ts' ||
    base.endsWith('.spec.tsx') ||
    base.endsWith('.test.tsx')
  ) {
    return true;
  }
  if (base === 'rdPlans.ts' || base === 'adapter.ts') {
    return true;
  }
  return false;
}

function getFiles(dir: string): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFiles(filePath));
    } else {
      results.push(filePath);
    }
  });
  return results;
}

const PRICE_REGEX = /₹[0-9]/;

function run() {
  if (!fs.existsSync(SRC_DIR)) {
    console.error(`Price lint: source directory not found at ${SRC_DIR}`);
    process.exit(1);
  }
  const files = getFiles(SRC_DIR).filter(f => !shouldExcludeFile(f));
  let hasErrors = false;

  files.forEach(file => {
    const rawContent = fs.readFileSync(file, 'utf8');

    // Strip block comments while preserving line count (replace non-newline chars with space)
    const content = rawContent.replace(/\/\*[\s\S]*?\*\//g, (match) => {
      return match.replace(/[^\r\n]/g, ' ');
    });

    const lines = content.split('\n');

    lines.forEach((line, idx) => {
      let cleanLine = line;

      // Strip single-line comments
      const doubleSlashIndex = line.indexOf('//');
      if (doubleSlashIndex !== -1) {
        cleanLine = line.substring(0, doubleSlashIndex);
      }

      if (PRICE_REGEX.test(cleanLine)) {
        console.error(`Violation in ${file}:${idx + 1}: Found hardcoded currency literal in line: ${line.trim()}`);
        hasErrors = true;
      }
    });
  });

  if (hasErrors) {
    process.exit(1);
  } else {
    console.log('✅ Price lint pass!');
    process.exit(0);
  }
}

run();
