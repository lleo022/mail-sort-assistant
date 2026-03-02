import { google } from "googleapis";

/**
 * Build an authenticated Gmail client from a session access token.
*/
export function getGmailClient(accessToken) {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  auth.setCredentials({ access_token: accessToken });
  return google.gmail({ version: "v1", auth });
}

/**
 * Fetch the N most recent unread emails from the inbox.
 * Returns an array of parsed email objects.
*/
export async function fetchUnreadEmails(accessToken, maxResults = 20) {
  const gmail = getGmailClient(accessToken);

  // Get list of unread message IDs
  const listRes = await gmail.users.messages.list({
    userId: "me",
    q: "is:unread in:inbox",
    maxResults,
  });

  const messages = listRes.data.messages || [];
  if (messages.length === 0) return [];

  // Fetch full details for each message in parallel
  const emailDetails = await Promise.all(
    messages.map((msg) =>
      gmail.users.messages.get({
        userId: "me",
        id: msg.id,
        format: "full",
      })
    )
  );

  return emailDetails.map((res) => parseEmail(res.data));
}

/**
 * Parse raw Gmail API message into a clean object.
*/
function parseEmail(raw) {
  const headers = raw.payload.headers || [];
  const get = (name) =>
    headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || "";

  const body = extractBody(raw.payload);

  return {
    id: raw.id,
    threadId: raw.threadId,
    subject: get("Subject") || "(no subject)",
    from: get("From"),
    to: get("To"),
    date: get("Date"),
    snippet: raw.snippet,
    body: body.slice(0, 2000), // truncate for AI context window efficiency
  };
}

/**
 * Recursively extract plain text body from Gmail message payload.
*/
function extractBody(payload) {
  if (!payload) return "";

  // Direct plain text body
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return Buffer.from(payload.body.data, "base64").toString("utf-8");
  }

  // Multipart — recurse into parts
  if (payload.parts) {
    for (const part of payload.parts) {
      const text = extractBody(part);
      if (text) return text;
    }
  }

  return "";
}

/**
 * Mark an email as read without archiving it.
 */
export async function markAsRead(accessToken, messageId) {
  const gmail = getGmailClient(accessToken);
  await gmail.users.messages.modify({
    userId: "me",
    id: messageId,
    requestBody: {
      removeLabelIds: ["UNREAD"],
    },
  });
  return { success: true };
}

/**
 * Archive an email (remove INBOX label, keep it in All Mail).
*/
export async function archiveEmail(accessToken, messageId) {
  const gmail = getGmailClient(accessToken);
  await gmail.users.messages.modify({
    userId: "me",
    id: messageId,
    requestBody: {
      removeLabelIds: ["INBOX", "UNREAD"],
    },
  });
  return { success: true };
}

/**
 * Send a reply to an email thread.
 * subject: original subject (will prepend "Re: " if not already there)
 * to: recipient address
 * body: plain text reply body
 * threadId: Gmail thread ID to attach the reply to
 * inReplyToMessageId: original message ID for threading headers
*/
export async function sendReply(accessToken, { to, subject, body, threadId, messageId }) {
  const gmail = getGmailClient(accessToken);

  const replySubject = subject.startsWith("Re:") ? subject : `Re: ${subject}`;

  // Build RFC 2822 email
  const raw = [
    `To: ${to}`,
    `Subject: ${replySubject}`,
    `In-Reply-To: ${messageId}`,
    `References: ${messageId}`,
    "Content-Type: text/plain; charset=utf-8",
    "",
    body,
  ].join("\n");

  const encoded = Buffer.from(raw).toString("base64url");

  await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw: encoded,
      threadId,
    },
  });

  // Also mark the original as read and archive it
  await archiveEmail(accessToken, messageId);

  return { success: true };
}