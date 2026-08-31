import { App, staticFiles } from "fresh";
import { createApp, loadEnv } from "@chatgpa/api";

await loadEnv();

const api = createApp();

export const app = new App()
  .use(staticFiles())
  .all("/api/*", (ctx) => api.fetch(ctx.req))
  .fsRoutes();
