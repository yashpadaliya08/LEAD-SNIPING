import { IJobFeedSource } from "../../application/ports/IJobFeedSource.js";
import { JobLead } from "../../domain/models/JobLead.js";

interface RemotiveJob {
  id?: number | string;
  url?: string;
  title?: string;
  company_name?: string;
  category?: string;
  tags?: string[];
  job_type?: string;
  publication_date?: string;
  candidate_required_location?: string;
  salary?: string;
  description?: string;
}

interface RemotiveApiResponse {
  jobs?: RemotiveJob[];
}

export class RemotiveFeedAdapter implements IJobFeedSource {
  public readonly platformName = "remotive";
  private readonly apiUrl = "https://remotive.com/api/remote-jobs?category=software-dev&limit=100";

  public async pollNewJobs(): Promise<JobLead[]> {
    const leads: JobLead[] = [];

    try {
      const res = await fetch(this.apiUrl, {
        headers: {
          Accept: "application/json"
        }
      });

      if (!res.ok) {
        console.warn(`[RemotiveAdapter] API returned HTTP ${res.status}`);
        return leads;
      }

      const data = (await res.json()) as RemotiveApiResponse;
      const jobs = data.jobs || [];

      for (const item of jobs) {
        const lead = this.mapJobToLead(item);
        if (lead) {
          leads.push(lead);
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[RemotiveAdapter] Poll failed: ${message}`);
    }

    return leads;
  }

  private mapJobToLead(item: RemotiveJob): JobLead | null {
    if (!item.id || !item.title) return null;

    const idStr = String(item.id);
    const title = item.title.trim();
    const rawDesc = item.description || "";
    const cleanDesc = this.stripHtmlTags(rawDesc);
    const tags = Array.isArray(item.tags) ? item.tags : [];

    const budgetInfo = this.extractSalary(item.salary || "");

    return {
      id: `remotive:${idStr}`,
      platform: "remotive",
      externalId: idStr,
      url: item.url || `https://remotive.com/remote-jobs/${idStr}`,
      title,
      description: cleanDesc.slice(0, 2000) || title,
      budgetType: budgetInfo.type,
      budgetAmount: budgetInfo.amount,
      currency: "USD",
      skills: this.extractSkills(`${title} ${tags.join(" ")} ${cleanDesc}`),
      client: {
        name: item.company_name,
        country: item.candidate_required_location || undefined,
        isPaymentVerified: true
      },
      postedAt: item.publication_date ? new Date(item.publication_date) : new Date(),
      rawPayload: {
        category: item.category,
        jobType: item.job_type,
        tags
      }
    };
  }

  private extractSalary(salaryStr: string): { type: "hourly" | "fixed" | "unknown"; amount?: number } {
    if (!salaryStr) {
      return { type: "fixed", amount: 1000 }; // Standard baseline for high-budget remote tech contract
    }

    // Check hourly: e.g. "$40 - $60 / hour"
    const hourlyRegex = /\$(\d{2,3})/i;
    if (salaryStr.toLowerCase().includes("hour") || salaryStr.toLowerCase().includes("/hr")) {
      const match = salaryStr.match(hourlyRegex);
      if (match && match[1]) {
        return { type: "hourly", amount: parseInt(match[1], 10) };
      }
    }

    // Check annual/fixed: e.g. "$80k", "$80,000"
    const numRegex = /\$(\d{2,3})(?:,\d{3}|k)/i;
    const match = salaryStr.match(numRegex);
    if (match && match[1]) {
      const base = parseInt(match[1], 10);
      return { type: "fixed", amount: base >= 1000 ? base : base * 1000 };
    }

    return { type: "fixed", amount: 1000 };
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
