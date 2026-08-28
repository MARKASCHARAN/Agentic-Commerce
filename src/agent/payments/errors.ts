export class PaymentProviderError extends Error {
  constructor(message: string, public readonly providerCode?: string, public readonly originalError?: any) {
    super(message);
    this.name = 'PaymentProviderError';
  }
}

export class PaymentProviderTimeoutError extends PaymentProviderError {
  constructor(message: string, providerCode?: string, originalError?: any) {
    super(message, providerCode, originalError);
    this.name = 'PaymentProviderTimeoutError';
  }
}

export class PaymentUnknownError extends PaymentProviderError {
  constructor(message: string, providerCode?: string, originalError?: any) {
    super(message, providerCode, originalError);
    this.name = 'PaymentUnknownError';
  }
}
