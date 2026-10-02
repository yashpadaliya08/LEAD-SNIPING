import { IJobFeedSource } from "../../application/ports/IJobFeedSource.js";
import { JobLead } from "../../domain/models/JobLead.js";

interface ParsedAtomEntry {
  id: string;
  title: string;
  author: string;
  link: string;
  content: string;
  published: Date;
}

export class RedditJobFeedAdapter implements IJobFeedSource {
  public readonly platformName = "reddit";
  private readonly subreddits = [
    "forhire",
    "freelance_forhire",
    "Jobbit",
    "hiring",
    "RemoteJobs",
    "devsforhire",
    "INAT"
  ];
  private readonly userAgent =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";
  private circuitBreakerUntil = 0;

  public async pollNewJobs(): Promise<JobLead[]> {
    const leads: JobLead[] = [];

    // If Reddit has rate limited us, wait out the cooldown before retrying
    if (Date.now() < this.circuitBreakerUntil) {
      return leads;
    }

    for (const sub of this.subreddits) {
      try {
        const url = `https://www.reddit.com/r/${sub}/new/.rss`;
        const res = await fetch(url, {
          headers: {
            "User-Agent": this.userAgent,
            Accept: "application/atom+xml,application/xml,text/xml;q=0.9,*/*;q=0.8"
          }
        });

        if (!res.ok) {
          if (res.status === 429 || res.status === 403) {
            this.circuitBreakerUntil = Date.now() + 15 * 60 * 1000;
            console.warn(
              `[RedditAdapter] Rate limit (${res.status}) on r/${sub}. Pausing Reddit adapter for 15 minutes to let quota reset.`
            );
            break; // Stop immediately to prevent burning further IP reputation
          }
          continue;
        }

        const xmlText = await res.text();
        const entries = this.parseAtomFeed(xmlText);

        for (const entry of entries) {
          const lead = this.mapEntryToJobLead(sub, entry);
          if (lead) {
            leads.push(lead);
          }
        }

        // Polite delay between subreddit requests to respect Reddit's burst rate limits
        await new Promise((resolve) => setTimeout(resolve, 800));
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`[RedditAdapter] Failed to poll r/${sub}: ${message}`);
      }
    }

    return leads;
  }

  private parseAtomFeed(xml: string): ParsedAtomEntry[] {
    const entries: ParsedAtomEntry[] = [];
    const parts = xml.split("<entry>");

    for (let i = 1; i < parts.length; i++) {
      const part = parts[i];
      if (!part) continue;
      const chunk = part.split("</entry>")[0];
      if (!chunk) continue;

      const idMatch = chunk.match(/<id>([\s\S]*?)<\/id>/);
      const titleMatch = chunk.match(/<title>([\s\S]*?)<\/title>/);
      const linkMatch = chunk.match(/<link\s+href="([^"]+)"/);
      const authorMatch = chunk.match(/<author>[\s\S]*?<name>([\s\S]*?)<\/name>/);
      const contentMatch = chunk.match(/<content type="html">([\s\S]*?)<\/content>/);
      const updatedMatch = chunk.match(/<updated>([\s\S]*?)<\/updated>/);

      const rawTitle = titleMatch ? titleMatch[1] ?? "" : "";
      const rawAuthor = authorMatch ? authorMatch[1] ?? "" : "";
      const rawLink = linkMatch ? linkMatch[1] ?? "" : "";
      const rawContent = contentMatch ? contentMatch[1] ?? "" : "";
      const rawId = idMatch ? idMatch[1] ?? "" : rawLink;

      entries.push({
        id: this.cleanHtmlEntities(rawId),
        title: this.cleanHtmlEntities(rawTitle),
        author: this.cleanHtmlEntities(rawAuthor).replace(/^\/u\//, ""),
        link: this.cleanHtmlEntities(rawLink),
        content: this.cleanHtmlEntities(rawContent),
        published: updatedMatch && updatedMatch[1] ? new Date(updatedMatch[1]) : new Date()
      });
    }

    return entries;
  }

  private mapEntryToJobLead(subreddit: string, entry: ParsedAtomEntry): JobLead | null {
    const title = entry.title.trim();
    const lowerTitle = title.toLowerCase();

    // Disqualify freelancers advertising themselves
    const isForHire =
      lowerTitle.startsWith("[for hire]") ||
      lowerTitle.includes("[for hire]") ||
      lowerTitle.includes("[forhire]") ||
      lowerTitle.includes("for hire") ||
      lowerTitle.startsWith("for hire");

    if (isForHire) {
      return null;
    }

    // Must be a hiring post
    const isHiring =
      lowerTitle.startsWith("[hiring]") ||
      lowerTitle.includes("[hiring]") ||
      lowerTitle.includes("hiring:") ||
      lowerTitle.includes("[hiring") ||
      lowerTitle.includes("looking for") ||
      lowerTitle.includes("need a developer") ||
      lowerTitle.includes("need developer") ||
      lowerTitle.includes("seeking developer") ||
      lowerTitle.includes("job opening");

    if (!isHiring) {
      return null;
    }

    const budgetInfo = this.extractBudget(`${title}\n${entry.content}`);

    return {
      id: `reddit:${entry.id}`,
      platform: "reddit",
      externalId: entry.id,
      url: entry.link,
      title,
      description: this.stripHtmlTags(entry.content) || title,
      budgetType: budgetInfo.type,
      budgetAmount: budgetInfo.amount,
      currency: "USD",
      skills: this.extractSkills(`${title} ${entry.content}`),
      client: {
        name: entry.author,
        isPaymentVerified: true
      },
      postedAt: entry.published,
      rawPayload: {
        subreddit,
        author: entry.author,
        link: entry.link
      }
    };
  }

  private extractBudget(text: string): { type: "hourly" | "fixed" | "unknown"; amount?: number } {
    // Check hourly: e.g. "$50/hr", "$50 / hour", "$30-50/hr"
    const hourlyRegex = /\$(\d{1,4})(?:\s*-\s*\$?\d{1,4})?\s*(?:\/|\s+per\s+)(?:hr|hour)/i;
    const hourlyMatch = text.match(hourlyRegex);
    if (hourlyMatch && hourlyMatch[1]) {
      return { type: "hourly", amount: parseInt(hourlyMatch[1], 10) };
    }

    // Check fixed: e.g. "$500", "[$1,000]", "Budget: $200"
    const fixedRegex = /(?:budget|pay|paying|fixed)?\s*\$(\d{1,3}(?:,\d{3})*|\d+)/i;
    const fixedMatch = text.match(fixedRegex);
    if (fixedMatch && fixedMatch[1]) {
      const cleanNumber = fixedMatch[1].replace(/,/g, "");
      const num = parseInt(cleanNumber, 10);
      if (num > 10) {
        return { type: "fixed", amount: num };
      }
    }

    return { type: "unknown" };
  }

  private extractSkills(text: string): string[] {
    const known = [
      "react",
      "next.js",
      "vue",
      "node",
      "typescript",
      "javascript",
      "python",
      "fastapi",
      "flask",
      "django",
      "scraping",
      "scraper",
      "ai",
      "llm",
      "openai",
      "claude",
      "tailwind",
      "supabase",
      "postgres",
      "mongodb",
      "docker",
      "stripe"
    ];
    const found: string[] = [];
    const lower = text.toLowerCase();
    for (const k of known) {
      if (lower.includes(k)) {
        found.push(k);
      }
    }
    return found;
  }

  private cleanHtmlEntities(str: string): string {
    return str
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  }

  private stripHtmlTags(str: string): string {
    return str.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  }
}
