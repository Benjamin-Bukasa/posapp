import { useEffect, useMemo, useRef, useState } from "react";
import { connectSocket } from "../services/socket";

const normalizeEvents = (events) => {
  if (!events) return [];
  return Array.isArray(events) ? events.filter(Boolean) : [events].filter(Boolean);
};

export const useRealtimeRefetch = (events, onRefetch) => {
  const [tick, setTick] = useState(0);
  const eventsKey = useMemo(
    () => normalizeEvents(events).join("|"),
    [events]
  );
  const eventsList = useMemo(() => normalizeEvents(events), [eventsKey]);
  const refetchRef = useRef(onRefetch);

  useEffect(() => {
    refetchRef.current = onRefetch;
  }, [onRefetch]);

  useEffect(() => {
    if (!eventsList.length) return;
    if (!window.localStorage.getItem("token")) return;

    const socket = connectSocket();
    const handler = (payload) => {
      if (typeof refetchRef.current === "function") {
        refetchRef.current(payload);
      }
      setTick((prev) => prev + 1);
    };

    eventsList.forEach((eventName) => socket.on(eventName, handler));

    return () => {
      eventsList.forEach((eventName) => socket.off(eventName, handler));
    };
  }, [eventsKey, eventsList]);

  return tick;
};
