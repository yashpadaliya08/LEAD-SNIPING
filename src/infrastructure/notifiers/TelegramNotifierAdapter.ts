import { INotificationGateway } from "../../application/ports/INotificationGateway.js";
import { JobLead } from "../../domain/models/JobLead.js";
import { PitchDraft } from "../../domain/models/PitchDraft.js";

export class TelegramNotifierAdapter implements INotificationGateway {
  private alertTimestamps: number[] = [];

  constructor(
    private readonly botToken: string,
    private readonly chatId: string,
    private readonly maxAlertsPerHour: number = 10
  ) {}

  public async dispatchAlert(lead: JobLead, pitch: PitchDraft): Promise<boolean> {
    // 1. Sliding window rate limit check (Max N alerts per 60 minutes)
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    this.alertTimestamps = this.alertTimestamps.filter((t) => t > oneHourAgo);

    if (this.alertTimestamps.length >= this.maxAlertsPerHour) {
      console.warn(
        `⏳ [TelegramRateLimiter] Hourly cap reached (${this.alertTimestamps.length}/${this.maxAlertsPerHour}). Skipping lead "${lead.title.slice(0, 40)}..." to prevent notification clutter.`
      );
      return false;
    }

    const messageHtml = this.formatAlertMessage(lead, pitch);

    const inlineKeyboard = {
      inline_keyboard: [
        [
          {
            text: "🌐 Open Job Listing",
            url: lead.url
          }
        ]
      ]
    };

    const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: this.chatId,
        text: messageHtml,
        parse_mode: "HTML",
        disable_web_page_preview: false,
        reply_markup: inlineKeyboard
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[TelegramNotifier] Send failed (${response.status}):`, errorText);
      return false;
    }

    // Record successful dispatch timestamp
    this.alertTimestamps.push(Date.now());
    console.log(
      `🔔 [TelegramNotifier] Alert delivered. (Hourly rate: ${this.alertTimestamps.length}/${this.maxAlertsPerHour})`
    );

    return true;
  }

  private formatAlertMessage(lead: JobLead, pitch: PitchDraft): string {
    const platformBadge =
      lead.platform === "reddit"
        ? "🔴 <b>REDDIT LEAD</b>"
        : lead.platform === "upwork"
          ? "🟢 <b>UPWORK LEAD</b>"
          : `🔵 <b>${lead.platform.toUpperCase()} LEAD</b>`;

    const budgetDisplay =
      lead.budgetType === "hourly"
        ? `$${lead.budgetAmount || "TBD"}/hr`
        : lead.budgetType === "fixed"
          ? `$${lead.budgetAmount || "TBD"} (Fixed)`
          : "Not specified";

    const clientDisplay = lead.client.name
      ? `👤 ${this.escapeHtml(lead.client.name)}`
      : lead.client.country
        ? `🌍 ${this.escapeHtml(lead.client.country)}`
        : "👤 Anonymous Client";

    const easterEggAlert = pitch.detectedEasterEgg
      ? `\n⚠️ <b>Easter Egg Detected:</b> <code>${this.escapeHtml(pitch.detectedEasterEgg)}</code>\n`
      : "";

    const screeningSection =
      pitch.screeningAnswers.length > 0
        ? `\n❓ <b>Screening Q&A:</b>\n` +
          pitch.screeningAnswers
            .map(
              (qa) =>
                `• <i>${this.escapeHtml(qa.question)}</i>\n  ↳ <code>${this.escapeHtml(qa.answer)}</code>`
            )
            .join("\n") +
          "\n"
        : "";

    return `
⚡ ${platformBadge} — <b>Match: ${pitch.matchScore}%</b>
━━━━━━━━━━━━━━━━━━━━
📌 <b>${this.escapeHtml(lead.title)}</b>
💰 <b>Budget:</b> ${budgetDisplay} | ${clientDisplay}
⏱ <b>Posted:</b> ${lead.postedAt.toLocaleTimeString()}
${easterEggAlert}
🎯 <b>WINNING HOOK (First 2 Lines):</b>
<code>${this.escapeHtml(pitch.winningHook)}</code>

📝 <b>FULL CONSULTATIVE PITCH:</b>
<blockquote>${this.escapeHtml(pitch.fullPitchText)}</blockquote>
${screeningSection}
━━━━━━━━━━━━━━━━━━━━
💡 <i>Tip: Tap the text block to copy, review in 10 seconds, then submit!</i>
`.trim();
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
}
