import type { LoginInput, LoginResponse, RefreshResponse, RegisterInput } from './types';

const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ErrorPayload {
  code?: string;
  message?: string;
}

export async function request<T>(
  path: string,
  options: { method?: 'GET' | 'POST' | 'PUT'; body?: unknown; accessToken?: string } = {},
): Promise<T> {
  const headers = new Headers();
  headers.set('Accept', 'application/json');
  if (options.body !== undefined) headers.set('Content-Type', 'application/json');
  if (options.accessToken) headers.set('Authorization', `Bearer ${options.accessToken}`);

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      cache: 'no-store',
      ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Não foi possível conectar à API. Confira o backend e VITE_API_URL.');
  }

  if (!response.ok) {
    const payload: ErrorPayload = await response.json().catch(() => ({})) as ErrorPayload;
    throw new ApiError(
      response.status,
      payload.code ?? 'REQUEST_FAILED',
      payload.message ?? `Não foi possível concluir a operação (HTTP ${response.status}).`,
    );
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const authApi = {
  login: (data: LoginInput) => request<LoginResponse>('/auth/login', { method: 'POST', body: data }),
  register: (data: RegisterInput) => request<{ userId: string; camperId: string; email: string }>('/auth/register', { method: 'POST', body: data }),
  refresh: (refreshToken: string) => request<RefreshResponse>('/auth/refresh', { method: 'POST', body: { refreshToken } }),
  logout: (refreshToken: string) => request<void>('/auth/logout', { method: 'POST', body: { refreshToken } }),
};

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Ocorreu um erro inesperado.';
}

export function money(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}

export function shortDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${d}/${m}/${y}` : iso;
}

export function dateInputAfter(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export const accommodationName: Record<string, string> = {
  TENT: 'Barraca',
  MOTORHOME: 'Motorhome',
  TRAILER: 'Trailer',
};

export const publicationName: Record<string, string> = {
  PENDING_REVIEW: 'Aguardando aprovação',
  APPROVED: 'Publicado',
  REJECTED: 'Não aprovado',
};

export const reservationName: Record<string, string> = {
  PENDING: 'Pendente',
  CONFIRMED: 'Confirmada',
  REFUSED: 'Recusada',
  CANCELLED: 'Cancelada',
};
