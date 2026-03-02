import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { fetchUnreadEmails } from "@/lib/gmail";
import { triageEmails } from "@/lib/ai";

export async function GET(request) {
  // Get the current user's session (includes their access token)
  const session = await getServerSession(authOptions);

  if (!session?.accessToken) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

// TODO:
  // 1. pull unread emails
  // 2. let ai do the work
  // 3. sort by importance
  try {
    // 1.
    const { searchParams } = new URL(request.url);
    const count = Math.min(parseInt(searchParams.get("count") || "10"), 20);
    const emails = await fetchUnreadEmails(session.accessToken, count);

    if (emails.length === 0) {
      return Response.json({ emails: [], message: "No unread emails found!" });
    }

    // 2.
    const sorted = await triageEmails(emails);

    // 3.
    const order = ["action_needed", "fyi", "promotional", "can_delete"];
    sorted.sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category));

    return Response.json({ emails: sorted });
  } catch (err) {
    console.error("Error fetching/sorting emails:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}