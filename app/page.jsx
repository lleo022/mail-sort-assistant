"use client";
import { useSession, signIn, signOut } from "next-auth/react";
import { useState } from "react";
import EmailCard from "@/components/EmailCard";

const CATEGORY_ORDER = ["action_needed", "fyi", "promotional", "can_delete"];

export default function Home() {
  const { data: session, status } = useSession();
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(false);
  const [processed, setProcessed] = useState(0);
  const [error, setError] = useState(null);
  const [fetched, setFetched] = useState(false);
  const [emailCount, setEmailCount] = useState(10);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkConfirmStep, setBulkConfirmStep] = useState(0); // 0 = idle, 1 = confirm
  const [retryLoading, setRetryLoading] = useState(false);
  // track which emails are still visible (not actioned)
  const [dismissedIds, setDismissedIds] = useState(new Set());


  async function fetchAndTriage(markCurrentAsRead = false) {
    // If retrying, first mark all currently listed emails as read
    if (markCurrentAsRead && emails.length > 0) {
      setRetryLoading(true);
      const ids = emails.map((e) => e.id);
      try {
        await fetch("/api/actions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "bulkArchive", messageIds: ids }),
        });
      } catch (e) {
        console.error("Failed to mark emails as read before retry:", e);
      }
      setRetryLoading(false);
    }

    setLoading(true);
    setError(null);
    setEmails([]);
    setProcessed(0);
    setDismissedIds(new Set());
    setFetched(false);
    setBulkConfirmStep(0);

    try {
      const res = await fetch(`/api/emails?count=${emailCount}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      setEmails(data.emails || []);
      setFetched(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }


  function handleAction(emailId) {
    setDismissedIds((prev) => new Set([...prev, emailId]));
    setProcessed((p) => p + 1);
  }


  // Perform all actions: archives everything except action_needed emails
  // Does not auto-send replies
  async function handlePerformAll() {
    if (bulkConfirmStep === 0) {
      setBulkConfirmStep(1);
      return;
    }

    // Step 2 confirmed -> actually do it
    setBulkLoading(true);
    setBulkConfirmStep(0);

    const toArchive = emails
      .filter((e) => !dismissedIds.has(e.id) && e.category !== "action_needed")
      .map((e) => e.id);

    try {
      if (toArchive.length > 0) {
        const res = await fetch("/api/actions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "bulkArchive", messageIds: toArchive }),
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
      }

      // Dismiss all non-action-needed cards from the UI
      setDismissedIds((prev) => {
        const next = new Set(prev);
        toArchive.forEach((id) => next.add(id));
        return next;
      });
      setProcessed((p) => p + toArchive.length);
    } catch (e) {
      alert("Bulk action failed: " + e.message);
    } finally {
      setBulkLoading(false);
    }
  }

  function cancelBulk() {
    setBulkConfirmStep(0);
  }


  const total = emails.length;
  const remaining = total - processed;
  const percent = total > 0 ? Math.round((processed / total) * 100) : 0;

  const counts = CATEGORY_ORDER.reduce((acc, cat) => {
    acc[cat] = emails.filter((e) => e.category === cat).length;
    return acc;
  }, {});

  // Emails still visible (not dismissed)
  const visibleEmails = emails.filter((e) => !dismissedIds.has(e.id));
  const nonActionNeededRemaining = visibleEmails.filter(
    (e) => e.category !== "action_needed"
  ).length;

  const bulkButtonLabel = () => {
    if (bulkLoading) return "Processing...";
    if (bulkConfirmStep === 1) return "⚠️ Are you sure? This will archive " + nonActionNeededRemaining + " emails";
    return "Perform All Actions";
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-zinc-400 text-sm tracking-widest">LOADING...</div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-8 px-4">
        <div className="text-center">
          <div className="text-zinc-500 text-xs tracking-[0.3em] uppercase mb-3">Hack on the Hill XIII</div>
          <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">Inbox: Zero</h1>
          <p className="text-zinc-400 text-sm max-w-sm mx-auto leading-relaxed">
            Connect your Gmail. AI sorts everything and drafts your replies. You just hit send.
          </p>
        </div>

        <button
          onClick={() => signIn("google")}
          className="flex items-center gap-3 bg-white text-zinc-900 font-semibold text-sm px-6 py-3 rounded-xl hover:bg-zinc-100 transition-colors"
        >
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
            <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
          </svg>
          Sign in with Google
        </button>

        <p className="text-zinc-500 text-xs text-center max-w-xs">
          Requires access to read and send Gmail. Your emails are never stored. Everything is processed in memory only.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen max-w-2xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Inbox: Zero</h1>
          <p className="text-zinc-400 text-xs mt-0.5">{session.user?.email}</p>
        </div>
        <button
          onClick={() => signOut()}
          className="text-zinc-400 hover:text-zinc-400 text-xs transition-colors"
        >
          Sign out
        </button>
      </div>

      {/* Fetch Controls */}
      {!fetched && (
        <div className="text-center py-16">
          <div className="text-zinc-500 text-6xl mb-6">📬</div>
          <p className="text-zinc-300 text-sm mb-6">
            How many emails do you want to analyze?
          </p>

          {/* Email count selector */}
          <div className="flex items-center justify-center gap-4 mb-8">
            <span className="text-zinc-400 text-sm">Emails to fetch:</span>
            <div className="flex items-center gap-2">
              {[3, 5, 10, 15, 20].map((n) => (
                <button
                  key={n}
                  onClick={() => setEmailCount(n)}
                  className={`w-10 h-10 rounded-lg text-sm font-semibold transition-colors ${
                    emailCount === n
                      ? "bg-white text-zinc-900"
                      : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => fetchAndTriage(false)}
            disabled={loading}
            className="bg-white text-zinc-900 font-bold text-sm px-8 py-3 rounded-xl hover:bg-zinc-200 disabled:opacity-50 transition-colors"
          >
            {loading ? "Analyzing..." : `Fetch & Analyze ${emailCount} Emails`}
          </button>
          {loading && (
            <p className="text-zinc-400 text-xs mt-3 animate-pulse">
              Reading emails + running AI analysis — this takes ~10-15 seconds...
            </p>
          )}
        </div>
      )}

      {error && (
        <div className="bg-red-950/40 border border-red-800/40 rounded-xl p-4 mb-6 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Progress Bar + Bulk Actions */}
      {fetched && total > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex gap-4 text-xs text-zinc-400">
              <span>⚡ {counts.action_needed} action</span>
              <span>📋 {counts.fyi} fyi</span>
              <span>📣 {counts.promotional} promo</span>
              <span>🗑 {counts.can_delete} delete</span>
            </div>
            <span className="text-zinc-400 text-xs">{remaining} left</span>
          </div>
          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden mb-4">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${percent}%` }}
            />
          </div>

          {/* Perform All Actions button — only show if there are non-action-needed emails left */}
          {nonActionNeededRemaining > 0 && (
            <div className="flex gap-2">
              <button
                onClick={handlePerformAll}
                disabled={bulkLoading}
                className={`flex-1 text-xs font-semibold py-2.5 px-4 rounded-lg transition-colors ${
                  bulkConfirmStep === 0
                    ? "bg-zinc-700 hover:bg-zinc-600 text-zinc-200"
                    : bulkConfirmStep === 1
                    ? "bg-amber-700 hover:bg-amber-600 text-white"
                    : "bg-red-700 hover:bg-red-600 text-white"
                } disabled:opacity-50`}
              >
                {bulkButtonLabel()}
              </button>
              {bulkConfirmStep > 0 && (
                <button
                  onClick={cancelBulk}
                  className="px-4 py-2.5 text-xs text-zinc-400 hover:text-zinc-200 bg-zinc-800 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              )}
            </div>
          )}

          {bulkConfirmStep > 0 && (
            <p className="text-zinc-400 text-xs mt-2 text-center">
              {bulkConfirmStep === 1
                ? `This will archive ${nonActionNeededRemaining} emails (FYI, Promotional, Delete). Action Needed emails will not be touched.`
                : "Click the button one more time to confirm. This cannot be undone."}
            </p>
          )}

          {remaining === 0 && (
            <div className="text-center mt-8">
              <div className="text-4xl mb-2">🎉</div>
              <p className="text-emerald-400 font-semibold">Inbox Zero achieved!</p>
              <button
                onClick={() => { setFetched(false); setEmails([]); setProcessed(0); setDismissedIds(new Set()); }}
                className="text-zinc-400 hover:text-zinc-200 text-xs mt-3 underline"
              >
                Start over
              </button>
            </div>
          )}
        </div>
      )}

      {/* Email Cards */}
      {visibleEmails.map((email, i) => (
        <div key={email.id} className="animate-fade-in-up" style={{ animationDelay: `${i * 0.04}s`, opacity: 0 }}>
          <EmailCard email={email} onAction={handleAction} />
        </div>
      ))}

      {fetched && emails.length === 0 && (
        <div className="text-center py-16 text-zinc-400">
          <div className="text-5xl mb-4">✨</div>
          <p>No unread emails found. Already at inbox zero!</p>
        </div>
      )}

      {/* Bottom: Mark all as read and retry */}
      {fetched && emails.length > 0 && (
        <div className="mt-8 pt-6 border-t border-zinc-800 text-center">
          <p className="text-zinc-400 text-xs mb-3">
            Done with this batch? Mark all listed emails as read and fetch the next set.
          </p>
          <button
            onClick={() => fetchAndTriage(true)}
            disabled={retryLoading || loading}
            className="bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-200 text-xs font-semibold py-2.5 px-6 rounded-lg transition-colors"
          >
            {retryLoading ? "Marking as read..." : "Mark All as Read & Retry"}
          </button>
        </div>
      )}
    </div>
  );
}