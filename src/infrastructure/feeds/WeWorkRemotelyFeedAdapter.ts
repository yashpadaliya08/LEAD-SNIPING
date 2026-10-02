import { IJobFeedSource } from "../../application/ports/IJobFeedSource.js";
import { JobLead } from "../../domain/models/JobLead.js";

export class WeWorkRemotelyFeedAdapter implements IJobFeedSource {
  public readonly platformName = "weworkremotely";
  private readonly feedUrl =
    "https://weworkremotely.com/categories/remote-programming-jobs.rss";
  private readonly userAgent =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

  public async pollNewJobs(): Promise<JobLead[]> {
    const leads: JobLead[] = [];

    try {
      const res = await fetch(this.feedUrl, {
        headers: { "User-Agent": this.userAgent }
      });

      if (!res.ok) {
        console.warn(`[WWRAdapter] Failed to fetch RSS feed (${res.status})`);
        return leads;
      }

      const xmlText = await res.text();
      const items = xmlText.split("<item>");

      // Process up to 50 latest items
      for (let i = 1; i < Math.min(items.length, 50); i++) {
        const itemChunk = items[i];
        if (!itemChunk) continue;

        const titleMatch = itemChunk.match(/<title>([\s\S]*?)<\/title>/);
        const linkMatch = itemChunk.match(/<link>([\s\S]*?)<\/link>/);
        const descMatch = itemChunk.match(/<description>([\s\S]*?)<\/description>/);
        const pubDateMatch = itemChunk.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
        const guidMatch = itemChunk.match(/<guid[^>]*>([\s\S]*?)<\/guid>/);

        const rawTitle = titleMatch ? titleMatch[1]?.trim() ?? "" : "";
        const rawLink = linkMatch ? linkMatch[1]?.trim() ?? "" : "";
        const rawDesc = descMatch ? descMatch[1]?.trim() ?? "" : "";
        const rawGuid = guidMatch ? guidMatch[1]?.trim() ?? rawLink : rawLink;

        if (!rawTitle || !rawLink) continue;

        // Clean CDATA and entities
        const cleanTitle = this.cleanCdata(rawTitle);
        const cleanDesc = this.stripHtmlTags(this.cleanCdata(rawDesc));

        // Extract company and role
        const titleParts = cleanTitle.split(":");
        const companyName = titleParts.length > 1 ? titleParts[0]?.trim() : undefined;
        const jobTitle = titleParts.length > 1 ? titleParts.slice(1).join(":").trim() : cleanTitle;

        leads.push({
          id: `wwr:${rawGuid}`,
          platform: "weworkremotely",
          externalId: rawGuid,
          url: cleanLink(rawLink),
          title: jobTitle,
          description: cleanDesc.slice(0, 1500),
          budgetType: "fixed",
          budgetAmount: 1000, // High-budget standard on WWR
          currency: "USD",
          skills: this.extractSkills(`${jobTitle} ${cleanDesc}`),
          client: {
            name: companyName,
            isPaymentVerified: true
          },
          postedAt: pubDateMatch && pubDateMatch[1] ? new Date(pubDateMatch[1]) : new Date()
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[WWRAdapter] Error polling feed: ${message}`);
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

  private extractSkills(text: string): string[] {
    const known = [
      "next.js",
      "react",
      "node",
      "typescript",
      "javascript",
      "python",
      "fastapi",
      "scraping",
      "automation",
      "ai",
      "llm",
      "supabase",
      "tailwind"
    ];
    const found: string[] = [];
    const lower = text.toLowerCase();
    for (const k of known) {
      if (lower.includes(k)) found.push(k);
    }
    return found;
  }
}

function cleanLink(link: string): string {
  return link.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim();
}
