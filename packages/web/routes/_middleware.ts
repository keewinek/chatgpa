import { define } from "../utils.ts";

export default define.middleware(async (ctx) => {
  ctx.state.subjects = [];
  return await ctx.next();
});
