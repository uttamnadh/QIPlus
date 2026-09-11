import { chromium } from '@playwright/test';
import { loadConfig } from './config';
import { AgentRunSummary, Bug, ExplorationResult, RoleName, Severity } from './types';
import { Crawler } from './core/crawler';
import { FormFuzzer } from './core/form-fuzzer';
import { BugDetector } from './core/detector';
import { ApiProber } from './core/api-prober';
import { RunDiffer } from './core/run-differ';
import { MobileViewportTester } from './core/mobile-viewport';
import { healthCheck } from './core/resilience';
import { OnboardingStrategy } from './roles/onboarding';
import { ComplianceStrategy } from './roles/compliance';
import { ApproverStrategy } from './roles/approver';
import { AuditorStrategy } from './roles/auditor';
import { AdminStrategy } from './roles/admin';
import { BugReportGenerator } from './reporters/bug-report';
import { HtmlReporter } from './reporters/html-reporter';
import { WebhookNotifier } from './reporters/notifier';

function parseCliArgs() {
  const args = process.argv.slice(2);
  let selectedRole: RoleName | null = null;
  let isQuick = false;
  let isHeaded = false;
  let skipMobile = false;
  let skipA11y = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--role' && args[i + 1]) {
      selectedRole = args[i + 1].toLowerCase() as RoleName;
      i++;
    } else if (args[i] === '--quick') {
      isQuick = true;
    } else if (args[i] === '--headed') {
      isHeaded = true;
    } else if (args[i] === '--skip-mobile') {
      skipMobile = true;
    } else if (args[i] === '--skip-a11y') {
      skipA11y = true;
    }
  }

  return { selectedRole, isQuick, isHeaded, skipMobile, skipA11y };
}

