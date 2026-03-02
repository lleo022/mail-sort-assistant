import { google } from "googleapis";

// Google login functionality/authentication via token
export function getGmailClient(accessToken) {
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  auth.setCredentials({ access_token: accessToken });
  return google.gmail({ version: "v1", auth });
}


export async function fetchUnreadEmails(accessToken, maxResults = 20) {
  const gmail = getGmailClient(accessToken); 
  const listRes = await gmail.users.messages.list({
    userId: "me",
    q: "is:unread in:inbox",
    maxResults,
  });
  const messages = listRes.data.messages || [];
  if (messages.length === 0) return [];
  
  const emailDetails = await Promise.all(
    messages.map((msg) =>
      gmail.users.messages.get({
        userId: "me",id: msg.id, format: "full",
      })
    )
  );
  return emailDetails.map((res) => parseEmail(res.data));
}

// parse and clean raws gmail api data
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
    body: body.slice(0, 2000),
  };
}


function extractBody(payload) {
  if (!payload) return "";
  // turn to plaintext
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return Buffer.from(payload.body.data, "base64").toString("utf-8");
  }
  
  // for multipart messages
  if (payload.parts) {
    for (const part of payload.parts) {
      const text = extractBody(part);
      if (text) return text;
    }
  }
  return "";
}


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


export async function sendReply(accessToken, { to, subject, body, threadId, messageId }) {
  const gmail = getGmailClient(accessToken);

  // add "re:" for replies
  const replySubject = subject.startsWith("Re:") ? subject : `Re: ${subject}`;
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
  await markAsRead(accessToken, messageId);

  return { success: true };
}