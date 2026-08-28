import { ToolAdapter, ToolAdapterContext, ToolAdapterType } from '../types';
import { RESTToolAdapterOptions } from './types';
import { 
  RESTConnectionError, 
  RESTProtocolError, 
  RESTResponseError, 
  RESTToolAdapterError 
} from './errors';

/**
 * Executes tools through a configured HTTP REST endpoint.
 * 
 * Request URLs are derived from static adapter configuration and
 * validated inputs; the model cannot provide arbitrary URLs.
 */
export class RESTToolAdapter<Input = unknown, Output = unknown> implements ToolAdapter<Input, Output> {
  public readonly type: ToolAdapterType = 'rest';

  constructor(
    private readonly options: RESTToolAdapterOptions<Input, Output>
  ) {}

  /**
   * Executes the tool using the configured REST request mapping.
   * 
   * @throws {RESTToolAdapterError} If request execution fails.
   * @throws {RESTConnectionError} If the target cannot be reached.
   */
  async execute(input: Input, context: ToolAdapterContext): Promise<Output> {
    if (context.abortSignal?.aborted) {
      throw context.abortSignal.reason || new RESTToolAdapterError('Execution aborted before start');
    }

    const requestConfig = this.options.requestMapping(input);
    const url = this.constructUrl(requestConfig.path, requestConfig.query);
    const headers = this.constructHeaders(requestConfig.headers);
    const body = this.constructBody(requestConfig.body, headers);

    try {
      const response = await fetch(url.toString(), {
        method: requestConfig.method,
        headers,
        body,
        signal: context.abortSignal,
      });

      if (!response.ok) {
        await this.handleErrorResponse(response);
      }

      return await this.transformResponse(response);

    } catch (error: any) {
      if (context.abortSignal?.aborted && error === context.abortSignal.reason) {
        throw error;
      }

      if (error.name === 'AbortError') {
        throw context.abortSignal?.reason || error;
      }

      if (error instanceof RESTToolAdapterError) {
        throw error;
      }

      if (error.cause?.code === 'ECONNREFUSED' || error.message?.includes('fetch failed')) {
        throw new RESTConnectionError(`Failed to connect to ${url.origin}`, error);
      }

      throw new RESTToolAdapterError(error.message || 'Unknown REST error', error);
    }
  }

  /**
   * Constructs and validates the request URL.
   * The resulting URL must remain within the configured origin.
   */
  private constructUrl(path: string, query?: Record<string, string | number | boolean>): URL {
    const normalizedBaseUrl = this.options.baseUrl.replace(/\/$/, '');
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    
    let url: URL;
    try {
      url = new URL(`${normalizedBaseUrl}${normalizedPath}`);
    } catch (error: any) {
      throw new RESTProtocolError(`Failed to construct valid URL from base '${normalizedBaseUrl}' and path '${normalizedPath}'`, error);
    }

    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      }
    }

    return url;
  }

  /**
   * Merges default and request-specific headers.
   * Request-specific values take precedence.
   */
  private constructHeaders(dynamicHeaders?: Record<string, string>): Headers {
    const headers = new Headers();

    if (this.options.defaultHeaders) {
      for (const [key, value] of Object.entries(this.options.defaultHeaders)) {
        headers.set(key, value);
      }
    }

    if (dynamicHeaders) {
      for (const [key, value] of Object.entries(dynamicHeaders)) {
        headers.set(key, value);
      }
    }

    return headers;
  }

  /**
   * Serializes object payloads as JSON and sets Content-Type when needed.
   * Existing BodyInit-compatible values are passed through unchanged.
   */
  private constructBody(bodyData: unknown, headers: Headers): BodyInit | null {
    if (bodyData === undefined || bodyData === null) {
      return null;
    }

    if (typeof bodyData === 'object' && !(bodyData instanceof FormData) && !(bodyData instanceof Blob) && !(bodyData instanceof URLSearchParams)) {
      if (!headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }
      return JSON.stringify(bodyData);
    }

    return bodyData as BodyInit;
  }

  /**
   * Converts a non-2xx response into a deterministic RESTResponseError.
   * Preserves the HTTP status and response body for diagnostics.
   */
  private async handleErrorResponse(response: Response): Promise<never> {
    let bodyText: string | undefined;
    try {
      bodyText = await response.text();
    } catch (e) {
      // Ignored: Body cannot be read.
    }

    let message = `HTTP Error ${response.status}`;
    if (bodyText) {
      try {
        const parsed = JSON.parse(bodyText);
        if (parsed.error?.message) {
          message = parsed.error.message;
        } else if (parsed.message) {
          message = parsed.message;
        }
      } catch (e) {
        // Ignored: Body is not valid JSON.
      }
    }

    throw new RESTResponseError(response.status, response.statusText, message, bodyText);
  }

  /**
   * Transforms a successful REST response into the configured output type.
   * Uses responseMapping when provided; otherwise parses JSON responses.
   */
  private async transformResponse(response: Response): Promise<Output> {
    if (this.options.responseMapping) {
      return this.options.responseMapping(response);
    }

    if (response.status === 204) {
      return {} as Output;
    }

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        return await response.json() as Output;
      } catch (error: any) {
        throw new RESTProtocolError(`Failed to parse REST response as JSON: ${error.message}`, error);
      }
    }

    throw new RESTProtocolError(`Expected application/json response, but got ${contentType || 'unknown'}`);
  }
}
