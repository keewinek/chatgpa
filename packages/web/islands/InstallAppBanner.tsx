import { useEffect, useState } from "preact/hooks";
import Icon from "./Icon.tsx";

const DISMISS_KEY = "chatgpa:install-banner-dismissed";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone(): boolean {
  if (typeof globalThis.matchMedia === "function") {
    if (globalThis.matchMedia("(display-mode: standalone)").matches) return true;
  }
  // deno-lint-ignore no-explicit-any
  return Boolean((globalThis.navigator as any)?.standalone);
}

function isIos(): boolean {
  const ua = globalThis.navigator?.userAgent ?? "";
  return /iphone|ipad|ipod/i.test(ua);
}

export default function InstallAppBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(true);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      // localStorage niedostępny — pokaż banner mimo to
    }
    if (isStandalone()) return;

    setIos(isIos());
    setDismissed(false);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    globalThis.addEventListener("beforeinstallprompt", onPrompt);
    return () => globalThis.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // ignoruj brak dostępu do localStorage
    }
  }

  async function install() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    dismiss();
  }

  if (dismissed) return null;

  return (
    <div class="install-banner" role="region" aria-label="Zainstaluj aplikację">
      <div class="install-banner__main">
        <strong class="install-banner__title">Zainstaluj ChatGPA na telefonie</strong>
        <span class="install-banner__body">
          {ios
            ? "Dotknij Udostępnij, a potem „Dodaj do ekranu początkowego” — dopiero wtedy telefon pokaże powiadomienia."
            : deferredPrompt
            ? "Dodaj aplikację do ekranu głównego, żeby dostawać powiadomienia po szkole."
            : "Otwórz menu przeglądarki i wybierz „Zainstaluj aplikację” lub „Dodaj do ekranu głównego”."}
        </span>
      </div>
      {deferredPrompt && (
        <button type="button" class="install-banner__install" onClick={() => void install()}>
          Zainstaluj
        </button>
      )}
      <button
        type="button"
        class="install-banner__dismiss"
        aria-label="Zamknij"
        onClick={dismiss}
      >
        <Icon name="xmark" />
      </button>
    </div>
  );
}
