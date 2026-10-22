import type {
  AssistantDecision,
  AssistantIntent,
  AssistantOrigin,
  AssistantPlace,
  RouteSnapshot,
} from "@/lib/assistant/contracts";
import type { AmapPoiOption } from "@/lib/amap/place-search";
export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  loading?: boolean;
  error?: boolean;
  historical?: boolean;
  places?: AssistantPlace[];
  routes?: RouteSnapshot[];
  origin?: AssistantOrigin | null;
  decision?: AssistantDecision;
  intent?: AssistantIntent;
};
export type PlaceConfirmation = {
  query: string;
  options: AssistantPlace[];
  selected: AssistantPlace | null;
};
export type PendingChat = {
  messageId: string;
  token: number;
  intent: AssistantIntent;
  groups: PlaceConfirmation[];
  origin: AssistantOrigin | null;
  originOptions: AmapPoiOption[];
  originQuery: string | null;
};
