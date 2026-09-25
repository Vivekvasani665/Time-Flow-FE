"use client";

import { useMutation } from "@tanstack/react-query";
import { invitationsService, type CreateInvitationInput } from "@/services/invitations.service";

export function useCreateInvitation() {
  return useMutation({ mutationFn: (input: CreateInvitationInput) => invitationsService.create(input) });
}
