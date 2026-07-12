import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'node:url';

// Resolve paths relative to this script's own location so the gate runs
// identically on any machine / CI / Vercel — never a developer's absolute path.
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url)); // <repo>/scripts
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const BUILD_DIR = path.join(REPO_ROOT, 'artifacts', 'tanmatra', 'build', 'client');

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
  // This gate scans built HTML/JS/CSS, so it must run against a fresh build.
  // Passing vacuously when no build exists would be a false green — fail loudly.
  if (!fs.existsSync(BUILD_DIR)) {
    console.error(
      `Geography lint: build output not found at ${BUILD_DIR}. ` +
      `Run \`pnpm --filter @workspace/tanmatra build\` first.`,
    );
    process.exit(1);
  }

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
