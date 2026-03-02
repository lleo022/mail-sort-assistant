"use client";
import { useState } from "react";

const CATEGORY_STYLES = {
  action_needed: {
    bg: "bg-amber-950/40",
    border: "border-amber-500/40",
    badge: "bg-amber-500/20 text-amber-300 border border-amber-500/30",
    label: "Action Needed",
  },
  fyi: {
    bg: "bg-blue-950/30",
    border: "border-blue-500/30",
    badge: "bg-blue-500/20 text-blue-300 border border-blue-500/30",
    label: "FYI",
  },
  promotional: {
    bg: "bg-zinc-900/60",
    border: "border-zinc-700/40",
    badge: "bg-zinc-700/40 text-zinc-400 border border-zinc-600/30",
    label: "Promotional",
  },
  can_delete: {
    bg: "bg-red-950/20",
    border: "border-red-900/30",
    badge: "bg-red-900/30 text-red-400 border border-red-800/30",
    label: "Delete",
  },
};

export default function EmailCard({ email, onAction }) {
  const [editedReply, setEditedReply] = useState(email.draftReply || "");
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(null);
  const [done, setDone] = useState(false);
  const [bodyExpanded, setBodyExpanded] = useState(false);

  const style = CATEGORY_STYLES[email.category] || CATEGORY_STYLES.fyi;

  if (done) return null;

  async function handleAction(action) {
    setLoading(action);
    try {
      const res = await fetch("/api/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          messageId: email.id,
          threadId: email.threadId,
          to: email.from,
          subject: email.subject,
          replyBody: editedReply,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setDone(true);
        onAction?.(email.id, action);
      } else {
        alert("Error: " + data.error);
      }
    } catch (e) {
      alert("Request failed: " + e.message);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className={`rounded-xl border ${style.bg} ${style.border} p-5 mb-3 transition-all duration-300`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm truncate">{email.subject}</p>
          <p className="text-zinc-300 text-xs mt-0.5 truncate">{email.from}</p>
        </div>
        <span className={`text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap ${style.badge}`}>
          {style.label}
        </span>
      </div>

      {/* Snippet */}
      <p className="text-zinc-300 text-xs leading-relaxed mb-1 line-clamp-2">{email.snippet}</p>
      <p className="text-zinc-400 text-xs italic mb-3">{email.reason}</p>

      {/* Expandable full body */}
      {hasBody && (
        <div className="mb-3">
          <button
            onClick={() => setBodyExpanded(!bodyExpanded)}
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <span
              className="inline-block transition-transform duration-200"
              style={{ transform: bodyExpanded ? "rotate(90deg)" : "rotate(0deg)" }}
            >
              ▶
            </span>
            {bodyExpanded ? "Hide email" : "Show full email"}
          </button>

          {bodyExpanded && (
            <div className="mt-2 max-h-64 overflow-y-auto rounded-lg bg-black/30 border border-zinc-700/50 p-3">
              <pre className="text-zinc-300 text-xs leading-relaxed whitespace-pre-wrap font-mono break-words">
                {email.body}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Draft reply (for action_needed) */}
      {email.category === "action_needed" && (
        <div className="mt-3 mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-zinc-400 text-xs uppercase tracking-widest">Draft Reply</span>
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="text-xs text-zinc-300 hover:text-white transition-colors"
            >
              {isEditing ? "Done editing" : "Edit"}
            </button>
          </div>
          {isEditing ? (
            <textarea
              value={editedReply}
              onChange={(e) => setEditedReply(e.target.value)}
              className="w-full bg-black/40 border border-zinc-700 rounded-lg p-3 text-zinc-200 text-sm resize-none focus:outline-none focus:border-zinc-500 transition-colors"
              rows={4}
            />
          ) : (
            <p className="text-zinc-200 text-sm bg-black/30 rounded-lg p-3 border border-zinc-700 whitespace-pre-wrap">
              {editedReply || "No draft available."}
            </p>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2 mt-3 flex-wrap">
        {email.category === "action_needed" && (
          <button
            onClick={() => handleAction("send")}
            disabled={!!loading}
            className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold py-2 px-3 rounded-lg transition-colors"
          >
            {loading === "send" ? "Sending..." : "Send Reply"}
          </button>
        )}
        <button
          onClick={() => handleAction("archive")}
          disabled={!!loading}
          className="flex-1 bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-zinc-200 text-xs font-semibold py-2 px-3 rounded-lg transition-colors"
        >
          {loading === "archive" ? "Archiving..." : "Archive"}
        </button>
        <button
          onClick={() => handleAction("markAsRead")}
          disabled={!!loading}
          className="flex-1 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-300 text-xs font-semibold py-2 px-3 rounded-lg transition-colors"
        >
          {loading === "markAsRead" ? "Marking..." : "Mark as Read"}
        </button>
      </div>
    </div>
  );
}