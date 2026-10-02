import { JobLead } from "../../domain/models/JobLead.js";
import { PitchDraft } from "../../domain/models/PitchDraft.js";

export interface INotificationGateway {
  dispatchAlert(lead: JobLead, pitch: PitchDraft): Promise<boolean>;
}
