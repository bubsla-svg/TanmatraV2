const fs = require('fs');
const path = require('path');
const http = require('http');

const manifestPath = path.resolve(__dirname, '../money-path-manifest.json');
if (!fs.existsSync(manifestPath)) {
  console.error(`❌ Manifest file not found at: ${manifestPath}`);
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

const routeToTestPath = (route) => {
  switch (route) {
    case '/':
      return '/';
    case '/menu':
      return '/menu';
    case '/dish/*':
      return '/dish/paneer-tikka-burrito-wrap';
    case '/plans':
      return '/plans';
    case '/subscribe':
      return '/subscribe';
    case '/checkout/*':
      return '/checkout';
    case '/order/confirmed/*':
      return '/order/confirmed/default';
    case '/account/plan':
      return '/account/plan';
    case '/account/billing':
      return '/account/billing';
    default:
      return route;
  }
};

const testPaths = manifest.map(routeToTestPath);

const distDir = path.resolve(__dirname, '../build/client');
const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  let pathname = parsedUrl.pathname;

  let filePath = path.join(distDir, pathname);
  if (!path.extname(filePath)) {
    if (fs.existsSync(path.join(filePath, 'index.html'))) {
      filePath = path.join(filePath, 'index.html');
    } else if (fs.existsSync(filePath + '.html')) {
      filePath = filePath + '.html';
    } else {
      filePath = path.join(distDir, 'index.html');
    }
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

function getUrl(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          html: data,
        });
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

server.listen(0, async () => {
  const port = server.address().port;
  console.log(`📡 Local test server listening on http://localhost:${port}`);

  let failed = false;

  for (const testPath of testPaths) {
    const url = `http://localhost:${port}${testPath}`;
    try {
      const response = await getUrl(url);

      if (response.statusCode !== 200) {
        console.error(`❌ Route ${testPath} returned status ${response.statusCode} (expected 200 OK)`);
        failed = true;
        continue;
      }

      const html = response.html;

      const h1Regex = /<h1[^>]*>([\s\S]*?)<\/h1>/i;
      const h1Match = html.match(h1Regex);
      if (!h1Match) {
        console.error(`❌ Route ${testPath} HTML missing <h1> tag`);
        failed = true;
        continue;
      }

      const ctaRegex = /<a\s[^>]*href=["'][^"']+["']/i;
      if (!ctaRegex.test(html)) {
        console.error(`❌ Route ${testPath} HTML missing progressive anchor link`);
        failed = true;
        continue;
      }

      if (html.includes('<div id="root"></div>') && !html.includes('<html')) {
        console.error(`❌ Route ${testPath} contains fallback root marker`);
        failed = true;
        continue;
      }

      if (html.includes('<title>Loading...</title>')) {
        console.error(`❌ Route ${testPath} returns fallback loading skeleton`);
        failed = true;
        continue;
      }

      console.log(`✅ Route ${testPath} verified successfully! (h1: "${h1Match[1].trim()}")`);

    } catch (err) {
      console.error(`❌ Error requesting route ${testPath}:`, err.message);
      failed = true;
    }
  }

  server.close(() => {
    console.log('📡 Test server shut down.');
    if (failed) {
      process.exit(1);
    } else {
      console.log('🎉 All money-path routes validated successfully!');
      process.exit(0);
    }
  });
});
