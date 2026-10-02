export type PlatformSource = "reddit" | "upwork" | "hackernews" | "remoteok" | "remotive" | "weworkremotely" | "freelancer";

export interface ClientProfile {
  name?: string;
  country?: string;
  rating?: number;
  totalSpent?: number;
  hireRatePercentage?: number;
  feedbackReviewsCount?: number;
  isPaymentVerified: boolean;
}

export interface JobLead {
  id: string; // Globally unique ID, e.g. "reddit:1gq9z2" or "upwork:~01abc"
  platform: PlatformSource;
  externalId: string;
  url: string;
  title: string;
  description: string;
  budgetType: "fixed" | "hourly" | "unknown";
  budgetAmount?: number;
  currency: string;
  skills: string[];
  client: ClientProfile;
  postedAt: Date;
  rawPayload?: Record<string, unknown>;
}
