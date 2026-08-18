import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      registerType: "autoUpdate",
      injectRegister: "auto",
      manifest: {
        name: "Racket",
        short_name: "Racket",
        description: "Host racket-sport nights, auto-shuffle fair teams, and chase the leaderboard.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait-primary",
        background_color: "#101311",
        theme_color: "#146C43",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,png,svg}"],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": "/src",
    },
  },
  server: {
    port: 5173,
  },
  preview: {
    port: 4173,
    // Allow the throwaway cloudflared tunnel hostname through Vite's Host
    // header check (blocked by default for any host it doesn't recognize).
    allowedHosts: [".trycloudflare.com"],
    // Proxy API calls server-side to the Go backend instead of the browser
    // calling it directly cross-origin. This makes the browser's-eye-view
    // entirely single-origin, which sidesteps WebKit's ITP blocking
    // SameSite=None cookies across the two separate tunnel domains (Safari
    // and iOS Chrome, which is WebKit under the hood, do this regardless of
    // otherwise-correct cookie attributes).
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
});
