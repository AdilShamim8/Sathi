/** Public AI diagnostics. Never includes credentials or provider error bodies. */
export type AIState = "ready" | "not_configured" | "invalid_provider" | "disabled" | "budget_exhausted" | "invalid_key" | "no_credits" | "rate_limited" | "model_unavailable" | "unavailable" | "empty_response" | "safety_rejected";
export interface AIStatus {
  state: AIState;
  provider: "groq" | "openrouter" | "openai" | "z-ai" | null;
  model: string | null;
}

export function aiStatusMessage(status: AIStatus, locale: "en" | "bn"): string {
  const messages: Record<AIState, [string, string]> = {
    ready: ["Online AI is configured. Send a question to test it.", "অনলাইন এআই কনফিগার করা আছে। পরীক্ষা করতে একটি প্রশ্ন করুন।"],
    not_configured: ["Online AI has no server key. Use your own OpenRouter key in Settings, or ask the site owner to enable Groq.", "অনলাইন এআইয়ের সার্ভার কী নেই। সেটিংসে আপনার OpenRouter কী দিন অথবা সাইটের মালিককে Groq চালু করতে বলুন।"],
    invalid_provider: ["The site owner needs to correct the AI provider setting.", "সাইটের মালিককে এআই প্রোভাইডারের সেটিং ঠিক করতে হবে।"],
    disabled: ["Online AI is turned off. The built-in financial answer is available.", "অনলাইন এআই বন্ধ আছে। অ্যাপের নিজস্ব আর্থিক উত্তর পাওয়া যাচ্ছে।"],
    budget_exhausted: ["The site's daily AI limit has been reached. The built-in answer is shown.", "সাইটের দৈনিক এআই সীমা শেষ হয়েছে। অ্যাপের নিজস্ব উত্তর দেখানো হচ্ছে।"],
    invalid_key: ["The AI provider rejected the server key. The site owner needs to replace it.", "এআই প্রোভাইডার সার্ভার কী গ্রহণ করেনি। সাইটের মালিককে কী বদলাতে হবে।"],
    no_credits: ["The AI account needs credits or a free model. The built-in answer is shown.", "এআই অ্যাকাউন্টে ক্রেডিট অথবা ফ্রি মডেল দরকার। অ্যাপের নিজস্ব উত্তর দেখানো হচ্ছে।"],
    rate_limited: ["The AI provider's usage limit was reached. Try again later; the built-in answer is shown.", "এআই প্রোভাইডারের ব্যবহারের সীমা শেষ হয়েছে। পরে চেষ্টা করুন; অ্যাপের নিজস্ব উত্তর দেখানো হচ্ছে।"],
    model_unavailable: ["The selected AI model is unavailable. The site owner needs to choose another model.", "নির্বাচিত এআই মডেল পাওয়া যাচ্ছে না। সাইটের মালিককে অন্য মডেল বেছে নিতে হবে।"],
    unavailable: ["Online AI could not be reached. The built-in answer is shown.", "অনলাইন এআইয়ের সাথে যোগাযোগ করা যায়নি। অ্যাপের নিজস্ব উত্তর দেখানো হচ্ছে।"],
    empty_response: ["Online AI returned no usable text. The built-in answer is shown.", "অনলাইন এআই ব্যবহারযোগ্য উত্তর দেয়নি। অ্যাপের নিজস্ব উত্তর দেখানো হচ্ছে।"],
    safety_rejected: ["The AI reply did not pass the financial checks. The built-in answer is shown.", "এআইয়ের উত্তর আর্থিক যাচাইয়ে উত্তীর্ণ হয়নি। অ্যাপের নিজস্ব উত্তর দেখানো হচ্ছে।"],
  };
  return messages[status.state]?.[locale === "bn" ? 1 : 0] ?? messages.unavailable[locale === "bn" ? 1 : 0];
}
