import * as fs from 'fs';
import * as path from 'path';

const SRC_DIR = '/usr/local/google/home/chandansinghr/Wellness-Foods/artifacts/tanmatra/src';

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
