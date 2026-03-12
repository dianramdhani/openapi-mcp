// Mock axios instance for type checking
// In real project, this will be your actual axios instance

export interface HttpResponse<T> {
  data: T;
  status: number;
  headers: Record<string, string>;
}

export const axiosInstance = {
  async get<T>(_url: string, _config?: unknown): Promise<HttpResponse<T>> {
    return { data: {} as T, status: 200, headers: {} };
  },
  async post<T>(_url: string, _data?: unknown, _config?: unknown): Promise<HttpResponse<T>> {
    return { data: {} as T, status: 200, headers: {} };
  },
  async put<T>(_url: string, _data?: unknown, _config?: unknown): Promise<HttpResponse<T>> {
    return { data: {} as T, status: 200, headers: {} };
  },
  async patch<T>(_url: string, _data?: unknown, _config?: unknown): Promise<HttpResponse<T>> {
    return { data: {} as T, status: 200, headers: {} };
  },
  async delete<T>(_url: string, _config?: unknown): Promise<HttpResponse<T>> {
    return { data: {} as T, status: 200, headers: {} };
  },
};
