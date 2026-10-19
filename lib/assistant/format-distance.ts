import type { AssistantCopy } from "./copy";

export function formatRouteDistance(
  metres: number,
  copy: Pick<AssistantCopy, "locale" | "metres" | "kilometres">,
): string {
  if (metres < 1000) return `${Math.round(metres)} ${copy.metres}`;
  const kilometres = metres / 1000;
  const value = kilometres.toLocaleString(copy.locale, {
    maximumFractionDigits: kilometres < 10 ? 1 : 0,
  });
  return `${value} ${copy.kilometres}`;
}
