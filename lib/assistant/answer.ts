import type { AssistantDecision, AssistantIntent } from "./contracts";
import type { AssistantCopy } from "./copy";

export function formatAssistantAnswer(
  decision: AssistantDecision,
  intent: AssistantIntent,
  copy: AssistantCopy,
  hasOrigin: boolean,
): string {
  if (decision.reason === "currency") return copy.currency;
  if (decision.reason === "party_size") return copy.partySize;
  if (decision.reason === "clarify") return copy.clarify;
  if (decision.reason === "missing_routes") return copy.missingRoutes;
  if (decision.reason === "no_match") return copy.noMatch;
  if (decision.reason === "travel_times")
    return hasOrigin
      ? `${copy.travelAnswer}${decision.partialRoutes ? "\n" + copy.partial : ""}`
      : copy.chooseOrigin;
  const winner = decision.rows.find(
    (row) => row.place.id === decision.recommendedPlaceId,
  );
  if (!winner) return copy.noMatch;
  const lines = [
    `${copy.recommend}：${winner.place.name}`,
    copy[intent.priority],
  ];
  if (intent.partySize !== null)
    lines.push(`${copy.people}：${intent.partySize}`);
  if (decision.budgetPerPerson !== null)
    lines.push(
      `${copy.budget}：CNY ${Math.round(decision.budgetPerPerson * 100) / 100}`,
    );
  if (intent.foods.length)
    lines.push(`${copy.food}：${intent.foods.join(" / ")}`);
  if (winner.place.pricePerPerson !== null)
    lines.push(`${copy.reference}：CNY ${winner.place.pricePerPerson}`);
  if (winner.groupTotal !== null)
    lines.push(`${copy.groupTotal}：CNY ${winner.groupTotal}`);
  for (const mode of ["taxi", "transit", "walking"] as const) {
    const route = winner.route?.[mode];
    if (route?.status === "ok")
      lines.push(
        `${copy[mode]}：${Math.ceil(route.durationSeconds / 60)} ${copy.minutes}`,
      );
  }
  if (decision.partialRoutes) lines.push(copy.partial);
  lines.push(copy.caveat);
  return lines.join("\n");
}
