import { Head } from "fresh/runtime";
import { define } from "../utils.ts";
import ChatApp from "../islands/ChatApp.tsx";

export default define.page(function Home() {
  return (
    <div class="page page--chat">
      <Head>
        <title>ChatGPA — Cursor do szkoły</title>
        <meta
          name="description"
          content="Osobisty AI do planowania nauki, z darmowymi modelami i kontekstem szkolnym."
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=Instrument+Serif:ital@0;1&display=swap"
          rel="stylesheet"
        />
      </Head>
      <ChatApp />
    </div>
  );
});
