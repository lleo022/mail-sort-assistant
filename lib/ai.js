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
  const prompt = `You are a strict email triage assistant. Your job is to ruthlessly categorize emails and protect the user's inbox from noise.

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

action_needed: ONLY emails where a real human is directly addressing this specific person and clearly requires a reply or action. Examples: a colleague asking a question, a client making a request, a meeting request, an interview invitation, a landlord or bank asking for something. If there is any doubt it requires action, it does not qualify.

fyi: Transactional emails the user genuinely needs for their records — and nothing else. This means: receipts for purchases they made, shipping confirmations, bank or credit card statements, password reset emails, security alerts, two-factor auth codes, flight or hotel confirmations. Nothing else qualifies as fyi. When in doubt between fyi and promotional, always choose promotional.

promotional: Anything sent in bulk or that has an unsubscribe link. This includes: newsletters (even ones the user subscribed to and enjoys), app or product update emails, sale announcements, discount codes, "we miss you" re-engagement emails, referral programs, social media digests from LinkedIn / Twitter / Facebook / Instagram, job board alerts, survey requests, webinar or event invitations, brand announcements, charity fundraising emails, and any email from a company that is not a direct transactional receipt. If the email could have been sent to more than one person, it is promotional.

can_delete: Spam, phishing, unsolicited cold outreach or sales pitches from people the user does not know, duplicate notifications, automated system alerts with no useful content, bounced message notifications, and any email where the content is entirely irrelevant or outdated.

Tiebreaker rules — follow these exactly:
- fyi vs promotional → always choose promotional
- promotional vs can_delete → choose can_delete if it looks like spam or cold outreach
- When unsure if something is action_needed → it is not, downgrade to fyi or promotional`;

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