import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ChatPage } from "@/components/chat/chat-page";
import { CallProvider, useCall } from "@/components/calls/call-provider";
import { CallMediaError, getLocalMedia } from "@/lib/webrtc/media";
import { callService } from "@/services/call.service";
import type { CallHistoryItem } from "@/types/call";
import { FakePeerConnection, FakeSocket, fakeStream, type FakeTrack } from "./call-fakes";
import { makeAuthUser, renderWithProviders } from "./utils";
import { setSearchParams } from "./setup";

const socket = vi.hoisted(() => ({ current: null as unknown }));

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }), Toaster: () => null }));
vi.mock("@/hooks/use-chat-socket", () => ({ useChatSocket: () => ({ socket: socket.current, state: "connected" }) }));
vi.mock("@/lib/webrtc/ice-servers", () => ({ resolveIceServers: vi.fn().mockResolvedValue([{ urls: ["stun:stun.example.com"] }]) }));
vi.mock("@/lib/webrtc/media", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/webrtc/media")>()), getLocalMedia: vi.fn() }));
vi.mock("@/services/call.service", () => ({ callService: { contacts: vi.fn(), history: vi.fn(), iceServers: vi.fn() } }));
vi.mock("@/services/chat.service", () => ({
  chatService: { unread: vi.fn().mockResolvedValue({ count: 0, lastReadAt: null }), markRead: vi.fn(), list: vi.fn() },
}));

const PRIYA = { id: "22222222-2222-4222-8222-222222222222", firstName: "Priya", lastName: "Patel", avatarUrl: null };
const ME = makeAuthUser();

let fake: FakeSocket;
let tracks: FakeTrack[];

// jsdom only accepts its own MediaStream in srcObject; the fakes stand in for real streams.
Object.defineProperty(HTMLMediaElement.prototype, "srcObject", {
  configurable: true,
  get(this: { _src?: unknown }) {
    return this._src ?? null;
  },
  set(this: { _src?: unknown }, value: unknown) {
    this._src = value;
  },
});

beforeEach(() => {
  fake = new FakeSocket();
  socket.current = fake;
  FakePeerConnection.instances = [];
  vi.stubGlobal("RTCPeerConnection", FakePeerConnection);
  vi.mocked(getLocalMedia).mockImplementation(async (type) => {
    const media = fakeStream(type === "VIDEO" ? ["audio", "video"] : ["audio"]);
    tracks = media.tracks;
    return { stream: media.stream, cameraUnavailable: false };
  });
  vi.mocked(callService.contacts).mockResolvedValue([{ ...PRIYA, online: true }]);
  vi.mocked(callService.history).mockResolvedValue([]);
  fake.respond("call:initiate", () => ({ ok: true, data: { id: "call-1", type: "VIDEO", status: "RINGING", caller: ME, receiver: PRIYA } }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** A button that starts a call, standing in for the chat header. */
function Dialer({ type = "VIDEO" as const }: { type?: "VOICE" | "VIDEO" }) {
  const { startCall } = useCall();
  return (
    <button type="button" onClick={() => startCall(PRIYA, type)}>
      dial
    </button>
  );
}

function renderCalls(type: "VOICE" | "VIDEO" = "VIDEO") {
  return renderWithProviders(
    <CallProvider>
      <Dialer type={type} />
    </CallProvider>,
    { user: ME },
  );
}

const callPanel = () => screen.findByRole("dialog", { name: /call with Priya Patel/ });

async function placeCall(type: "VOICE" | "VIDEO" = "VIDEO") {
  const view = renderCalls(type);
  fireEvent.click(screen.getByRole("button", { name: "dial" }));
  await screen.findByText("Ringing…");
  return view;
}

async function connectCall() {
  const view = await placeCall();
  await act(async () => fake.serverEmit("call:accepted", { callId: "call-1" }));
  await waitFor(() => expect(fake.sent("call:offer")).toHaveLength(1));
  const pc = FakePeerConnection.latest();
  await act(async () => fake.serverEmit("call:answer", { callId: "call-1", description: { type: "answer", sdp: "answer-sdp" } }));
  await act(async () => pc.setState("connected"));
  return { view, pc };
}

describe("Outgoing call", () => {
  it("opens the camera, places the call and shows it ringing", async () => {
    await placeCall();
    expect(getLocalMedia).toHaveBeenCalledWith("VIDEO");
    expect(fake.sent("call:initiate")).toEqual([{ receiverId: PRIYA.id, type: "VIDEO" }]);
    const panel = within(await callPanel());
    expect(panel.getByText("Priya Patel")).toBeInTheDocument();
    expect(panel.getByRole("button", { name: "Cancel call" })).toBeInTheDocument();
  });

  it("makes the offer once answered, applies the answer, exchanges ICE, and shows the timer when connected", async () => {
    const { pc } = await connectCall();
    expect(fake.sent("call:offer")).toEqual([{ callId: "call-1", description: { type: "offer", sdp: "offer-sdp" } }]);
    expect(pc.remoteDescription).toEqual({ type: "answer", sdp: "answer-sdp" });
    expect(pc.config.iceServers).toEqual([{ urls: ["stun:stun.example.com"] }]);
    expect(await screen.findByLabelText(/Call duration 00:0\d/)).toBeInTheDocument();
    expect(fake.sent("call:connected")).toEqual([{ callId: "call-1" }]);

    act(() => pc.emitCandidate("candidate:1"));
    expect(fake.sent("call:ice-candidate")).toEqual([{ callId: "call-1", candidate: expect.objectContaining({ candidate: "candidate:1" }) }]);
    await act(async () => fake.serverEmit("call:ice-candidate", { callId: "call-1", candidate: { candidate: "candidate:remote", sdpMid: "0", sdpMLineIndex: 0 } }));
    expect(pc.addedCandidates).toEqual([expect.objectContaining({ candidate: "candidate:remote" })]);
  });

  it("shows why a call could not start when the permission is blocked, without placing it", async () => {
    vi.mocked(getLocalMedia).mockRejectedValueOnce(
      new CallMediaError("MEDIA_PERMISSION_DENIED", "Camera and microphone access is blocked. Allow access in your browser settings and try again."),
    );
    renderCalls();
    fireEvent.click(screen.getByRole("button", { name: "dial" }));
    expect(await screen.findByText(/Camera and microphone access is blocked/)).toBeInTheDocument();
    expect(fake.sent("call:initiate")).toEqual([]);
  });

  it("tells the caller the other person is busy, and releases the camera", async () => {
    fake.respond("call:initiate", () => ({ ok: false, error: { code: "CALL_BUSY", message: "This user is currently on another call.", statusCode: 409 } }));
    renderCalls();
    fireEvent.click(screen.getByRole("button", { name: "dial" }));
    expect(await screen.findByText("This user is currently on another call.")).toBeInTheDocument();
    expect(tracks.every((t) => t.stop.mock.calls.length === 1)).toBe(true);
    expect(screen.getByRole("button", { name: /Call again/ })).toBeInTheDocument();
  });

  it("shows a declined call", async () => {
    await placeCall();
    await act(async () => fake.serverEmit("call:ended", { callId: "call-1", status: "REJECTED", reason: "rejected", durationSeconds: 0 }));
    expect(await screen.findByText("Priya declined the call.")).toBeInTheDocument();
    expect(tracks[0]!.stop).toHaveBeenCalled();
  });

  it("ignores events for a different call", async () => {
    await placeCall();
    await act(async () => fake.serverEmit("call:accepted", { callId: "someone-elses" }));
    await act(async () => fake.serverEmit("call:ended", { callId: "someone-elses", status: "ENDED", reason: "hangup", durationSeconds: 3 }));
    expect(FakePeerConnection.instances).toHaveLength(0);
    expect(screen.getByText("Ringing…")).toBeInTheDocument();
  });
});

describe("Incoming call", () => {
  const ring = (type: "VOICE" | "VIDEO" = "VOICE") =>
    act(async () =>
      fake.serverEmit("call:incoming", {
        call: { id: "call-9", type, status: "RINGING", caller: PRIYA, receiver: ME, startedAt: new Date().toISOString() },
      }),
    );

  it("rings with the caller's name and call type, and accepts: microphone, then accept, then answers the offer", async () => {
    renderCalls();
    await ring("VOICE");
    const card = within(screen.getByRole("alertdialog", { name: "Incoming voice call" }));
    expect(card.getByText("Priya Patel")).toBeInTheDocument();

    fireEvent.click(card.getByRole("button", { name: "Accept" }));
    await waitFor(() => expect(fake.sent("call:accept")).toEqual([{ callId: "call-9" }]));
    expect(getLocalMedia).toHaveBeenCalledWith("VOICE");
    // The connection exists before the accept, so an early offer finds it.
    const pc = FakePeerConnection.latest();
    await act(async () => fake.serverEmit("call:offer", { callId: "call-9", description: { type: "offer", sdp: "remote-offer" } }));
    await waitFor(() => expect(fake.sent("call:answer")).toEqual([{ callId: "call-9", description: { type: "answer", sdp: "answer-sdp" } }]));
    expect(pc.remoteDescription).toEqual({ type: "offer", sdp: "remote-offer" });
    expect(await callPanel()).toBeInTheDocument();
  });

  it("declines", async () => {
    renderCalls();
    await ring();
    fireEvent.click(screen.getByRole("button", { name: "Decline" }));
    expect(fake.sent("call:reject")).toEqual([{ callId: "call-9" }]);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(getLocalMedia).not.toHaveBeenCalled();
  });

  it("stops ringing when the caller gives up, and leaves a missed-call note", async () => {
    renderCalls();
    await ring("VIDEO");
    await act(async () => fake.serverEmit("call:ended", { callId: "call-9", status: "MISSED", reason: "cancelled", durationSeconds: 0 }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(toast).toHaveBeenCalledWith("Missed video call", { description: "from Priya Patel" });
  });

  it("stops ringing when another tab answers", async () => {
    renderCalls();
    await ring();
    await act(async () => fake.serverEmit("call:answered-elsewhere", { callId: "call-9" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("declines for you if the microphone can't be used, and says why", async () => {
    vi.mocked(getLocalMedia).mockRejectedValueOnce(new CallMediaError("MICROPHONE_UNAVAILABLE", "No microphone was found. Connect a microphone and try again."));
    renderCalls();
    await ring();
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    expect(await screen.findByText("No microphone was found. Connect a microphone and try again.")).toBeInTheDocument();
    expect(fake.sent("call:reject")).toEqual([{ callId: "call-9" }]);
  });
});

describe("In a call", () => {
  it("mutes and unmutes the microphone, and tells the other side", async () => {
    await connectCall();
    fireEvent.click(screen.getByRole("button", { name: "Mute microphone" }));
    expect(tracks.find((t) => t.kind === "audio")!.enabled).toBe(false);
    expect(screen.getByRole("button", { name: "Unmute microphone" })).toHaveAttribute("aria-pressed", "true");
    expect(fake.sent("call:media-state").at(-1)).toEqual({ callId: "call-1", state: { muted: true, cameraOff: false } });
    fireEvent.click(screen.getByRole("button", { name: "Unmute microphone" }));
    expect(tracks.find((t) => t.kind === "audio")!.enabled).toBe(true);
  });

  it("turns the camera off and on", async () => {
    await connectCall();
    fireEvent.click(screen.getByRole("button", { name: "Turn camera off" }));
    expect(tracks.find((t) => t.kind === "video")!.enabled).toBe(false);
    expect(screen.getByText("Camera off")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Turn camera on" }));
    expect(tracks.find((t) => t.kind === "video")!.enabled).toBe(true);
  });

  it("shows when the other person is muted", async () => {
    await connectCall();
    await act(async () => fake.serverEmit("call:media-state", { callId: "call-1", state: { muted: true, cameraOff: true } }));
    expect(screen.getByText("Camera is off")).toBeInTheDocument();
    expect(screen.getByText(/Priya is muted/)).toBeInTheDocument();
  });

  it("ends the call and releases everything: tracks stopped, connection closed", async () => {
    const { pc } = await connectCall();
    fireEvent.click(screen.getByRole("button", { name: "End call" }));
    expect(fake.sent("call:end")).toEqual([{ callId: "call-1" }]);
    expect(pc.closed).toBe(true);
    expect(pc.onicecandidate).toBeNull();
    expect(tracks.every((t) => t.stop.mock.calls.length === 1)).toBe(true);
    expect(await screen.findByText("Call ended.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Close/ }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("fails the call with a clear message when the connection can't be made", async () => {
    const { pc } = await connectCall();
    await act(async () => pc.setState("failed"));
    expect(await screen.findByText("Unable to connect the call. Check your internet connection and try again.")).toBeInTheDocument();
    expect(fake.sent("call:end")).toEqual([{ callId: "call-1", reason: "failed" }]);
    expect(pc.closed).toBe(true);
  });

  it("can be minimized and expanded without dropping the call", async () => {
    await connectCall();
    fireEvent.click(screen.getByRole("button", { name: "Minimize call" }));
    const bar = within(screen.getByRole("region", { name: "Call with Priya Patel" }));
    fireEvent.click(bar.getByRole("button", { name: "Expand call" }));
    expect(await callPanel()).toBeInTheDocument();
    expect(FakePeerConnection.latest().closed).toBe(false);
  });

  it("hangs up and releases the camera if the app unmounts mid-call (sign out, closing the tab)", async () => {
    const { view, pc } = await connectCall();
    const listeners = fake.listenerCount();
    expect(listeners).toBeGreaterThan(0);
    view.unmount();
    expect(fake.sent("call:end")).toEqual([{ callId: "call-1" }]);
    expect(pc.closed).toBe(true);
    expect(tracks.every((t) => t.stop.mock.calls.length >= 1)).toBe(true);
    expect(fake.listenerCount()).toBe(0);
  });
});

describe("Calls in Chat", () => {
  const history: CallHistoryItem[] = [
    {
      id: "h1", type: "VOICE", status: "ENDED", direction: "outgoing", caller: ME, receiver: PRIYA,
      startedAt: "2026-09-30T09:00:00.000Z", answeredAt: "2026-09-30T09:00:05.000Z", connectedAt: "2026-09-30T09:00:06.000Z", endedAt: "2026-09-30T09:04:38.000Z", durationSeconds: 272,
    },
    {
      id: "h2", type: "VIDEO", status: "MISSED", direction: "incoming", caller: PRIYA, receiver: ME,
      startedAt: "2026-09-30T10:00:00.000Z", answeredAt: null, connectedAt: null, endedAt: "2026-09-30T10:00:45.000Z", durationSeconds: 0,
    },
  ];

  it("offers voice and video calls in a real person's conversation, and shows past calls in it", async () => {
    vi.mocked(callService.history).mockResolvedValue(history);
    setSearchParams({ c: `dm-${PRIYA.id}` });
    renderWithProviders(
      <CallProvider>
        <ChatPage />
      </CallProvider>,
      { user: ME },
    );
    const pane = within(await screen.findByRole("region", { name: "Conversation" }));
    expect(await pane.findByRole("button", { name: "Start a voice call with Priya" })).toBeInTheDocument();
    expect(pane.getByRole("button", { name: "Start a video call with Priya" })).toBeInTheDocument();
    expect(await pane.findByText("Voice call")).toBeInTheDocument();
    expect(pane.getByText(/4 min 32 sec/)).toBeInTheDocument();
    expect(pane.getByText("Missed video call")).toBeInTheDocument();
    expect(callService.history).toHaveBeenCalledWith(PRIYA.id);

    fireEvent.click(pane.getByRole("button", { name: "Start a voice call with Priya" }));
    await waitFor(() => expect(fake.sent("call:initiate")).toEqual([{ receiverId: PRIYA.id, type: "VOICE" }]));
  });

  it("lists real team members in the chat list, with video calling right from the row", async () => {
    setSearchParams();
    renderWithProviders(
      <CallProvider>
        <ChatPage />
      </CallProvider>,
      { user: ME },
    );
    const nav = within(screen.getByRole("navigation", { name: "Channels and direct messages" }));
    fireEvent.click(await nav.findByRole("button", { name: "Start a video call with Priya" }));
    await waitFor(() => expect(fake.sent("call:initiate")).toEqual([{ receiverId: PRIYA.id, type: "VIDEO" }]));
    // The sample contacts aren't in Team: they can't be called.
    expect(nav.queryByRole("button", { name: /Start a video call with Rahul/ })).not.toBeInTheDocument();
  });

  it("shows the call buttons disabled, with the reason, for the sample conversations", async () => {
    setSearchParams({ c: "dm-user-1" });
    renderWithProviders(
      <CallProvider>
        <ChatPage />
      </CallProvider>,
      { user: ME },
    );
    const pane = within(await screen.findByRole("region", { name: "Conversation" }));
    expect(await pane.findByRole("heading", { name: "Rahul Sharma" })).toBeInTheDocument();
    const video = pane.getByRole("button", { name: "Start a video call with Rahul" });
    expect(video).toBeDisabled();
    expect(video).toHaveAttribute("title", expect.stringMatching(/real team members/));
    expect(pane.getByRole("button", { name: "Start a voice call with Rahul" })).toBeDisabled();
  });
});
