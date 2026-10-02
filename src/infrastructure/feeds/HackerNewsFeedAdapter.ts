import { IJobFeedSource } from "../../application/ports/IJobFeedSource.js";
import { JobLead } from "../../domain/models/JobLead.js";

interface HnItem {
  id: number;
  title?: string;
  url?: string;
  text?: string;
  time?: number;
}

export class HackerNewsFeedAdapter implements IJobFeedSource {
  public readonly platformName = "hackernews";

  public async pollNewJobs(): Promise<JobLead[]> {
    const leads: JobLead[] = [];

    try {
      const res = await fetch("https://hacker-news.firebaseio.com/v0/jobstories.json");
      if (!res.ok) return leads;

      const storyIds = (await res.json()) as number[];
      // Check latest 20 job stories
      const targetIds = storyIds.slice(0, 20);

      for (const id of targetIds) {
        try {
          const itemRes = await fetch(
            `https://hacker-news.firebaseio.com/v0/item/${id}.json`
          );
          if (!itemRes.ok) continue;

          const item = (await itemRes.json()) as HnItem;
          if (!item || !item.title) continue;

          const lead = this.mapHnItem(item);
          if (lead) leads.push(lead);
        } catch {
          // ignore single item failure
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[HNAdapter] Failed to poll HN job stories: ${message}`);
    }

    return leads;
  }

  private mapHnItem(item: HnItem): JobLead | null {
    const title = item.title?.trim() ?? "";
    const description = item.text ? this.stripHtmlTags(item.text) : title;
    const url = item.url || `https://news.ycombinator.com/item?id=${item.id}`;

    return {
      id: `hn:${item.id}`,
      platform: "hackernews",
      externalId: String(item.id),
      url,
      title,
      description,
      budgetType: "fixed",
      budgetAmount: 1200, // Standard tech/startup contract
      currency: "USD",
      skills: this.extractSkills(`${title} ${description}`),
      client: {
        isPaymentVerified: true
      },
      postedAt: item.time ? new Date(item.time * 1000) : new Date()
    };
  }

  private stripHtmlTags(str: string): string {
    return str.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  }

  private extractSkills(text: string): string[] {
    const known = [
      "react",
      "next.js",
      "node",
      "typescript",
      "javascript",
      "python",
      "fastapi",
      "scraping",
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
