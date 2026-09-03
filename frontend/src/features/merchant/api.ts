import { api } from '@/lib/api/client';

export interface Merchant {
  id: string;
  userId: string;
  name: string;
  description?: string;
  businessType?: string;
  country?: string;
  currency?: string;
  timezone?: string;
  createdAt: string;
  updatedAt: string;
}

export const merchantApi = {
  create: (data: Partial<Merchant>) => api.post<{ merchant: Merchant }>('/factory/merchants', data),
  list: () => api.get<{ merchants: Merchant[] }>('/factory/merchants'),
  get: (id: string) => api.get<{ merchant: Merchant }>(`/factory/merchants/${id}`),
  update: (id: string, data: Partial<Merchant>) => api.patch<{ merchant: Merchant }>(`/factory/merchants/${id}`, data),
  delete: (id: string) => api.delete<{ success: boolean }>(`/factory/merchants/${id}`),
  publish: (id: string) => api.post<{ success: boolean }>(`/factory/merchants/${id}/publish`),
  pause: (id: string) => api.post<{ success: boolean }>(`/factory/merchants/${id}/pause`),
  resume: (id: string) => api.post<{ success: boolean }>(`/factory/merchants/${id}/resume`),
  validate: (id: string) => api.post<{ status: string; checks: any[] }>(`/factory/merchants/${id}/validate`),
};
