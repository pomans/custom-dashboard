// API configuration — override VITE_API_BASE_URL in .env.local to change the host
export const API_BASE_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) ||
  'https://localhost:7139';

export const WIDGET_ENDPOINT = (widgetKey) =>
  `${API_BASE_URL}/datasource/widget/${widgetKey}`;

// Data source flag — set VITE_USE_SAMPLE_DATA=true in .env.local to skip API calls
// and use the static sampleData fixedProfile instead (useful for offline / demo mode)
export const USE_SAMPLE_DATA =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_USE_SAMPLE_DATA) === 'true';
