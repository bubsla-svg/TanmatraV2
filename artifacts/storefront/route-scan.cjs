const fs = require('fs');
const path = require('path');

function getFiles(dir, filesList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const name = dir + '/' + file;
    if (fs.statSync(name).isDirectory()) {
      getFiles(name, filesList);
    } else {
      if (name.endsWith('page.tsx')) filesList.push(name);
    }
  }
  return filesList;
}

const files = getFiles('app');
for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  let status = 'UNKNOWN';
  if (content.includes('PlaceholderPage')) {
    status = 'DEFINED (Placeholder)';
  } else if (content.includes('Not yet implemented') || content.includes('Coming soon') || content.length < 500) {
    status = 'PRESENT (Structure only)';
  } else {
    status = 'REACHABLE / FUNCTIONAL';
  }
  console.log(`[${status}] ${file}`);
}
