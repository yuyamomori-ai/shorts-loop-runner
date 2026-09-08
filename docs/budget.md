# Monthly spending control

The owner's total target is **JPY 10,000 per month**, including hosting, taxes and currency variation. ShortLOOP reserves JPY 6,000 for its own OpenAI calls and leaves JPY 4,000 for non-AI expenses. This application cannot set or enforce an aggregate invoice cap across independent services or other applications sharing an API key.

`SHORTSLOOP_MONTHLY_TOTAL_JPY=10000`, `SHORTSLOOP_MONTHLY_AI_JPY=6000`, and `SHORTSLOOP_BUDGET_JPY_PER_USD=200` give a USD 30 local AI allowance. The conversion is deliberately conservative and is **not** a current exchange-rate quote. The total target cannot be raised above JPY 10,000 by an environment override. Configure provider spending limits separately, with room for taxes, fees and delayed billing. Do not add credits or increase limits automatically.

Every OpenAI request first reserves funds in a SQLite transaction, before network access. Planning, source/fact verification, visual QA, speech, repairs, benchmarks, and isolated acceptance generation all use the same live store. Existing daily call limits still apply. Known HTTP request rejections release the monetary reservation but count as daily attempts. Timeouts, lost responses and restarts retain the reservation conservatively. A newly started request that would exceed the monthly allocation is rejected locally; the scheduler waits for the next UTC calendar month. Monthly limits reported by OpenAI are handled the same way. Depleted prepaid credit retains the existing six-hour retry interval.

Text generation uses verified standard gpt-5-mini pricing, bounds total output including reasoning, bounds web-search calls, and explicitly requests the default pricing tier. Input/output tokens and search calls are recorded from the response, including unusable/incomplete responses. Missing usage retains the full reservation. GPT-4o mini TTS returns audio without a usage ledger: each sentence of at most 150 characters retains a USD 0.03 conservative allowance, **not a measured charge or a mathematical maximum**. Character-priced legacy TTS models use their documented rates. Unknown models, unknown historical costs or accounting inconsistencies stop new paid operations. Old cost-rate environment variables cannot override verified rates. No historical data is deleted or silently set to zero.

The UI labels these figures as management amounts, including pending reservations, rather than invoices. The safety margin and local ledger do not guarantee a yen-denominated external bill, especially if prices, exchange rates, provider billing timing or other account usage change. Model rates should be reviewed when changing models or when the provider changes prices. Quality and rights checks are never skipped to save money; approved public posting and duplicate-upload protection remain unchanged.

## Required account settings

- OpenAI: start with a small prepaid purchase (minimum USD 5), **disable auto-recharge** during setup, and configure an enforced monthly organization/project spend limit. A budget alert alone does not stop usage. Do not treat prepaid balance as an instantaneous hard stop; delayed accounting can create a small negative balance.
- Railway (the actual current runner host): configure a workspace **Compute Usage hard limit**, not just an email alert; keep room for subscriptions, persistent storage, taxes and other charges not covered by that limit. The connector used for deployment does not expose billing-limit changes, so the owner must set the account limit in the dashboard. Stopping compute also stops scheduling and rendering.
- OpenAI API credit purchases require a supported standard credit/debit card; prepaid cards are not accepted. A debit card still involves registering a card. No card-free self-service deposit method was verified. ShortLOOP never handles card details or buys credits.

Official references checked 2026-09-08:
- https://developers.openai.com/api/docs/guides/spend-limits
- https://developers.openai.com/api/docs/models/gpt-5-mini
- https://developers.openai.com/api/docs/models/gpt-4o-mini-tts
- https://developers.openai.com/api/docs/pricing
- https://help.openai.com/en/articles/8264644-how-can-i-set-up-prepaid-billing
- https://help.openai.com/en/articles/7232916-why-was-my-credit-card-declined
- https://docs.railway.com/pricing/cost-control
