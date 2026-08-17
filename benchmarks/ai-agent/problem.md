# Customer support assistant

We want an AI assistant to handle common customer-support conversations. It can search our
help center, look up a customer's orders and account, explain policies, draft a response, and
sometimes act: cancel an unshipped order, correct a delivery address, or issue a goodwill
refund up to $50. Higher-value or unusual cases must go to a person with a useful summary.

Customers may ask several related questions over a long conversation and refer to earlier
details. The assistant must not reveal another customer's data, invent an order state, or take
an action the current support agent could not take. Retrying after a timeout must not issue a
refund twice. Customers can request deletion of conversation data.

We expect 100,000 conversations a day. The first useful response should normally arrive in
four seconds, and average model cost should stay below $0.04 per resolved conversation. If the
AI provider, search, or an action system is unavailable, the customer still needs a clear next
step rather than a confident guess.

We have 2,000 resolved conversations for initial testing, but many contain private data and
historical agent mistakes. We have not settled when the assistant may answer automatically,
what quality level is sufficient for launch, how long conversation memory should last, or
whether a human must approve every refund.
