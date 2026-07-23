"""One-time helper: create all HAKKIU Stripe Products + Prices and print the
matching `.env` lines.

Run it once against your TEST-mode Stripe account:

    cd apps/api
    STRIPE_SECRET_KEY=sk_test_xxx uv run python scripts/seed_stripe.py

It is safe to re-run: products are matched by name and prices by
(amount, interval), so nothing is duplicated. Copy the printed block into `.env`.
"""
import os
import sys

import stripe

key = os.environ.get("STRIPE_SECRET_KEY")
if not key or not key.startswith("sk_"):
    sys.exit("Set STRIPE_SECRET_KEY (test mode, starts with sk_test_) and re-run.")
if key.startswith("sk_live_"):
    sys.exit("Refusing to run against a LIVE key. Use a test key (sk_test_).")
stripe.api_key = key

# amounts are in cents. Yearly = monthly * 10 (~2 months free).
PLANS = {
    "starter": {"name": "HAKKIU Starter", "monthly": 9900},
    "growth": {"name": "HAKKIU Growth", "monthly": 24900},
    "pro": {"name": "HAKKIU Pro", "monthly": 59900},
    "agency": {"name": "HAKKIU Agency", "monthly": 149900},
}

# (env_var, product name, amount, recurring interval or None for one-off)
ADDONS = [
    ("STRIPE_PRICE_ADDON_REGION", "HAKKIU Add-on: Additional Region", 4900, "month"),
    ("STRIPE_PRICE_ADDON_DOMAINS", "HAKKIU Add-on: Domain Tracking (50)", 2900, "month"),
    ("STRIPE_PRICE_ADDON_REPORTS", "HAKKIU Add-on: Advanced Reports", 7900, "month"),
    ("STRIPE_PRICE_ADDON_BRAND", "HAKKIU Add-on: Extra Brand", 1900, "month"),
    ("STRIPE_PRICE_ADDON_MANAGED_TAKEDOWN", "HAKKIU Add-on: Managed Takedown", 50000, None),
]


def find_product(name: str) -> str:
    for product in stripe.Product.list(limit=100, active=True).auto_paging_iter():
        if product.name == name:
            return product.id
    return stripe.Product.create(name=name).id


def find_price(product_id: str, amount: int, interval: str | None) -> str:
    for price in stripe.Price.list(product=product_id, limit=100, active=True).auto_paging_iter():
        same_amount = price.unit_amount == amount
        same_interval = (price.recurring.interval if price.recurring else None) == interval
        if same_amount and same_interval:
            return price.id
    kwargs = {"product": product_id, "unit_amount": amount, "currency": "usd"}
    if interval:
        kwargs["recurring"] = {"interval": interval}
    return stripe.Price.create(**kwargs).id


lines: list[str] = []

for plan_key, cfg in PLANS.items():
    product_id = find_product(cfg["name"])
    monthly_id = find_price(product_id, cfg["monthly"], "month")
    yearly_id = find_price(product_id, cfg["monthly"] * 10, "year")
    lines.append(f"STRIPE_PRICE_{plan_key.upper()}_MONTH={monthly_id}")
    lines.append(f"STRIPE_PRICE_{plan_key.upper()}_YEAR={yearly_id}")

for env_var, name, amount, interval in ADDONS:
    product_id = find_product(name)
    price_id = find_price(product_id, amount, interval)
    lines.append(f"{env_var}={price_id}")

print("\n# ---- Copy the lines below into your .env ----\n")
print("\n".join(lines))
print("\n# (API overage add-on needs a Stripe Billing Meter — set up separately.)")
