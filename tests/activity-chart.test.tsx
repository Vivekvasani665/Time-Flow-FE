import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ActivityChart } from "@/components/activity/activity-chart";
import { activityService } from "@/services/activity.service";
import type { ActivityStats } from "@/types/api";
import { renderWithProviders } from "./utils";

vi.mock("@/services/activity.service", () => ({ activityService: { stats: vi.fn(), list: vi.fn(), exportUrl: vi.fn() } }));

const STATS: ActivityStats = {
  from: "2026-03-01",
  to: "2026-03-03",
  total: 7,
  days: [
    { date: "2026-03-01", count: 5 },
    { date: "2026-03-02", count: 0 },
    { date: "2026-03-03", count: 2 },
  ],
  byEntity: [
    { entity: "task", count: 6 },
    { entity: "activity_log", count: 1 },
  ],
};

beforeEach(() => {
  vi.mocked(activityService.stats).mockResolvedValue(STATS);
});

describe("ActivityChart", () => {
  it("draws one column per day and the per-entity breakdown", async () => {
    renderWithProviders(<ActivityChart params={{ page: 2, limit: 20, entity: "task" }} onSelectDay={vi.fn()} />);

    expect(await screen.findByText(/7 events/)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Show only this day/ })).toHaveLength(3);
    expect(screen.getByText("Task")).toBeInTheDocument();
    expect(screen.getByText("activity log")).toBeInTheDocument();
    // Pagination is not a filter: the chart must not refetch per page.
    expect(activityService.stats).toHaveBeenCalledWith({ entity: "task" });
  });

  it("shows a tooltip on hover and filters to a day on click", async () => {
    const onSelectDay = vi.fn();
    renderWithProviders(<ActivityChart params={{}} onSelectDay={onSelectDay} />);

    const column = await screen.findByRole("button", { name: /Mar 3, 2026: 2 events/ });
    await userEvent.hover(column);
    expect(screen.getByRole("status")).toHaveTextContent("2 events");

    await userEvent.click(column);
    expect(onSelectDay).toHaveBeenCalledWith("2026-03-03");
  });
});
