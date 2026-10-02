export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class JobDisqualifiedError extends DomainError {
  constructor(public readonly reason: string, public readonly jobId: string) {
    super(`Job ${jobId} disqualified: ${reason}`);
  }
}

export class DuplicateJobError extends DomainError {
  constructor(public readonly jobId: string) {
    super(`Job ${jobId} has already been processed.`);
  }
}

export class PitchGenerationError extends DomainError {
  constructor(public readonly jobId: string, message: string) {
    super(`Failed to generate pitch for job ${jobId}: ${message}`);
  }
}

export class NotificationDispatchError extends DomainError {
  constructor(public readonly recipient: string, message: string) {
    super(`Failed to dispatch alert to ${recipient}: ${message}`);
  }
}