async function main() {
  const startTime = new Date().toISOString();
  const startMs = Date.now();
  const config = loadConfig();
  const cli = parseCliArgs();

  console.log('\n============================================================');
  console.log('🤖 MuseQA — Autonomous Bug-Hunting AI Agent for Qi Plus IDMS');
  console.log('============================================================');
  console.log(`🎯 Target URL    : ${config.baseURL}`);
  console.log(`⚙️  Headless Mode : ${!cli.isHeaded && config.exploration.headless}`);
  console.log(`⚡ Quick Mode    : ${cli.isQuick}`);

  // Preliminary health check
  console.log(`\n🏥 Running target connectivity health check...`);
  const health = await healthCheck(config.baseURL);
  if (!health.healthy) {
    console.error(`❌ Target unreachable: ${health.error || `HTTP ${health.status}`}. Aborting agent run.`);
    process.exit(2);
  }
  console.log(`✅ Target is reachable (HTTP ${health.status || 200})`);

  const rolesToRun: RoleName[] = cli.selectedRole
    ? [cli.selectedRole]
    : ((Object.keys(config.roles) as RoleName[]).filter(r => config.roles[r].enabled !== false));

  console.log(`📋 Roles Queued  : ${rolesToRun.join(', ')}`);

  const browser = await chromium.launch({
    headless: !cli.isHeaded && config.exploration.headless,
  });

  const allBugs: Bug[] = [];
  const explorations: ExplorationResult[] = [];
  const crawler = new Crawler(config.exploration.maxPagesPerRole, config.exploration.maxDepth);
  const fuzzer = new FormFuzzer();

  for (const roleName of rolesToRun) {
    const creds = config.roles[roleName];
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`👤 Role: ${creds.displayName} (${roleName})`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    const context = await browser.newContext({
      baseURL: config.baseURL,
      ignoreHTTPSErrors: true,
    });
    const page = await context.newPage();
    const detector = new BugDetector(page, roleName);

    let strategy;
    switch (roleName) {
      case 'onboarding':
        strategy = new OnboardingStrategy(creds);
        break;
      case 'compliance':
        strategy = new ComplianceStrategy(creds);
        break;
      case 'approver':
        strategy = new ApproverStrategy(creds);
        break;
      case 'auditor':
        strategy = new AuditorStrategy(creds);
        break;
      case 'admin':
        strategy = new AdminStrategy(creds);
        break;
      default:
        console.warn(`Unknown role: ${roleName}`);
        await context.close();
        continue;
    }

    const explorationResult = await strategy.explore(
      page,
      crawler,
      fuzzer,
      detector,
      config.features.accessibilityScan && !cli.skipA11y,
      config.features.formFuzzing && !cli.isQuick
    );

    // Run API prober if not in quick mode
    if (config.features.apiProbing && !cli.isQuick) {
      const prober = new ApiProber(detector.getDiscoveredEndpoints());
      await prober.probe(page, roleName, detector);
    }

    explorationResult.bugsFound = detector.getBugs();
    explorations.push(explorationResult);
    allBugs.push(...explorationResult.bugsFound);

    await context.close();
  }

  // Run mobile viewport tests if enabled
  if (config.features.mobileViewport && !cli.skipMobile && !cli.isQuick) {
    const mobBugs = await MobileViewportTester.testViewports(
      browser,
      'onboarding',
      config.roles.onboarding,
      config.mobile.viewports,
      config.mobile.pagesToTest
    );
    allBugs.push(...mobBugs);
  }

  await browser.close();

  // Diffing against known bugs & previous runs
  const differ = new RunDiffer();
  const diff = differ.compare(allBugs);

  // Compile summary
  const severities: Record<Severity, number> = { Critical: 0, High: 0, Medium: 0, Low: 0 };
  const categories: Record<string, number> = {};
  const roleCounts: Record<RoleName, number> = { onboarding: 0, compliance: 0, approver: 0, auditor: 0, admin: 0 };

  for (const b of allBugs) {
    severities[b.severity] = (severities[b.severity] || 0) + 1;
    categories[b.category] = (categories[b.category] || 0) + 1;
    if (b.role) roleCounts[b.role] = (roleCounts[b.role] || 0) + 1;
  }

  const runId = `RUN-${Date.now()}`;
  const summary: AgentRunSummary = {
    runId,
    startTime,
    endTime: new Date().toISOString(),
    durationMs: Date.now() - startMs,
    targetUrl: config.baseURL,
    rolesExplored: rolesToRun,
    totalPagesVisited: explorations.reduce((a, e) => a + e.pagesVisited, 0),
    totalFormsFound: explorations.reduce((a, e) => a + e.formsFound, 0),
    totalFormsFuzzed: explorations.reduce((a, e) => a + e.formsFuzzed, 0),
    totalApisDiscovered: explorations.reduce((a, e) => a + e.apisDiscovered, 0),
    totalBugsFound: allBugs.length,
    newBugsCount: diff.newBugs.length,
    fixedBugsCount: diff.fixedBugs.length,
    bugsBySeverity: severities,
    bugsByCategory: categories,
    bugsByRole: roleCounts,
    bugs: allBugs,
    explorations,
    diff,
  };

  // Generate Reports
  const reportGen = new BugReportGenerator(config.history.outputDir);
  const jsonReportPath = await reportGen.generateJSON(summary);
  const mdReportPath = await reportGen.generateMarkdown(summary);

  const htmlGen = new HtmlReporter(config.history.outputDir);
  const htmlReportPath = await htmlGen.generateHTML(summary);

  // Archive run for next run's diffing
  differ.archiveRun(summary);

  // Send notifications if configured
  if (config.features.notifications && config.notifications?.webhookUrl) {
    await WebhookNotifier.sendNotification(summary, config.notifications.webhookUrl);
  }

  // Print console finish summary
  const durationSec = Math.round((Date.now() - startMs) / 1000);
  console.log('\n============================================================');
  console.log('🎉 MuseQA Exploration & Bug-Hunting Complete!');
  console.log('============================================================');
  console.log(`⏱️  Duration          : ${Math.floor(durationSec / 60)}m ${durationSec % 60}s`);
  console.log(`🌐 Total Pages Visited: ${summary.totalPagesVisited}`);
  console.log(`🐛 Total Bugs Found   : ${summary.totalBugsFound}`);
  console.log(`   🔴 Critical        : ${severities.Critical}`);
  console.log(`   🟠 High            : ${severities.High}`);
  console.log(`   🟡 Medium          : ${severities.Medium}`);
  console.log(`   ⚪ Low             : ${severities.Low}`);
  console.log(`🆕 New Issues         : ${diff.newBugs.length}`);
  console.log(`✅ Potentially Fixed  : ${diff.fixedBugs.length}`);
  console.log('------------------------------------------------------------');
  console.log(`📄 JSON Report        : ${jsonReportPath}`);
  console.log(`📝 Markdown Report    : ${mdReportPath}`);
  console.log(`📊 HTML Dashboard     : ${htmlReportPath}`);
  console.log('============================================================\n');

  // Exit code 1 if Critical bugs found (for CI gate)
  if (severities.Critical > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch(err => {
  console.error('💥 Fatal Agent Runner Error:', err);
  process.exit(1);
});
