import { IJobFeedSource } from "../../application/ports/IJobFeedSource.js";
import { JobLead } from "../../domain/models/JobLead.js";

interface UpworkJobItem {
  ciphertext?: string;
  title?: string;
  snippet?: string;
  amount?: {
    amount?: number;
    currencyCode?: string;
  };
  hourlyBudget?: {
    min?: number;
    max?: number;
  };
  client?: {
    country?: string;
    totalSpent?: number;
    feedbackCount?: number;
    score?: number;
    paymentVerificationStatus?: number;
  };
  publishedOn?: string;
  skills?: Array<{ prettyName: string }>;
}

export class UpworkFeedAdapter implements IJobFeedSource {
  public readonly platformName = "upwork";
  private queuedLeads: JobLead[] = [];

  /**
   * Receives leads pushed directly by the Local Browser Extension Bridge
   */
  public pushFromExtension(leads: JobLead[]): void {
    this.queuedLeads.push(...leads);
  }

  public async pollNewJobs(): Promise<JobLead[]> {
    const leads: JobLead[] = [...this.queuedLeads];
    this.queuedLeads = [];

    try {
      // Query Upwork public search endpoint with desktop browser headers
      const searchTerms = encodeURIComponent("Next.js OR React OR Python OR Scraping OR Automation OR AI");
      const url = `https://www.upwork.com/ab/jobs/search/url?q=${searchTerms}&sort=recency&page=1&per_page=10`;

      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
          Accept: "application/json, text/plain, */*",
          "Accept-Language": "en-US,en;q=0.9"
        }
      });

      if (res.ok) {
        const data = (await res.json()) as { jobs?: UpworkJobItem[] };
        if (data.jobs && Array.isArray(data.jobs)) {
          for (const item of data.jobs) {
            const lead = this.mapUpworkJob(item);
            if (lead) leads.push(lead);
          }
        }
      }
    } catch (err: unknown) {
      // Upwork may challenge with Cloudflare Turnstile if direct; the Browser Extension Bridge handles this transparently
      const message = err instanceof Error ? err.message : String(err);
      console.debug(`[UpworkAdapter] Direct poll skipped (${message}), relying on Extension Bridge.`);
    }

    return leads;
  }

  private mapUpworkJob(item: UpworkJobItem): JobLead | null {
    if (!item.ciphertext || !item.title) return null;

    const isHourly = !!item.hourlyBudget?.max || !!item.hourlyBudget?.min;
    const amount = isHourly
      ? item.hourlyBudget?.max || item.hourlyBudget?.min
      : item.amount?.amount;

    return {
      id: `upwork:${item.ciphertext}`,
      platform: "upwork",
      externalId: item.ciphertext,
      url: `https://www.upwork.com/jobs/${item.ciphertext}`,
      title: item.title,
      description: item.snippet || item.title,
      budgetType: isHourly ? "hourly" : amount ? "fixed" : "unknown",
      budgetAmount: amount,
      currency: item.amount?.currencyCode || "USD",
      skills: item.skills ? item.skills.map((s) => s.prettyName) : [],
      client: {
        country: item.client?.country,
        rating: item.client?.score,
        totalSpent: item.client?.totalSpent,
        feedbackReviewsCount: item.client?.feedbackCount,
        isPaymentVerified: item.client?.paymentVerificationStatus === 1
      },
      postedAt: item.publishedOn ? new Date(item.publishedOn) : new Date()
    };
  }
}
