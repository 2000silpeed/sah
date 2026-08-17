# Merchant payment account

We provide online merchants with card payment acceptance. A merchant can request an approval,
complete some or all of an approved amount, cancel unused approval, and return money after
completion. Requests may be retried by shops or our network without the caller knowing whether
the earlier attempt succeeded.

The same request must never charge twice. Completed value must never exceed approved value,
and returned value must never exceed completed value. Every movement of value must leave a
balanced, auditable accounting record in the currency's smallest unit. Once accepted, that
record cannot be edited; mistakes are corrected with new entries.

The card network may be slow, unavailable, or later reverse a result. A shop needs a response
within three seconds in normal conditions and must be able to ask for the final outcome later.
Daily network reports are compared with our records, and operations staff investigate
differences. We expect 5,000 requests per second at peak.

Card numbers must not enter application logs, and access to value history is tightly limited.
We have not chosen whether to report “pending” after a timeout, how long duplicate request keys
remain valid, or whether cross-currency returns will be supported.
