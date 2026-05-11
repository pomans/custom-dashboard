import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/custom-dashboard/',
  plugins: [react()]
});
