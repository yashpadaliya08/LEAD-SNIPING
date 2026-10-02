import { JobLead } from "../../domain/models/JobLead.js";
import { PitchDraft } from "../../domain/models/PitchDraft.js";

export interface IPitchGenerator {
  generatePitch(lead: JobLead): Promise<PitchDraft>;
}
