// In-memory Bearer token store (never stored in localStorage/sessionStorage)
let memoryAuthToken: string | null = null;
let onUnauthorizedCallback: (() => void) | null = null;

export function setAuthToken(token: string | null) {
  memoryAuthToken = token;
}

export function getAuthToken(): string | null {
  return memoryAuthToken;
}

export function setOnUnauthorized(cb: () => void) {
  onUnauthorizedCallback = cb;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers);
  const isBinaryBody =
    options.body instanceof Blob ||
    options.body instanceof ArrayBuffer ||
    ArrayBuffer.isView(options.body) ||
    options.body instanceof FormData;

  if (options.body && !isBinaryBody && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (memoryAuthToken) {
    headers.set('Authorization', `Bearer ${memoryAuthToken}`);
  }

  const res = await fetch(path, {
    ...options,
    headers,
  });

  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json')
    ? await res.json().catch(() => ({}))
    : {};

  if (!res.ok) {
    if (res.status === 401 && memoryAuthToken && onUnauthorizedCallback) {
      memoryAuthToken = null;
      onUnauthorizedCallback();
    }
    const message =
      (data && typeof data.error === 'string' && data.error) ||
      `Request failed (${res.status})`;
    throw new ApiError(message, res.status);
  }

  return data as T;
}

export async function apiDownloadBlob(
  path: string,
  fallbackFilename = 'lab-report.pdf'
): Promise<void> {
  const headers = new Headers();
  if (memoryAuthToken) {
    headers.set('Authorization', `Bearer ${memoryAuthToken}`);
  }

  const res = await fetch(path, { method: 'GET', headers });
  if (!res.ok) {
    const contentType = res.headers.get('content-type') || '';
    const data = contentType.includes('application/json')
      ? await res.json().catch(() => ({}))
      : {};
    if (res.status === 401 && memoryAuthToken && onUnauthorizedCallback) {
      memoryAuthToken = null;
      onUnauthorizedCallback();
    }
    const message =
      (data && typeof data.error === 'string' && data.error) ||
      `Download failed (${res.status})`;
    throw new ApiError(message, res.status);
  }

  const blob = await res.blob();
  const disposition = res.headers.get('content-disposition') || '';
  const match = disposition.match(/filename="([^"]+)"/i);
  const filename = match?.[1] || fallbackFilename;

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

