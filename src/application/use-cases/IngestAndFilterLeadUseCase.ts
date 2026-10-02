import { JobLead } from "../../domain/models/JobLead.js";
import { FilterCriteria } from "../../domain/models/FilterCriteria.js";
import { IDeduplicationStore } from "../ports/IDeduplicationStore.js";
import { DuplicateJobError, JobDisqualifiedError } from "../../domain/errors/DomainErrors.js";

export interface FilterResult {
  isQualified: boolean;
  matchScore: number;
  reason: string;
}

export class IngestAndFilterLeadUseCase {
  constructor(
    private readonly deduplicationStore: IDeduplicationStore,
    private readonly filterCriteria: FilterCriteria
  ) {}

  public async evaluate(lead: JobLead): Promise<JobLead> {
    const isDuplicate = await this.deduplicationStore.hasBeenProcessed(lead.id);
    if (isDuplicate) {
      throw new DuplicateJobError(lead.id);
    }

    const qualification = this.qualify(lead);
    if (!qualification.isQualified) {
      // Mark as processed so we don't re-evaluate
      await this.deduplicationStore.markAsProcessed(lead.id, 86400);
      throw new JobDisqualifiedError(qualification.reason, lead.id);
    }

    // Mark as processed
    await this.deduplicationStore.markAsProcessed(lead.id, 86400 * 2);
    return lead;
  }

  private qualify(lead: JobLead): FilterResult {
    // 0. Freshness Check — Sniping requires being in the first 3 pitches (< N hours old)
    if (this.filterCriteria.maxLeadAgeHours && lead.postedAt) {
      const ageMs = Date.now() - lead.postedAt.getTime();
      const maxAgeMs = this.filterCriteria.maxLeadAgeHours * 60 * 60 * 1000;
      if (ageMs > maxAgeMs) {
        const hoursAgo = Math.round(ageMs / (3600 * 1000));
        return {
          isQualified: false,
          matchScore: 0,
          reason: `Stale lead: posted ${hoursAgo}h ago (threshold: <= ${this.filterCriteria.maxLeadAgeHours}h)`
        };
      }
    }

    const textToScan = `${lead.title} ${lead.description}`.toLowerCase();

    // 1. Check forbidden keywords
    for (const forbidden of this.filterCriteria.forbiddenKeywords) {
      if (textToScan.includes(forbidden.toLowerCase())) {
        return {
          isQualified: false,
          matchScore: 0,
          reason: `Contains forbidden keyword: "${forbidden}"`
        };
      }
    }

    // 2. Budget verification
    if (lead.budgetType === "hourly" && lead.budgetAmount) {
      if (lead.budgetAmount < this.filterCriteria.minHourlyRate) {
        return {
          isQualified: false,
          matchScore: 0,
          reason: `Hourly rate $${lead.budgetAmount}/hr below minimum threshold ($${this.filterCriteria.minHourlyRate}/hr)`
        };
      }
    } else if (lead.budgetType === "fixed" && lead.budgetAmount) {
      if (lead.budgetAmount < this.filterCriteria.minFixedBudget) {
        return {
          isQualified: false,
          matchScore: 0,
          reason: `Fixed budget $${lead.budgetAmount} below minimum threshold ($${this.filterCriteria.minFixedBudget})`
        };
      }
    }

    // 3. Client quality check (if applicable, e.g. Upwork)
    if (lead.platform === "upwork") {
      if (this.filterCriteria.requirePaymentVerified && !lead.client.isPaymentVerified) {
        return {
          isQualified: false,
          matchScore: 0,
          reason: "Client payment method is unverified"
        };
      }
      if (
        lead.client.hireRatePercentage !== undefined &&
        lead.client.hireRatePercentage < this.filterCriteria.minClientHireRate
      ) {
        return {
          isQualified: false,
          matchScore: 0,
          reason: `Client hire rate ${lead.client.hireRatePercentage}% below threshold (${this.filterCriteria.minClientHireRate}%)`
        };
      }
    }

    // 4. Skills / Keyword relevance with word-boundary safety
    let matchedSkillsCount = 0;
    const matchedSkills: string[] = [];

    for (const skill of this.filterCriteria.targetSkills) {
      // Escape dots (e.g., next.js -> next\.js)
      const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`(^|[^a-zA-Z0-9_])${escaped}([^a-zA-Z0-9_]|$)`, "i");
      if (regex.test(textToScan)) {
        matchedSkillsCount++;
        matchedSkills.push(skill);
      }
    }

    // Must match at least 1 core technical skill/keyword
    if (matchedSkillsCount === 0) {
      return {
        isQualified: false,
        matchScore: 0,
        reason: "Does not match any of your targeted sweet-spot technical skills"
      };
    }

    const calculatedScore = Math.min(100, Math.round(50 + matchedSkillsCount * 12));

    return {
      isQualified: true,
      matchScore: calculatedScore,
      reason: `High technical match on [${matchedSkills.slice(0, 4).join(", ")}]`
    };
  }
}
