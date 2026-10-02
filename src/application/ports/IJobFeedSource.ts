import { JobLead } from "../../domain/models/JobLead.js";

export interface IJobFeedSource {
  readonly platformName: string;
  pollNewJobs(): Promise<JobLead[]>;
}
