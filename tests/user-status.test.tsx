import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { UserStatusBadge } from "@/components/ui/badge";
import { toUserPayload, type UserFormValues } from "@/components/users/user-form";
import type { UserStatus } from "@/types/api";

describe("user status", () => {
  it("renders a PENDING (signed up, not verified) user instead of crashing", () => {
    render(<UserStatusBadge status="PENDING" />);
    expect(screen.getByText("Pending verification")).toBeInTheDocument();
  });

  it("still renders a status this build does not know", () => {
    render(<UserStatusBadge status={"SUSPENDED" as UserStatus} />);
    expect(screen.getByText("SUSPENDED")).toBeInTheDocument();
  });

  it("does not send PENDING back to the API when saving a pending user", () => {
    const values: UserFormValues = {
      firstName: "Pat",
      lastName: "Lee",
      email: "pat@x.co",
      phone: "",
      password: "",
      roleId: "r1",
      status: "PENDING",
      avatarUrl: null,
    };
    expect(toUserPayload(values, "edit")).not.toHaveProperty("status");
    expect(toUserPayload({ ...values, status: "ACTIVE" }, "edit")).toMatchObject({ status: "ACTIVE" });
  });
});
