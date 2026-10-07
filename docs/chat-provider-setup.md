# Enable online chat on the published Sathi app

Sathi always computes its financial answer itself. Optional online AI explains
that answer; financial validation still applies. A free API still needs an
account and key. There is no bundled unlimited, free ChatGPT API.

## Recommended: Groq free tier

1. Create your own API key at https://console.groq.com/keys. Keep it private.
2. In Vercel → your Sathi project → Settings → Environment Variables, add these
   for **Production** (and Preview if you want preview deployments to use AI):

   | Name | Value |
   |---|---|
   | `SATHI_AI_PROVIDER` | `groq` |
   | `SATHI_GROQ_API_KEY` | Your private Groq key |
   | `SATHI_GROQ_MODEL` | `llama-3.3-70b-versatile` |

3. Deploy the code containing this change, then redeploy after changing keys.
   Environment changes do not update an already-running deployment.
4. In Sathi Settings, refresh **Site's online AI**. Turn off **Your own
   OpenRouter key** to use the shared Groq account. Ask “How much can I safely
   spend?” in Copilot. A validated AI answer shows the AI badge; a fallback
   explains why online AI was unavailable or rejected.

Groq's free tier has account/model-specific limits; check
https://console.groq.com/docs/rate-limits and
https://console.groq.com/docs/models for current availability. The default is
configurable so a retired or restricted model can be replaced without code changes.

## Alternatives

| Provider | Selection | Secret | Optional model (default) |
|---|---|---|---|
| OpenRouter free models | `SATHI_AI_PROVIDER=openrouter` | `SATHI_OPENROUTER_API_KEY` | `SATHI_OPENROUTER_MODEL=openrouter/free` |
| OpenAI GPT models | `SATHI_AI_PROVIDER=openai` | `SATHI_OPENAI_API_KEY` | `SATHI_OPENAI_MODEL=gpt-4.1-mini` |

OpenRouter free models still require a key, have limits, and may be busy.
`openrouter/auto` can choose paid models. Existing explicitly saved models remain
unchanged; **Use free models** selects the free router in the personal settings.
See https://openrouter.ai/openrouter/free.

OpenAI API usage requires its own billing setup, separate from a ChatGPT
subscription. This integration uses the API, not the ChatGPT website.

For a personal OpenRouter key, use Sathi Settings → **Your own OpenRouter key**
→ **Use free models** → **Test key**. This key stays in device storage and goes
directly to OpenRouter. When enabled with a key, it skips shared server AI calls.

## Troubleshooting

- **No server key:** add the secret to the correct hosting project/environment
  and redeploy. Adding it to the Codex cloud workspace alone does not configure Vercel.
- **Key rejected:** replace/revoke the key in the provider dashboard and update hosting settings.
- **Usage limit:** wait or adjust account limits. Sathi uses the built-in answer.
- **No credits:** select a free model or configure provider billing.
- **Model unavailable:** select a currently supported model for that provider.
- **Financial check failed:** the AI output was rejected; the computed answer is retained.

`GET /api/ai/status` reports configuration metadata without revealing keys or
making a paid request. “Configured” confirms a key is present; send a Copilot
question to verify its validity, quota, connectivity and financial validation.
Provider failures do not trigger automatic calls to a second account.

Never commit real keys, put them in `NEXT_PUBLIC_*`, or paste them into chat.
Revoke any key previously shared in a conversation. Enabling AI sends the
question and relevant financial evidence to the selected provider.

The Android app loads the hosted Sathi app; shared AI changes take effect after
the website deploys. This change does not rebuild or test an Android APK.
