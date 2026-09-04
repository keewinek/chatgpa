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
      output: {
        assetFileNames: (asset) =>
          asset.name?.endsWith(".css") ? "assets/styles.css" : "assets/[name]-[hash][extname]",
      },
    },
  },
});
