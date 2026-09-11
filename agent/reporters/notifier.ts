import { AgentRunSummary } from '../types';

export class WebhookNotifier {
  static async sendNotification(summary: AgentRunSummary, webhookUrl?: string): Promise<boolean> {
    const url = webhookUrl || process.env.MUSEQA_WEBHOOK_URL;
    if (!url) {
      return false;
    }

    const durationSec = Math.round(summary.durationMs / 1000);
    const mins = Math.floor(durationSec / 60);
    const secs = durationSec % 60;

    const isSlack = url.includes('slack.com');

    try {
      const payload = isSlack
        ? {
            text: `🤖 *MuseQA Autonomous Agent Report*\n` +
                  `Target: \`${summary.targetUrl}\` | Duration: ${mins}m ${secs}s\n` +
                  `*Total Bugs Found:* ${summary.totalBugsFound} (🔴 Crit: ${summary.bugsBySeverity.Critical || 0} | 🟠 High: ${summary.bugsBySeverity.High || 0} | 🟡 Med: ${summary.bugsBySeverity.Medium || 0})\n` +
                  `*New Since Last Run:* ${summary.newBugsCount} | *Resolved:* ${summary.fixedBugsCount}`,
          }
        : {
            title: 'MuseQA Autonomous Agent Report',
            text: `Target: ${summary.targetUrl} | Bugs: ${summary.totalBugsFound} | Critical: ${summary.bugsBySeverity.Critical || 0}`,
          };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      return res.ok;
    } catch (e) {
      console.warn('⚠️ Webhook notification delivery failed:', e);
      return false;
    }
  }
}
