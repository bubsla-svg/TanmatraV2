import * as fs from 'fs';
import * as path from 'path';

const SRC_DIR = '/usr/local/google/home/chandansinghr/Wellness-Foods/artifacts/tanmatra/src';
const INDEX_CSS = path.join(SRC_DIR, 'index.css');

function shouldExcludeFile(filePath: string): boolean {
  if (filePath === INDEX_CSS || filePath.endsWith('theme.css')) return true;
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

const HEX_COLOR_REGEX = /(?<![a-zA-Z0-9_-])#([0-9a-fA-F]+)\b/g;
const COLOR_FUNC_REGEX = /\b(rgb|rgba|hsl|hsla)\(/g;

function isViolation(line: string, filePath: string): { offendingText: string } | null {
  // Strip single-line comments
  let cleanLine = line;
  const doubleSlashIndex = line.indexOf('//');
  if (doubleSlashIndex !== -1) {
    cleanLine = line.substring(0, doubleSlashIndex);
  }

  // Check color function calls
  const funcMatch = cleanLine.match(COLOR_FUNC_REGEX);
  if (funcMatch) {
    return { offendingText: funcMatch[0] };
  }

  // Check hex colors
  let match;
  HEX_COLOR_REGEX.lastIndex = 0;
  while ((match = HEX_COLOR_REGEX.exec(cleanLine)) !== null) {
    const hexVal = match[1];
    const fullMatch = match[0];
    
    // Validate hex color length: 3, 4, 6, or 8 digits
    const len = hexVal.length;
    if (len !== 3 && len !== 4 && len !== 6 && len !== 8) {
      continue;
    }

    // Exclude common non-color patterns:
    // 1. href="#..." or id="..." or id='...' or href='...'
    const lineBeforeMatch = cleanLine.substring(0, match.index);
    if (
      /href\s*=\s*['"]\s*$/i.test(lineBeforeMatch) ||
      /id\s*=\s*['"]\s*$/i.test(lineBeforeMatch) ||
      /url\(\s*$/i.test(lineBeforeMatch)
    ) {
      continue;
    }

    // 2. Markdown headers
    if (filePath.endsWith('.md') || /^\s*#+\s+/.test(line)) {
      continue;
    }

    return { offendingText: fullMatch };
  }

  return null;
}

function run() {
  const files = getFiles(SRC_DIR).filter(f => !shouldExcludeFile(f));
  let hasErrors = false;

  files.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');

    lines.forEach((line, idx) => {
      const violation = isViolation(line, file);
      if (violation) {
        console.error(`Violation in ${file}:${idx + 1}: Found offending color token "${violation.offendingText}" on line: ${line.trim()}`);
        hasErrors = true;
      }
    });
  });

  if (hasErrors) {
    process.exit(1);
  } else {
    console.log('✅ Color lint pass!');
    process.exit(0);
  }
}

run();
