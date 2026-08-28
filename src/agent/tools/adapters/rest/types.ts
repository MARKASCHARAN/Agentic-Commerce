export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RESTToolAdapterOptions<Input = unknown, Output = unknown> {
  /**
   * The base URL for the REST API (e.g. "https://api.razorpay.com/v1").
   * This is explicitly configured by the infrastructure, not the agent,
   * preventing SSRF attacks to arbitrary URLs.
   */
  baseUrl: string;

  /**
   * Default headers applied to every request (e.g., authorization, accept).
   * Credentials should be passed here via explicit injection.
   */
  defaultHeaders?: Record<string, string>;

  /**
   * Defines how to map the Tool's generic Input object to the specific REST HTTP parameters.
   */
  requestMapping: (input: Input) => {
    method: HttpMethod;
    /** Path relative to baseUrl. E.g. "/payments" */
    path: string;
    headers?: Record<string, string>;
    query?: Record<string, string | number | boolean>;
    body?: unknown;
  };

  /**
   * Defines how to map the raw HTTP response back to the expected Tool Output.
   * If omitted, attempts to parse as JSON by default.
   */
  responseMapping?: (response: Response) => Promise<Output>;
}
