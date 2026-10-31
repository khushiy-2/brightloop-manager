export class ServiceValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ServiceValidationError";
  }
}

export class SubscriptionTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SubscriptionTransitionError";
  }
}

export class InvoiceTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvoiceTransitionError";
  }
}
