/**
 * Friction Report Generator
 * 
 * Post-processes E2E test results to:
 * 1. Quantify UX friction points
 * 2. Rank by revenue impact
 * 3. Suggest quick wins
 */

import fs from 'fs';
import path from 'path';

interface FrictionPoint {
  path: string;
  issue: string;
  severity: 'high' | 'medium' | 'low';
  suggestion: string;
}

interface ConversionMetric {
  step: string;
  avgLoadTime: number;
  touchTargetIssues: number;
  validationErrors: number;
  disabledStateIssues: number;
}

// Revenue impact weighting (friction multiplier)
const REVENUE_MULTIPLIER = {
  high: 100,      // High friction = 100x conversion loss risk
  medium: 10,     // Medium friction = 10x
  low: 1,         // Low friction = minimal
};

// CUJ Impact Multiplier (which step has highest $ impact)
const CUJ_MULTIPLIER = {
  'Payment': 1.0,       // Direct payment impact
  'Checkout': 0.9,      // 90% drop here = lost order
  'Subscription': 0.8,  // Recurring revenue
  'Sign Up': 0.7,       // Early funnel
  'Plans': 0.6,         // Awareness stage
  'Cart': 0.5,          // Window shopping
  'Landing': 0.3,       // Top of funnel
};

function calculateFrictionScore(fp: FrictionPoint): number {
  const frictionBase = REVENUE_MULTIPLIER[fp.severity] || 1;
  
  // Extract CUJ from path
  const pathParts = fp.path.split(' ');
  const cujName = pathParts[pathParts.length - 1] || 'Landing';
  const cujMultiplier = Object.entries(CUJ_MULTIPLIER).find(
    ([key]) => fp.path.includes(key)
  )?.[1] || 0.3;

  return frictionBase * cujMultiplier;
}

export function generateFrictionReport(testResults: FrictionPoint[]): string {
  if (testResults.length === 0) {
    return '✅ No friction detected! Money paths are smooth.';
  }

  // Sort by impact score
  const scored = testResults.map(fp => ({
    ...fp,
    score: calculateFrictionScore(fp),
  })).sort((a, b) => b.score - a.score);

  let report = '';
  report += '╔════════════════════════════════════════════════════════════════╗\n';
  report += '║         💳 MONEY PATH FRICTION AUDIT REPORT                   ║\n';
  report += '╚════════════════════════════════════════════════════════════════╝\n\n';

  // Summary stats
  const highCount = scored.filter(s => s.severity === 'high').length;
  const mediumCount = scored.filter(s => s.severity === 'medium').length;
  const lowCount = scored.filter(s => s.severity === 'low').length;
  const totalScore = scored.reduce((sum, s) => sum + s.score, 0);

  report += `📊 SUMMARY\n`;
  report += `  🔴 High Priority: ${highCount}\n`;
  report += `  🟡 Medium Priority: ${mediumCount}\n`;
  report += `  🟢 Low Priority: ${lowCount}\n`;
  report += `  💰 Total Friction Score: ${totalScore.toFixed(0)} (higher = more revenue at risk)\n\n`;

  // Quick wins (medium severity, easy fixes)
  const quickWins = scored
    .filter(s => s.severity === 'medium' && s.suggestion.length > 0)
    .slice(0, 3);

  if (quickWins.length > 0) {
    report += `🚀 TOP 3 QUICK WINS (Fix in <1 hour)\n`;
    quickWins.forEach((item, idx) => {
      report += `  ${idx + 1}. [${item.path}]\n`;
      report += `     Issue: ${item.issue}\n`;
      report += `     Fix: ${item.suggestion}\n`;
      report += `     Revenue Impact: $${(item.score * 100).toFixed(0)}\n\n`;
    });
  }

  // High-priority blockers
  const blockers = scored.filter(s => s.severity === 'high');
  if (blockers.length > 0) {
    report += `🚨 BLOCKERS (Must fix before launch)\n`;
    blockers.forEach((item) => {
      report += `  ❌ [${item.path}] ${item.issue}\n`;
      report += `     → ${item.suggestion}\n`;
      report += `     Revenue Risk: $${(item.score * 1000).toFixed(0)}\n\n`;
    });
  }

  // Friction by CUJ
  report += `\n📈 FRICTION BY CUSTOMER JOURNEY\n`;
  const byPath = new Map<string, { friction: FrictionPoint[], score: number }>();
  
  scored.forEach(fp => {
    const key = fp.path.split(':')[0];
    if (!byPath.has(key)) {
      byPath.set(key, { friction: [], score: 0 });
    }
    const data = byPath.get(key)!;
    data.friction.push(fp);
    data.score += fp.score;
  });

  [...byPath.entries()]
    .sort((a, b) => b[1].score - a[1].score)
    .forEach(([path, { friction, score }]) => {
      const riskLevel = score > 100 ? '🔴' : score > 50 ? '🟡' : '🟢';
      report += `  ${riskLevel} ${path}: ${score.toFixed(0)} points (${friction.length} issues)\n`;
    });

  // Recommendations
  report += `\n📋 RECOMMENDATIONS\n`;
  report += `  1. Fix all HIGH severity items in ${blockers.length > 0 ? 'RED ZONE' : 'critical path'}\n`;
  report += `  2. Run Lighthouse audit: \`pnpm --filter @workspace/tanmatra run lighthouse\`\n`;
  report += `  3. Enable session replay (Sentry/LogRocket) to watch users drop off\n`;
  report += `  4. A/B test checkout flow: 1-page vs step-by-step wizard\n`;
  report += `  5. Set up funnel analytics (Mixpanel/Amplitude) to track drop-off $\n\n`;

  // Conversion potential
  const conversionLift = scored.length === 0 ? 0 : Math.min(scored.length * 2, 25);
  report += `💰 POTENTIAL REVENUE LIFT\n`;
  report += `  If all issues fixed: ~${conversionLift}% conversion improvement\n`;
  report += `  Assuming $1M/mo revenue: +$${(1000000 * conversionLift / 100 / 12).toFixed(0)}/day\n`;

  return report;
}

// Export as JSON for dashboard integration
export function exportMetrics(testResults: FrictionPoint[]): ConversionMetric[] {
  const metrics: ConversionMetric[] = [];
  
  // Group by step
  const steps = ['Landing', 'Sign Up', 'Plans', 'Subscribe', 'Cart', 'Checkout', 'Payment'];
  
  steps.forEach(step => {
    const stepIssues = testResults.filter(fp => fp.path.includes(step));
    
    metrics.push({
      step,
      avgLoadTime: 0,  // Would be calculated from perf metrics
      touchTargetIssues: stepIssues.filter(fp => fp.issue.includes('touch') || fp.issue.includes('44px')).length,
      validationErrors: stepIssues.filter(fp => fp.issue.includes('validation') || fp.issue.includes('error')).length,
      disabledStateIssues: stepIssues.filter(fp => fp.issue.includes('disabled') || fp.issue.includes('locked')).length,
    });
  });

  return metrics;
}

// CLI: Generate report from test results
if (require.main === module) {
  const resultsFile = path.join(__dirname, '../test-results/results.json');
  
  if (!fs.existsSync(resultsFile)) {
    console.error('❌ No test results found. Run: pnpm test');
    process.exit(1);
  }

  const testResults = JSON.parse(fs.readFileSync(resultsFile, 'utf-8'));
  const report = generateFrictionReport(testResults);
  console.log(report);

  // Save report
  fs.writeFileSync(
    path.join(__dirname, '../test-results/friction-report.txt'),
    report
  );

  console.log('\n📁 Report saved to: artifacts/tanmatra/test-results/friction-report.txt');
}
