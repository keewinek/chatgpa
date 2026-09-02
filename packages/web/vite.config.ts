import { defineConfig } from "vite";
import { fresh } from "@fresh/plugin-vite";

export default defineConfig({
  plugins: [fresh()],
  ssr: {
    external: ["web-push"],
  },
  build: {
    rollupOptions: {
      external: ["web-push"],
    },
  },
});
