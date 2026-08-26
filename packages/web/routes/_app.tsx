import { define } from "../utils.ts";

export default define.page(function App({ Component }) {
  return (
    <html lang="pl">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="theme-color" content="#12100e" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="icon" href="/favicon.ico" />
        <title>ChatGPA</title>
      </head>
      <body>
        <Component />
      </body>
    </html>
  );
});
