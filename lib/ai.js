import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const CATEGORIES = ["action_needed", "fyi", "promotional", "can_delete"];

/**
 * Categorize a batch of emails and draft replies for action-needed ones.
 * Returns the emails array with `category` and optionally `draftReply` added.
*/
export async function triageEmails(emails) {
  // uses parallel processing on emails for speed
  const results = await Promise.all(emails.map(triageSingleEmail));
  return results;
}

async function triageSingleEmail(email) {
  const prompt = `You are an email assistant helping someone reach organize their inbox.

Analyze this email and respond with ONLY valid JSON (no markdown, no explanation):

Email:
From: ${email.from}
Subject: ${email.subject}
Date: ${email.date}
Body: ${email.body || email.snippet}

Respond with this exact JSON structure:
{
  "category": "<one of: action_needed | fyi | promotional | can_delete>",
  "reason": "<one sentence explaining why>",
  "draftReply": "<a short, professional reply if category is action_needed, otherwise null>"
}

Category definitions:
- action_needed: requires a response or specific action from the recipient
- fyi: informational, no reply needed (receipts, notifications, newsletters you might want to read)
- promotional: marketing, sales, deals, newsletters you didn't ask for
- can_delete: completely useless, spam, or outdated`;

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001", // fast + cheap for triage
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].text.trim();
    const parsed = JSON.parse(text);

    // Validate category
    if (!CATEGORIES.includes(parsed.category)) {
      parsed.category = "fyi"; 
    }

    return {
      ...email,
      category: parsed.category,
      reason: parsed.reason,
      draftReply: parsed.draftReply || null,
    };
  } catch (err) {
    console.error(`Failed to categorize email ${email.id}:`, err.message);
    // Return email uncategorized rather than crashing
    return {
      ...email,
      category: "fyi",
      reason: "Could not analyze",
      draftReply: null,
    };
  }
}