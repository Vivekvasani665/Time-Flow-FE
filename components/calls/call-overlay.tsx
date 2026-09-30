"use client";

import { ActiveCall } from "./active-call";
import { useCall } from "./call-provider";
import { IncomingCall } from "./incoming-call";

/** Whatever the call needs on screen right now: the ringing card, or the call itself. */
export function CallOverlay() {
  const call = useCall();
  const { session } = call;
  if (!session) return null;

  if (session.direction === "incoming" && (session.phase === "RINGING" || (session.phase === "ACCEPTED" && !call.localStream))) {
    return <IncomingCall session={session} onAccept={call.accept} onDecline={call.reject} />;
  }

  return (
    <ActiveCall
      session={session}
      localStream={call.localStream}
      remoteStream={call.remoteStream}
      remoteMedia={call.remoteMedia}
      onEnd={call.end}
      onToggleMute={call.toggleMute}
      onToggleCamera={call.toggleCamera}
      onDismiss={call.dismiss}
      onCallAgain={() => {
        call.dismiss();
        call.startCall(session.peer, session.type);
      }}
    />
  );
}
