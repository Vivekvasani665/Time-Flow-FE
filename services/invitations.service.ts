import { api, request } from "@/lib/api/client";
import type { CreatedInvitation, InvitationCheck } from "@/types/api";

export type CreateInvitationInput = { email: string; roleId: string };
export type AcceptInvitationInput = { token: string; password: string; confirmPassword: string };

export const invitationsService = {
  /** Super Admin: generates a single-use link. Any earlier pending link for the same email stops working. */
  create: async (input: CreateInvitationInput) => (await api.post<CreatedInvitation>("/admin/invitations", input)).data,

  // The two below are public: the invitee holds a link, not a session, so a 401 must not trigger a refresh.
  verify: async (token: string) =>
    (await request<InvitationCheck>("/auth/invitations/verify", { query: { token }, skipAuthRefresh: true })).data,

  accept: async (input: AcceptInvitationInput) => {
    await request<{ email: string }>("/auth/invitations/accept", { method: "POST", body: input, skipAuthRefresh: true });
  },
};
