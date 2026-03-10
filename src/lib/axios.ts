// Mock axios instance for type checking
// In real project, this will be your actual axios instance

export interface HttpResponse<T> {
  data: T;
  status: number;
  headers: Record<string, string>;
}

export const axiosInstance = {
  async get<T>(url: string, config?: any): Promise<HttpResponse<T>> {
    return { data: {} as T, status: 200, headers: {} };
  },
  async post<T>(url: string, data?: any, config?: any): Promise<HttpResponse<T>> {
    return { data: {} as T, status: 200, headers: {} };
  },
  async put<T>(url: string, data?: any, config?: any): Promise<HttpResponse<T>> {
    return { data: {} as T, status: 200, headers: {} };
  },
  async patch<T>(url: string, data?: any, config?: any): Promise<HttpResponse<T>> {
    return { data: {} as T, status: 200, headers: {} };
  },
  async delete<T>(url: string, config?: any): Promise<HttpResponse<T>> {
    return { data: {} as T, status: 200, headers: {} };
  },
};
