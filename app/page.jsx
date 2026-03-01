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

  async function fetchAndTriage() {
    setLoading(true);
    setError(null);
    setEmails([]);
    setProcessed(0);
    setFetched(false);

    try {
      const res = await fetch("/api/emails");
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
    setProcessed((p) => p + 1);
  }

  const total = emails.length;
  const remaining = total - processed;
  const percent = total > 0 ? Math.round((processed / total) * 100) : 0;

  const counts = CATEGORY_ORDER.reduce((acc, cat) => {
    acc[cat] = emails.filter((e) => e.category === cat).length;
    return acc;
  }, {});

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-zinc-600 text-sm tracking-widest">LOADING...</div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-8 px-4">
        <div className="text-center">
          <div className="text-zinc-600 text-xs tracking-[0.3em] uppercase mb-3">Anthropic Hackathon</div>
          <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">Inbox Zero</h1>
          <p className="text-zinc-400 text-sm max-w-sm mx-auto leading-relaxed">
            Connect your Gmail. AI triages everything, drafts your replies. You just hit send.
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

        <p className="text-zinc-700 text-xs text-center max-w-xs">
          Requires access to read and send Gmail. Your emails are never stored — processed in memory only.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen max-w-2xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Inbox Zero</h1>
          <p className="text-zinc-500 text-xs mt-0.5">{session.user?.email}</p>
        </div>
        <button
          onClick={() => signOut()}
          className="text-zinc-600 hover:text-zinc-400 text-xs transition-colors"
        >
          Sign out
        </button>
      </div>

      {/* Fetch Button */}
      {!fetched && (
        <div className="text-center py-16">
          <div className="text-zinc-600 text-6xl mb-6">📬</div>
          <p className="text-zinc-400 text-sm mb-6">
            Ready to triage your last 20 unread emails.
          </p>
          <button
            onClick={fetchAndTriage}
            disabled={loading}
            className="bg-white text-zinc-900 font-bold text-sm px-8 py-3 rounded-xl hover:bg-zinc-200 disabled:opacity-50 transition-colors"
          >
            {loading ? "Analyzing..." : "Fetch & Triage Inbox"}
          </button>
          {loading && (
            <p className="text-zinc-600 text-xs mt-3 animate-pulse">
              Reading emails + running AI triage — this takes ~10-15 seconds...
            </p>
          )}
        </div>
      )}

      {error && (
        <div className="bg-red-950/40 border border-red-800/40 rounded-xl p-4 mb-6 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Progress Bar */}
      {fetched && total > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex gap-4 text-xs text-zinc-500">
              <span>⚡ {counts.action_needed} action</span>
              <span>📋 {counts.fyi} fyi</span>
              <span>📣 {counts.promotional} promo</span>
              <span>🗑 {counts.can_delete} delete</span>
            </div>
            <span className="text-zinc-500 text-xs">{remaining} left</span>
          </div>
          <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${percent}%` }}
            />
          </div>
          {remaining === 0 && (
            <div className="text-center mt-8">
              <div className="text-4xl mb-2">🎉</div>
              <p className="text-emerald-400 font-semibold">Inbox Zero achieved!</p>
              <button
                onClick={() => { setFetched(false); setEmails([]); setProcessed(0); }}
                className="text-zinc-500 hover:text-zinc-300 text-xs mt-3 underline"
              >
                Start over
              </button>
            </div>
          )}
        </div>
      )}

      {/* Email Cards */}
      {emails.map((email, i) => (
        <div key={email.id} className={`animate-fade-in-up`} style={{ animationDelay: `${i * 0.04}s`, opacity: 0 }}>
          <EmailCard email={email} onAction={handleAction} />
        </div>
      ))}

      {fetched && emails.length === 0 && (
        <div className="text-center py-16 text-zinc-600">
          <div className="text-5xl mb-4">✨</div>
          <p>No unread emails found. Already at inbox zero!</p>
        </div>
      )}
    </div>
  );
}