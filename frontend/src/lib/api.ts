const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

class ApiClient {
  private isRefreshing = false;
  private refreshSubscribers: ((token: string) => void)[] = [];

  private subscribeTokenRefresh(cb: (token: string) => void) {
    this.refreshSubscribers.push(cb);
  }

  private onRefreshed(token: string) {
    this.refreshSubscribers.forEach((cb) => cb(token));
    this.refreshSubscribers = [];
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

    const headers: Record<string, string> = {
      ...((options.headers as Record<string, string>) || {}),
    };

    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('repairhub_token');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    // Handle 401 unauthorized & refresh token rotation
    if (response.status === 401 && typeof window !== 'undefined') {
      const refreshToken = localStorage.getItem('repairhub_refresh_token');

      if (refreshToken && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/refresh')) {
        if (!this.isRefreshing) {
          this.isRefreshing = true;

          try {
            const refreshRes = await fetch(`${BASE_URL}/auth/refresh`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ refreshToken }),
            });

            if (refreshRes.ok) {
              const data = await refreshRes.json();
              localStorage.setItem('repairhub_token', data.accessToken);
              localStorage.setItem('repairhub_refresh_token', data.refreshToken);
              this.isRefreshing = false;
              this.onRefreshed(data.accessToken);

              // Retry original request
              headers['Authorization'] = `Bearer ${data.accessToken}`;
              const retryRes = await fetch(url, { ...options, headers });
              return retryRes.json();
            } else {
              this.isRefreshing = false;
              localStorage.removeItem('repairhub_token');
              localStorage.removeItem('repairhub_refresh_token');
              localStorage.removeItem('repairhub_user');
              window.location.href = '/login';
            }
          } catch {
            this.isRefreshing = false;
            localStorage.removeItem('repairhub_token');
            localStorage.removeItem('repairhub_refresh_token');
            localStorage.removeItem('repairhub_user');
            window.location.href = '/login';
          }
        } else {
          return new Promise((resolve) => {
            this.subscribeTokenRefresh(async (newToken) => {
              headers['Authorization'] = `Bearer ${newToken}`;
              const retryRes = await fetch(url, { ...options, headers });
              resolve(retryRes.json());
            });
          });
        }
      }
    }

    // Check content type for json vs blob (PDF download)
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/pdf')) {
      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }
      return (await response.blob()) as unknown as T;
    }

    const data = await response.json();
    if (!response.ok) {
      const errorMsg = data.error || (data.details ? JSON.stringify(data.details) : 'Request failed');
      const error = new Error(errorMsg);
      (error as any).status = response.status;
      (error as any).data = data;
      throw error;
    }

    return data as T;
  }

  get<T>(endpoint: string, headers?: Record<string, string>): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET', headers });
  }

  post<T>(endpoint: string, body?: any, headers?: Record<string, string>): Promise<T> {
    const isFormData = body instanceof FormData;
    return this.request<T>(endpoint, {
      method: 'POST',
      body: isFormData ? body : JSON.stringify(body),
      headers,
    });
  }

  put<T>(endpoint: string, body?: any, headers?: Record<string, string>): Promise<T> {
    const isFormData = body instanceof FormData;
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: isFormData ? body : JSON.stringify(body),
      headers,
    });
  }

  patch<T>(endpoint: string, body?: any, headers?: Record<string, string>): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(body),
      headers,
    });
  }

  delete<T>(endpoint: string, headers?: Record<string, string>): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE', headers });
  }
}

export const api = new ApiClient();
