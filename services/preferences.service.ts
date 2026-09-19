import { api } from "@/lib/api/client";
import type { Preferences } from "@/lib/preferences";

export const preferencesService = {
  /**
   * Partial patch; the server merges it and returns the whole bag.
   * `api.patch` hands back the whole envelope, so unwrap `.data` — every other
   * service does the same.
   */
  update: async (patch: Partial<Preferences>) =>
    (await api.patch<Preferences>("/auth/me/preferences", patch)).data,
};
