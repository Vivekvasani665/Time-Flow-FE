import { api } from "@/lib/api/client";
import type { CallContact, CallHistoryItem } from "@/types/call";

export const callService = {
  contacts: () => api.get<CallContact[]>("/calls/contacts"),
  history: (userId: string) => api.get<CallHistoryItem[]>("/calls", { userId }),
  iceServers: async () => (await api.get<{ iceServers: RTCIceServer[] }>("/calls/ice-servers")).iceServers,
};
