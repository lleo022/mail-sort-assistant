import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";
import { archiveEmail, sendReply } from "@/lib/gmail";

export async function POST(request) {
  const session = await getServerSession(authOptions);

  if (!session?.accessToken) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const { action, messageId, threadId, to, subject, replyBody } = body;

  try {
    if (action === "archive") {
      await archiveEmail(session.accessToken, messageId);
      return Response.json({ success: true, action: "archived" });
    }

    if (action === "send") {
      await sendReply(session.accessToken, {
        to,
        subject,
        body: replyBody,
        threadId,
        messageId,
      });
      return Response.json({ success: true, action: "sent" });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("Action failed:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}