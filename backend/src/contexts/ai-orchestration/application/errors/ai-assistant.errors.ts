export class AiAssistantValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiAssistantValidationError';
  }
}

export class AiAssistantNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiAssistantNotFoundError';
  }
}

export class AiAssistantUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiAssistantUnavailableError';
  }
}
