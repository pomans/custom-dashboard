// API configuration — override VITE_API_BASE_URL in .env.local to change the host
export const API_BASE_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) ||
  'https://localhost:7139';

export const WIDGET_ENDPOINT = (widgetKey) =>
  `${API_BASE_URL}/datasource/widget/${widgetKey}`;
