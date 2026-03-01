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

  try {
    // 1. Pull unread emails from Gmail
    const emails = await fetchUnreadEmails(session.accessToken, 20);

    if (emails.length === 0) {
      return Response.json({ emails: [], message: "No unread emails found!" });
    }

    // 2. Run AI triage on all of them
    const triaged = await triageEmails(emails);

    // 3. Sort: action_needed first, then fyi, promotional, can_delete
    const order = ["action_needed", "fyi", "promotional", "can_delete"];
    triaged.sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category));

    return Response.json({ emails: triaged });
  } catch (err) {
    console.error("Error fetching/triaging emails:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}