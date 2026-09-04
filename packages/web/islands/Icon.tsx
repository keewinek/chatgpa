import type { JSX } from "preact";

type IconProps = {
  /** Font Awesome icon name without the `fa-` prefix, e.g. `folder`. */
  name: string;
  style?: "solid" | "regular" | "brands";
  class?: string;
  title?: string;
};

/** Renders a Font Awesome icon (`<i class="fa-solid fa-…">`). */
export default function Icon({
  name,
  style = "solid",
  class: className,
  title,
}: IconProps): JSX.Element {
  const styleClass = style === "brands"
    ? "fa-brands"
    : style === "regular"
    ? "fa-regular"
    : "fa-solid";
  return (
    <i
      class={`${styleClass} fa-${name}${className ? ` ${className}` : ""}`}
      title={title}
      aria-hidden={title ? undefined : true}
    />
  );
}
