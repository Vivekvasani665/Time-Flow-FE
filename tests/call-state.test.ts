import { describe, expect, it } from "vitest";
import { callReducer, formatCallDuration, formatTimer, outcomeMessage, type CallSession } from "@/lib/call-state";

const priya = { id: "u-2", firstName: "Priya", lastName: "Patel", avatarUrl: null };

function run(...actions: Parameters<typeof callReducer>[1][]): CallSession | null {
  return actions.reduce<CallSession | null>(callReducer, null);
}

describe("call state machine", () => {
  it("walks an outgoing call from dialing to connected", () => {
    const s = run(
      { type: "dial", peer: priya, callType: "VIDEO" },
      { type: "placed", callId: "c1" },
      { type: "accepted", callId: "c1" },
      { type: "connecting", callId: "c1" },
      { type: "connected", callId: "c1", at: 1000 },
    );
    expect(s).toMatchObject({ phase: "CONNECTED", callId: "c1", direction: "outgoing", connectedAt: 1000 });
  });

  it("ignores events for another call, and duplicates", () => {
    const base = run({ type: "incoming", callId: "c1", peer: priya, callType: "VOICE" });
    expect(callReducer(base, { type: "accepted", callId: "other" })).toBe(base);
    expect(callReducer(base, { type: "finish", callId: "other", phase: "ENDED", message: null })).toBe(base);
    // A second incoming call while one rings is ignored.
    expect(callReducer(base, { type: "incoming", callId: "c2", peer: priya, callType: "VIDEO" })).toBe(base);
    const connected = run({ type: "incoming", callId: "c1", peer: priya, callType: "VOICE" }, { type: "answering", callId: "c1" }, { type: "connected", callId: "c1", at: 5 });
    expect(callReducer(connected, { type: "connected", callId: "c1", at: 99 })!.connectedAt).toBe(5);
  });

  it("never replaces a live call when dialing again, but can after an outcome", () => {
    const live = run({ type: "dial", peer: priya, callType: "VOICE" }, { type: "placed", callId: "c1" });
    expect(callReducer(live, { type: "dial", peer: priya, callType: "VIDEO" })).toBe(live);
    const over = callReducer(live, { type: "finish", callId: "c1", phase: "REJECTED", message: "Priya declined the call." });
    expect(callReducer(over, { type: "dial", peer: priya, callType: "VIDEO" })).toMatchObject({ phase: "OUTGOING", type: "VIDEO" });
  });

  it("toggles mute and camera, but not the camera on a voice call or without one", () => {
    const voice = run({ type: "dial", peer: priya, callType: "VOICE" }, { type: "toggle-mute" }, { type: "toggle-camera" });
    expect(voice).toMatchObject({ muted: true, cameraOff: false });
    const noCamera = run({ type: "dial", peer: priya, callType: "VIDEO" }, { type: "media", cameraUnavailable: true }, { type: "toggle-camera" });
    expect(noCamera).toMatchObject({ cameraOff: true, cameraUnavailable: true });
  });

  it("finishes once and keeps the first outcome", () => {
    const done = run({ type: "dial", peer: priya, callType: "VOICE" }, { type: "finish", callId: null, phase: "FAILED", message: "blocked", error: "MEDIA_PERMISSION_DENIED" });
    expect(done).toMatchObject({ phase: "FAILED", error: "MEDIA_PERMISSION_DENIED" });
    expect(callReducer(done, { type: "finish", callId: null, phase: "ENDED", message: "later" })).toBe(done);
  });

  it("words outcomes from each side", () => {
    const out = { direction: "outgoing" as const, peer: priya };
    const inc = { direction: "incoming" as const, peer: priya };
    expect(outcomeMessage("rejected", out)).toBe("Priya declined the call.");
    expect(outcomeMessage("no_answer", out)).toBe("Priya didn't answer.");
    expect(outcomeMessage("busy", out)).toBe("This user is currently on another call.");
    expect(outcomeMessage("cancelled", inc)).toBeNull();
    expect(outcomeMessage("failed", inc)).toMatch(/Unable to connect the call/);
  });

  it("formats durations", () => {
    expect(formatCallDuration(272)).toBe("4 min 32 sec");
    expect(formatCallDuration(12)).toBe("12 sec");
    expect(formatCallDuration(3720)).toBe("1 hr 2 min");
    expect(formatTimer(65)).toBe("01:05");
    expect(formatTimer(3725)).toBe("1:02:05");
  });
});
