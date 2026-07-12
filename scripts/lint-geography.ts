import * as fs from 'fs';
import * as path from 'path';

const BUILD_DIR = '/usr/local/google/home/chandansinghr/Wellness-Foods/artifacts/tanmatra/build/client';

const PROHIBITED_STRINGS = ['Bengaluru', '+91 80', '+9180'];
const COPYRIGHT_REGEX = /(?:©|copyright)\s*(?:\([^)]+\)\s*)?\b(2024|2025)\b/i;

function getFiles(dir: string): string[] {
  let results: string[] = [];
  if (!fs.existsSync(dir)) return [];
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

const TEXT_EXTENSIONS = ['.html', '.js', '.css', '.json', '.txt', '.webmanifest', '.svg', '.xml'];

function isTextFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return TEXT_EXTENSIONS.includes(ext);
}

function run() {
  const files = getFiles(BUILD_DIR).filter(isTextFile);
  let hasErrors = false;

  files.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');

    lines.forEach((line, idx) => {
      PROHIBITED_STRINGS.forEach(str => {
        if (line.includes(str)) {
          console.error(`Violation in ${file}:${idx + 1}: Found prohibited string "${str}"`);
          hasErrors = true;
        }
      });

      if (COPYRIGHT_REGEX.test(line)) {
        const match = line.match(COPYRIGHT_REGEX);
        console.error(`Violation in ${file}:${idx + 1}: Found superseded copyright year "${match?.[1]}" in line: ${line.trim()}`);
        hasErrors = true;
      }
    });
  });

  if (hasErrors) {
    process.exit(1);
  } else {
    console.log('✅ Geography lint pass!');
    process.exit(0);
  }
}

run();
