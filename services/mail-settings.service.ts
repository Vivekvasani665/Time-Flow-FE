import { api } from "@/lib/api/client";
import type { MailSettings, MailSettingsInput, MailTestResult } from "@/types/api";

export const mailSettingsService = {
  get: () => api.get<MailSettings>("/mail-settings"),
  test: async (input: Omit<MailSettingsInput, "fromName">) =>
    (await api.post<MailTestResult>("/mail-settings/test", input)).data,
  save: async (input: MailSettingsInput) => (await api.patch<MailSettings>("/mail-settings", input)).data,
  disable: async () => (await api.delete<MailSettings>("/mail-settings")).data,
};
