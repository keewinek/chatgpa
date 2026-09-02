import type { AppNotification } from "@chatgpa/core";

interface NotificationsBannerProps {
  notifications: AppNotification[];
  onOpen: (notification: AppNotification) => void;
  onDismiss: (id: string) => void;
}

export default function NotificationsBanner({
  notifications,
  onOpen,
  onDismiss,
}: NotificationsBannerProps) {
  if (!notifications.length) return null;

  return (
    <div class="notifications-banner" role="region" aria-label="Powiadomienia">
      {notifications.map((n) => (
        <article key={n.id} class="notifications-banner__item">
          <button
            type="button"
            class="notifications-banner__main"
            onClick={() => onOpen(n)}
          >
            <strong class="notifications-banner__title">{n.title}</strong>
            <span class="notifications-banner__body">{n.body}</span>
            {typeof n.payload?.freeMinutes === "number" && (
              <span class="notifications-banner__meta">
                ~{n.payload.freeMinutes} min · {n.payload.todoToday?.length ?? 0} TODO
              </span>
            )}
          </button>
          <button
            type="button"
            class="notifications-banner__dismiss"
            aria-label="Oznacz jako przeczytane"
            onClick={() => onDismiss(n.id)}
          >
            ×
          </button>
        </article>
      ))}
    </div>
  );
}
