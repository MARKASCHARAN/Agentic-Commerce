import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/v1';

export class ApiClient {
  private client: AxiosInstance;

  constructor(baseURL: string = BASE_URL) {
    this.client = axios.create({
      baseURL,
      withCredentials: true,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.client.interceptors.response.use(
      (response) => response.data,
      (error) => {
        // Handle common errors like 401, 403, 404
        if (error.response) {
          const { status, data } = error.response;
          // Example: You could throw a structured Error object here
          throw new Error(data?.error?.message || `API Error: ${status}`);
        } else if (error.request) {
          throw new Error('Network Error: No response received');
        } else {
          throw new Error(error.message);
        }
      }
    );
  }

  // A method to easily inject merchantId into headers if needed
  public setMerchantContext(merchantId: string) {
    this.client.defaults.headers.common['X-Merchant-ID'] = merchantId;
  }



  public async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return this.client.get(url, config) as Promise<T>;
  }

  public async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    return this.client.post(url, data, config) as Promise<T>;
  }

  public async patch<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    return this.client.patch(url, data, config) as Promise<T>;
  }

  public async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return this.client.delete(url, config) as Promise<T>;
  }
}

export const api = new ApiClient();
