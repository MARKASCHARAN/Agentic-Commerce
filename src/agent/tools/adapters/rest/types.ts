export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RESTToolAdapterOptions<Input = unknown, Output = unknown> {
  
  baseUrl: string;

  defaultHeaders?: Record<string, string>;

  requestMapping: (input: Input) => {
    method: HttpMethod;
    
    path: string;
    headers?: Record<string, string>;
    query?: Record<string, string | number | boolean>;
    body?: unknown;
  };

  responseMapping?: (response: Response) => Promise<Output>;
}
