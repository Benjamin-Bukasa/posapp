import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "favicon.svg",
        "pwa-192.png",
        "pwa-512.png",
        "apple-touch-icon.png",
      ],
      manifest: {
        id: "/",
        name: "POSapp Admin",
        short_name: "POSadmin",
        description:
          "Console d'administration POSapp pour la gestion des boutiques, du stock et des parametres.",
        theme_color: "#002e31",
        background_color: "#f3f4f6",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        lang: "fr",
        icons: [
          {
            src: "/pwa-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: "/pwa-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: "/apple-touch-icon.png",
            sizes: "180x180",
            type: "image/png",
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        globPatterns: ["**/*.{js,css,html,ico,png,svg,json}"],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  server: {
    host: "0.0.0.0",
    port: 5174,
  },
});
