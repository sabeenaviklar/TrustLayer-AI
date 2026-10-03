const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

export interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  error?: {
    message: string;
    code?: string;
    details?: any;
  } | null;
}

export class ApiError extends Error {
  code?: string;
  details?: any;

  constructor(message: string, code?: string, details?: any) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

export async function request<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('trustlayer_token') : null;

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  // Prepend /api if endpoint doesn't start with /api or full URL
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const fullUrl = cleanEndpoint.startsWith('/api')
    ? cleanEndpoint
    : `${API_BASE}${cleanEndpoint}`;

  try {
    const res = await fetch(fullUrl, {
      ...options,
      headers,
    });

    const json: ApiResponse<T> = await res.json();

    if (!res.ok || !json.success) {
      if (res.status === 401 && typeof window !== 'undefined') {
        // Clear token on unauthorized if not on auth page
        if (!window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/signup')) {
          localStorage.removeItem('trustlayer_token');
          localStorage.removeItem('trustlayer_user');
          window.location.href = '/login';
        }
      }
      throw new ApiError(
        json.error?.message || `Request failed with status ${res.status}`,
        json.error?.code,
        json.error?.details
      );
    }

    return json.data;
  } catch (error: any) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(error.message || 'Network error occurred');
  }
}

export const api = {
  get: <T>(endpoint: string) => request<T>(endpoint, { method: 'GET' }),
  post: <T>(endpoint: string, body?: any) =>
    request<T>(endpoint, {
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),
  patch: <T>(endpoint: string, body?: any) =>
    request<T>(endpoint, {
      method: 'PATCH',
      body: body instanceof FormData ? body : JSON.stringify(body),
    }),
  delete: <T>(endpoint: string) => request<T>(endpoint, { method: 'DELETE' }),
};
