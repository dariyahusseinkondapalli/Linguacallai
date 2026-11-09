import {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
  mediaDevices,
  type MediaStream,
} from "react-native-webrtc";
import type { CallEngine } from "./rtc";
import { setCallMicrophoneActive } from "./capture";
import { audio } from "./audio";
export async function createCallEngine(
  ice: { urls: string | string[]; username?: string; credential?: string }[],
  send: (signal: unknown) => void,
  state: (state: string) => void,
): Promise<CallEngine> {
  const peer = new RTCPeerConnection({
    iceServers: ice,
  }) as RTCPeerConnection & {
    addEventListener(
      type: "icecandidate",
      listener: (event: { candidate: RTCIceCandidate | null }) => void,
    ): void;
    addEventListener(type: "connectionstatechange", listener: () => void): void;
  };
  let stream: MediaStream | undefined;
  let closed = false;
  let muted = false;
  const candidates: ConstructorParameters<typeof RTCIceCandidate>[0][] = [];
  try {
    audio?.beginCall();
    if(audio && !audio.acquireFocus()) throw new Error("Audio is being used by another app.");
    stream = await mediaDevices.getUserMedia({
      audio: {
        deviceId: undefined,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      } as Parameters<typeof mediaDevices.getUserMedia>[0]["audio"],
      video: false,
    });
    for (const track of stream.getTracks()) peer.addTrack(track, stream);
    setCallMicrophoneActive(true);
  } catch (e) {
    audio?.release();
    peer.close();
    throw e;
  }
  peer.addEventListener("icecandidate", (event) => {
    if (event.candidate) send(event.candidate.toJSON());
  });
  peer.addEventListener("connectionstatechange", () => {
    state(peer.connectionState);
  });
  return {
    async offer() {
      if (closed) return;
      const offer = await peer.createOffer({ offerToReceiveAudio: true });
      await peer.setLocalDescription(offer);
      send({ type: offer.type, sdp: offer.sdp });
    },
    async receive(value) {
      const signal = value as {
        type?: "offer" | "answer";
        sdp?: string;
        candidate?: string;
        sdpMid?: string | null;
        sdpMLineIndex?: number | null;
      };
      if (closed) return;
      if (signal.type && signal.sdp) {
        await peer.setRemoteDescription(
          new RTCSessionDescription({ type: signal.type, sdp: signal.sdp }),
        );
        for (const candidate of candidates.splice(0))
          await peer.addIceCandidate(new RTCIceCandidate(candidate));
        if (signal.type === "offer") {
          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          send({ type: answer.type, sdp: answer.sdp });
        }
      } else if (signal.candidate) {
        if (peer.remoteDescription)
          await peer.addIceCandidate(new RTCIceCandidate(signal));
        else candidates.push(signal);
      }
    },
    async suspend() {
      setCallMicrophoneActive(false);
      for (const track of stream?.getTracks() ?? []) track.stop();
      await peer.getSenders()[0]?.replaceTrack(null);
      audio?.release();
    },
    async resume() {
      if (closed) return;
      audio?.beginCall();
      if(audio && !audio.acquireFocus()) throw new Error("Audio focus unavailable.");
      const fresh = await mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      if (closed) {
        fresh.getTracks().forEach((t) => t.stop());
        return;
      }
      stream = fresh;
      setCallMicrophoneActive(true);
      const track = fresh.getAudioTracks()[0];
      track.enabled = !muted;
      await peer.getSenders()[0]?.replaceTrack(track);
    },
    mute(value) {
      muted = value;
      for (const track of stream?.getAudioTracks() ?? [])
        track.enabled = !value;
    },
    close() {
      audio?.release();
      setCallMicrophoneActive(false);
      closed = true;
      for (const track of stream?.getTracks() ?? []) track.stop();
      peer.close();
    },
  };
}
