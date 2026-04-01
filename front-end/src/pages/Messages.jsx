import React from "react";
import useRealtimeStore from "../stores/realtimeStore";

const formatTimestamp = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

function Messages() {
  const messages = useRealtimeStore((state) => state.messages);
  const clearMessages = useRealtimeStore((state) => state.clearMessages);

  return (
    <section className="w-full h-full flex flex-col gap-4 p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Messages</h1>
          <p className="text-sm text-text-secondary">
            Conversations et messages système.
          </p>
        </div>
        <button
          type="button"
          onClick={clearMessages}
          disabled={messages.length === 0}
          className={[
            "w-full rounded-lg border px-3 py-2 text-xs font-semibold sm:w-auto",
            messages.length === 0
              ? "cursor-not-allowed border-border text-text-secondary"
              : "border-secondary text-secondary hover:bg-secondary/10",
          ].join(" ")}
        >
          Tout marquer lu
        </button>
      </div>

      <div className="rounded-xl border border-border bg-surface p-4">
        {messages.length === 0 ? (
          <p className="text-sm text-text-secondary">
            Aucun message pour le moment.
          </p>
        ) : (
          <div className="space-y-3">
            {messages.map((item) => (
              <div
                key={item.id}
                className="rounded-lg border border-border bg-surface/80 px-4 py-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-text-primary">
                    {item.title}
                  </p>
                  <span className="text-[11px] text-text-secondary">
                    {formatTimestamp(item.createdAt)}
                  </span>
                </div>
                {item.message ? (
                  <p className="mt-1 text-xs text-text-secondary">
                    {item.message}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default Messages;
