export const RAW_API_URL = process.env.NEXT_PUBLIC_API_URL || '';
export const API_BASE_URL = RAW_API_URL.replace(/\/+$/, '').replace(/\/api$/, '');

export const RAW_SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || '';
export const SOCKET_BASE_URL = (RAW_SOCKET_URL || API_BASE_URL).replace(/\/+$/, '').replace(/\/api$/, '');

export function isApiConfigured() {
  return API_BASE_URL.length > 0;
}

export function getApiBaseUrl() {
  return API_BASE_URL;
}

export function getSocketBaseUrl() {
  return SOCKET_BASE_URL;
}
