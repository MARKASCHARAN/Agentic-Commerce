# Pricing Examples

## Valid

Buyer requests 10 units.

Merchant policy allows:
- quantity >= 10
- maximum discount = 5%

Agent proposes a 3% discount.

Result:
ALLOW

## Invalid

Buyer requests 10 units.

Merchant maximum discount = 5%.

Agent proposes 20%.

Result:
DENY

The agent must not manually clamp the price.
The NegotiationEngine performs the deterministic
calculation.
