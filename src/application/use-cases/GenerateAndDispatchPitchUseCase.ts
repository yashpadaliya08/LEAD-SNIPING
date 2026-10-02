import { JobLead } from "../../domain/models/JobLead.js";
import { PitchDraft } from "../../domain/models/PitchDraft.js";
import { IPitchGenerator } from "../ports/IPitchGenerator.js";
import { INotificationGateway } from "../ports/INotificationGateway.js";
import { NotificationDispatchError, PitchGenerationError } from "../../domain/errors/DomainErrors.js";

export interface PipelineExecutionReport {
  leadId: string;
  platform: string;
  dispatched: boolean;
  pitch: PitchDraft;
  totalLatencyMs: number;
}

export class GenerateAndDispatchPitchUseCase {
  constructor(
    private readonly pitchGenerator: IPitchGenerator,
    private readonly notificationGateway: INotificationGateway
  ) {}

  public async execute(lead: JobLead): Promise<PipelineExecutionReport> {
    const startTime = Date.now();

    // 1. Generate consultative pitch draft
    let pitch: PitchDraft;
    try {
      pitch = await this.pitchGenerator.generatePitch(lead);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new PitchGenerationError(lead.id, message);
    }

    // 2. Dispatch alert via Telegram
    let dispatched = false;
    try {
      dispatched = await this.notificationGateway.dispatchAlert(lead, pitch);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new NotificationDispatchError("Telegram", message);
    }

    const totalLatencyMs = Date.now() - startTime;

    return {
      leadId: lead.id,
      platform: lead.platform,
      dispatched,
      pitch,
      totalLatencyMs
    };
  }
}
