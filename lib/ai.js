import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const CATEGORIES = ["action_needed", "fyi", "promotional", "can_delete"];

// categorize emails and draft replies

export async function triageEmails(emails) {
  const results = [];
  for (const email of emails) {
    const result = await triageSingleEmail(email);
    results.push(result);
    // TODO: free2play pleb cant run concurrently because rate limits, add delay
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return results;
}

async function triageSingleEmail(email) {
  const prompt = `You are a strict email manager. Your job is to categorize emails and protect the user's inbox from noise.

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

action_needed: ONLY emails where the sender is directly addressing this specific person and clearly requires
a reply or action. Examples: a message from a friend/colleague/client, a meeting/interview invitation, a
landlord or bank asking for something.

fyi: Transactional emails the user genuinely needs for their records. This means: receipts for purchases they
made, shipping confirmations, financial statements, password reset emails, security alerts, travel confirmations.

promotional: Anything sent in bulk or that has an unsubscribe link. This includes: newsletters, app or product
update emails, marketing emails, social media digests, job alerts

can_delete: Spam, phishing, unsolicited cold outreach or sales pitches from people the user does not know, duplicate
notifications, automated system alerts with no useful content, and any email where the content is entirely irrelevant or outdated.

Tiebreaker rules:
- If between fyi vs promotional, choose promotional
- If between promotional vs can_delete, delete if it looks like spam or cold outreach`;

  try {
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    });

    const text = response.content[0].text.trim();
    const cleaned = text.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    const parsed = JSON.parse(cleaned);

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
    return {
      ...email,
      category: "fyi",
      reason: `Analysis failed: ${err.message}`,
      draftReply: null,
    };
  }
}