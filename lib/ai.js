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
  const prompt = `You are an email assistant whose job is to categorize emails and protect the user's inbox from noise.

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

Category definitions — apply these strictly with a bias toward the more aggressive category when in doubt:

action_needed: ONLY emails where this specific person is being addressed and clearly requires a reply or action.
Examples: a colleague asking a question, a client making a request, a meeting or interview request, a landlord
or bank asking for something.

fyi: Transactional emails the user genuinely needs for their records. This means: receipts for purchases they
made, shipping confirmations, financial statements, security alerts.

promotional: Anything sent in bulk or that has an unsubscribe link. This includes: newsletters, marketing emails,
"we miss you" re-engagement emails, social media digests, and fundraising.

can_delete: Spam, phishing, unsolicited cold outreach or sales pitches from people the user does not know, duplicate
notifications, any email where the content is entirely irrelevant or outdated.

Tiebreaker rules — follow these exactly:
- fyi vs promotional → always choose promotional
- promotional vs can_delete → choose can_delete if it looks like spam
- When unsure if something is action_needed → it is not, downgrade to fyi or promotional`;

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