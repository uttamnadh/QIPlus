import type { Reporter, TestCase, TestResult, FullResult, TestError } from '@playwright/test/reporter';

let forceClosedPrinted = false;

function printForceClosed(reason: string) {
  if (forceClosedPrinted) return;
  forceClosedPrinted = true;
  console.log('\n============================================================');
  console.log(`🚨 [FORCE CLOSED] ${reason}`);
  console.log('============================================================\n');
}

// Global process signal handlers
process.on('SIGINT', () => {
  printForceClosed('Execution was FORCE CLOSED by user (Ctrl+C / Interrupted)!');
});

process.on('SIGTERM', () => {
  printForceClosed('Execution was FORCE CLOSED (Process Terminated)!');
});

export default class ForceCloseReporter implements Reporter {
  onError(error: TestError): void {
    const msg = error.message || error.value || '';
    if (msg.match(/Target.*closed|browser.*closed|has been closed|TargetClosedError/i)) {
      printForceClosed('Browser window was closed while test was running!');
    }
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    if (result.status === 'interrupted') {
      printForceClosed('Test was interrupted / force closed by user!');
      return;
    }
    for (const error of result.errors) {
      const msg = error.message || error.value || '';
      if (msg.match(/Target.*closed|browser.*closed|has been closed|TargetClosedError/i)) {
        printForceClosed('Browser window was closed while test was running!');
        break;
      }
    }
  }

  onEnd(result: FullResult): void {
    if (result.status === 'interrupted') {
      printForceClosed('Test execution was FORCE CLOSED by user!');
    }
  }
}
