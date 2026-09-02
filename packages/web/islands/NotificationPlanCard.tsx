import type { Task } from "@chatgpa/core";

interface NotificationPlanCardProps {
  todoToday: Task[];
  freeMinutes: number;
}

export default function NotificationPlanCard(
  { todoToday, freeMinutes }: NotificationPlanCardProps,
) {
  return (
    <div class="notification-plan-card" role="region" aria-label="Plan na dziś">
      <div class="notification-plan-card__header">
        <span class="notification-plan-card__budget">~{freeMinutes} min wolnej nauki</span>
      </div>
      {todoToday.length > 0
        ? (
          <ul class="notification-plan-card__list">
            {todoToday.map((task) => (
              <li key={task.id}>
                {task.estimatedMinutes ? `[${task.estimatedMinutes} min] ` : ""}
                {task.title}
              </li>
            ))}
          </ul>
        )
        : (
          <p class="notification-plan-card__empty">
            Brak zadań na dziś — możesz zaproponować własny plan.
          </p>
        )}
    </div>
  );
}
