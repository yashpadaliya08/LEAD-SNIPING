import { IJobFeedSource } from "../../application/ports/IJobFeedSource.js";
import { JobLead } from "../../domain/models/JobLead.js";

export class FreelancerFeedAdapter implements IJobFeedSource {
  public readonly platformName = "freelancer";
  private readonly feedUrl = "https://www.freelancer.com/rss.xml";
  private readonly userAgent =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

  public async pollNewJobs(): Promise<JobLead[]> {
    const leads: JobLead[] = [];

    try {
      const res = await fetch(this.feedUrl, {
        headers: {
          "User-Agent": this.userAgent,
          Accept: "application/rss+xml, application/xml, text/xml, */*"
        }
      });

      if (!res.ok) {
        console.warn(`[FreelancerAdapter] Feed returned HTTP ${res.status}`);
        return leads;
      }

      const xmlText = await res.text();
      const items = xmlText.split("<item>");

      // Process up to 40 latest projects
      for (let i = 1; i < Math.min(items.length, 41); i++) {
        const chunk = items[i];
        if (!chunk) continue;

        const titleMatch = chunk.match(/<title>([\s\S]*?)<\/title>/);
        const linkMatch = chunk.match(/<link>([\s\S]*?)<\/link>/);
        const descMatch = chunk.match(/<description>([\s\S]*?)<\/description>/);
        const pubDateMatch = chunk.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
        const guidMatch = chunk.match(/<guid[^>]*>([\s\S]*?)<\/guid>/);

        const rawTitle = titleMatch ? titleMatch[1]?.trim() ?? "" : "";
        const rawLink = linkMatch ? linkMatch[1]?.trim() ?? "" : "";
        const rawDesc = descMatch ? descMatch[1]?.trim() ?? "" : "";
        const rawGuid = guidMatch ? guidMatch[1]?.trim() ?? rawLink : rawLink;

        if (!rawTitle || !rawLink) continue;

        const cleanTitle = this.cleanCdata(rawTitle);
        const cleanDesc = this.cleanCdata(rawDesc);
        const cleanId = this.cleanCdata(rawGuid);

        const budgetInfo = this.extractBudget(cleanDesc);

        leads.push({
          id: `freelancer:${cleanId}`,
          platform: "freelancer",
          externalId: cleanId,
          url: cleanLink(rawLink),
          title: cleanTitle,
          description: this.stripHtmlTags(cleanDesc).slice(0, 1800) || cleanTitle,
          budgetType: budgetInfo.type,
          budgetAmount: budgetInfo.amount,
          currency: budgetInfo.currency,
          skills: this.extractSkills(`${cleanTitle} ${cleanDesc}`),
          client: {
            isPaymentVerified: true
          },
          postedAt: pubDateMatch && pubDateMatch[1] ? new Date(pubDateMatch[1]) : new Date()
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[FreelancerAdapter] Error polling feed: ${message}`);
    }

    return leads;
  }

  private cleanCdata(str: string): string {
    return str.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
  }

  private stripHtmlTags(str: string): string {
    return str
      .replace(/<[^>]*>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, " ")
      .trim();
  }

  private extractBudget(text: string): { type: "hourly" | "fixed" | "unknown"; amount?: number; currency: string } {
    // Check e.g.: "(Budget: $250 - $750 USD, Jobs: ...)"
    const fixedMatch = text.match(/Budget:\s*([$€£₹]?)\s*(\d{1,6})\s*-\s*([$€£₹]?)\s*(\d{1,6})\s*([A-Z]{3})?/i);
    if (fixedMatch) {
      const maxAmount = parseInt(fixedMatch[4] || fixedMatch[2] || "0", 10);
      const currency = fixedMatch[5] || "USD";
      return { type: "fixed", amount: maxAmount, currency };
    }

    // Hourly e.g.: "$15 - $25 USD / hr"
    const hourlyMatch = text.match(/\$(\d{1,4})(?:\s*-\s*\$?\d{1,4})?\s*(?:\/|\s+per\s+)(?:hr|hour)/i);
    if (hourlyMatch && hourlyMatch[1]) {
      return { type: "hourly", amount: parseInt(hourlyMatch[1], 10), currency: "USD" };
    }

    return { type: "fixed", amount: 250, currency: "USD" };
  }

  private extractSkills(text: string): string[] {
    const known = [
      "next.js",
      "nextjs",
      "react",
      "reactjs",
      "node",
      "nodejs",
      "typescript",
      "javascript",
      "python",
      "fastapi",
      "flask",
      "django",
      "scraping",
      "scraper",
      "crawler",
      "automation",
      "bot",
      "ai",
      "llm",
      "openai",
      "claude",
      "supabase",
      "firebase",
      "tailwind",
      "fullstack",
      "frontend",
      "backend",
      "api"
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
}

function cleanLink(link: string): string {
  return link.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
}
