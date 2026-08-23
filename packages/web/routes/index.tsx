import { Head } from "fresh/runtime";
import { define } from "../utils.ts";

const TARGET_AVERAGE = 4.75;

export default define.page(function Home() {
  return (
    <div class="page">
      <Head>
        <title>ChatGPA — Cursor for School</title>
      </Head>
      <main class="shell">
        <p class="eyebrow">Educational copilot</p>
        <h1>ChatGPA</h1>
        <p class="lede">
          Librus ROI prioritization, Samsung Notes RAG, and unified study planning — built to move
          your overall average toward <strong>{TARGET_AVERAGE.toFixed(2)}</strong>.
        </p>
        <ul class="features">
          <li>Librus context engine with grade-weight ROI calculations</li>
          <li>Samsung Notes search and exam-style practice from your notes</li>
          <li>Single Deno monorepo with shared types across API and UI</li>
        </ul>
      </main>
    </div>
  );
});
