import { useEffect, useState } from "react";
import { getSocket } from "./socket";

/**
 * `giveUp` is true once socket.io-client exhausts its bounded reconnection
 * attempts (see socket.ts's `reconnectionAttempts`) and fires
 * `reconnect_failed`. Distinct from `!connected` (which is also true while
 * actively retrying) so callers can stop claiming "reconnecting…" once
 * that's no longer actually happening — a still-live app is otherwise
 * lying about live status indefinitely.
 */
export function useSocketStatus(): { connected: boolean; giveUp: boolean } {
  const [connected, setConnected] = useState<boolean>(() => {
    try {
      return getSocket().connected;
    } catch {
      return false;
    }
  });
  const [giveUp, setGiveUp] = useState(false);

  useEffect(() => {
    const socket = getSocket();
    setConnected(socket.connected);
    const onConnect = () => {
      setConnected(true);
      setGiveUp(false);
    };
    const onDisconnect = () => setConnected(false);
    const onReconnectAttempt = () => setConnected(false);
    const onReconnectFailed = () => setGiveUp(true);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.io.on("reconnect", onConnect);
    socket.io.on("reconnect_attempt", onReconnectAttempt);
    socket.io.on("reconnect_failed", onReconnectFailed);
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.io.off("reconnect", onConnect);
      socket.io.off("reconnect_attempt", onReconnectAttempt);
      socket.io.off("reconnect_failed", onReconnectFailed);
    };
  }, []);

  return { connected, giveUp };
}
