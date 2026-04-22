import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    open: false,
    proxy: {
      "/api": { target: "http://127.0.0.1:3847", changeOrigin: true },
    },
  },
});
