const https = require('https');
const repo = 'scigazetteofficial-beep/Wellness-Foods';
const prs = [517]; // I will list the ones we worked on
async function check(prNumber) {
  return new Promise((resolve) => {
    https.get(`https://api.github.com/repos/${repo}/pulls/${prNumber}`, {headers: {'User-Agent': 'Node.js'}}, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const pr = JSON.parse(data);
        if (!pr.merged) {
            console.log(`PR #${prNumber} not merged — state: ${pr.state}`);
        } else {
            console.log(`PR #${prNumber} CONFIRMED MERGED — sha: ${pr.merge_commit_sha}`);
        }
        resolve();
      });
    });
  });
}
async function run() {
  for (const pr of prs) await check(pr);
}
run();
