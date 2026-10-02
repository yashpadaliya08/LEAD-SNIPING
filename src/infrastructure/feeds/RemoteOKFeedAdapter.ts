import { IJobFeedSource } from "../../application/ports/IJobFeedSource.js";
import { JobLead } from "../../domain/models/JobLead.js";

interface RemoteOkJob {
  id?: string | number;
  position?: string;
  company?: string;
  url?: string;
  apply_url?: string;
  tags?: string[];
  description?: string;
  salary_min?: number;
  salary_max?: number;
  date?: string;
}

export class RemoteOKFeedAdapter implements IJobFeedSource {
  public readonly platformName = "remoteok";
  private readonly apiUrl = "https://remoteok.com/api";
  private readonly userAgent =
    "LeadSniperBot/1.0 (Developer freelance alert bot; contact: dev@leadsniper.local)";

  public async pollNewJobs(): Promise<JobLead[]> {
    const leads: JobLead[] = [];

    try {
      const res = await fetch(this.apiUrl, {
        headers: {
          "User-Agent": this.userAgent,
          Accept: "application/json"
        }
      });

      if (!res.ok) {
        console.warn(`[RemoteOKAdapter] API returned HTTP ${res.status}`);
        return leads;
      }

      const data = (await res.json()) as unknown;
      if (!Array.isArray(data)) {
        return leads;
      }

      // Skip non-job metadata header and take the newest 30 jobs
      const jobs = data.filter(
        (item): item is RemoteOkJob =>
          item !== null &&
          typeof item === "object" &&
          "position" in item &&
          typeof item.position === "string"
      );

      for (const item of jobs.slice(0, 100)) {
        const lead = this.mapJobToLead(item);
        if (lead) {
          leads.push(lead);
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[RemoteOKAdapter] Poll failed: ${message}`);
    }

    return leads;
  }

  private mapJobToLead(item: RemoteOkJob): JobLead | null {
    if (!item.id || !item.position) return null;

    const idStr = String(item.id);
    const title = item.position.trim();
    const rawDesc = item.description || "";
    const cleanDesc = this.stripHtmlTags(rawDesc);
    const tags = Array.isArray(item.tags) ? item.tags : [];

    const jobUrl = item.url
      ? item.url.startsWith("http")
        ? item.url
        : `https://remoteok.com${item.url}`
      : item.apply_url || `https://remoteok.com/remote-jobs/${idStr}`;

    const salary =
      item.salary_max && item.salary_max > 0
        ? item.salary_max
        : item.salary_min && item.salary_min > 0
          ? item.salary_min
          : 800; // Default competitive baseline for remote contracts

    return {
      id: `remoteok:${idStr}`,
      platform: "remoteok",
      externalId: idStr,
      url: jobUrl,
      title,
      description: cleanDesc.slice(0, 2000) || title,
      budgetType: "fixed",
      budgetAmount: salary,
      currency: "USD",
      skills: this.extractSkills(`${title} ${tags.join(" ")} ${cleanDesc}`),
      client: {
        name: item.company,
        isPaymentVerified: true
      },
      postedAt: item.date ? new Date(item.date) : new Date(),
      rawPayload: {
        tags,
        company: item.company
      }
    };
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
      "automation",
      "ai",
      "llm",
      "openai",
      "claude",
      "supabase",
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
