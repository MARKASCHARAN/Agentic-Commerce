import { ToolAdapterError } from '../errors';

export class RESTToolAdapterError extends ToolAdapterError {
  constructor(message: string, cause?: unknown) {
    super(message, 'rest', cause);
    this.name = 'RESTToolAdapterError';
  }
}

export class RESTConnectionError extends RESTToolAdapterError {
  constructor(message: string, cause?: unknown) {
    super(`REST Connection Error: ${message}`, cause);
    this.name = 'RESTConnectionError';
  }
}

export class RESTResponseError extends RESTToolAdapterError {
  public readonly status: number;
  public readonly statusText: string;
  public readonly responseBody?: string;

  constructor(status: number, statusText: string, message: string, responseBody?: string) {
    
    super(`REST Response Error (${status} ${statusText}): ${message}`);
    this.name = 'RESTResponseError';
    this.status = status;
    this.statusText = statusText;
    this.responseBody = responseBody;
  }
}

export class RESTProtocolError extends RESTToolAdapterError {
  constructor(message: string, cause?: unknown) {
    super(`REST Protocol Error: ${message}`, cause);
    this.name = 'RESTProtocolError';
  }
}
