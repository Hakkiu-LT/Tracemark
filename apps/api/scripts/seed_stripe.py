"""One-time helper: create all HAKKIU Stripe Products + Prices and print the
matching `.env` lines.

Run it once against your TEST-mode Stripe account:

    cd apps/api
    STRIPE_SECRET_KEY=sk_test_xxx uv run python scripts/seed_stripe.py

It is safe to re-run: products are matched by name and prices by
(amount, interval, currency), so nothing is duplicated.
Copy the printed block into `.env`.
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

# ── Self-Serve plan (new pricing, EUR, monthly only) ───────────────────────────

SELF_SERVE = {
    # env_var,                          product name,                       amount_eur_cents, interval
    "STRIPE_PRICE_SELF_SERVE_BASE":     ("HAKKIU Self-Serve Base",          84900),
    "STRIPE_PRICE_SELF_SERVE_TM_1":     ("HAKKIU Self-Serve TM Add-on ×1",  14900),
    "STRIPE_PRICE_SELF_SERVE_TM_2":     ("HAKKIU Self-Serve TM Add-on ×2",  26900),
    "STRIPE_PRICE_SELF_SERVE_TM_3":     ("HAKKIU Self-Serve TM Add-on ×3",  34900),
    "STRIPE_PRICE_SELF_SERVE_TM_4":     ("HAKKIU Self-Serve TM Add-on ×4",  46900),
    "STRIPE_PRICE_SELF_SERVE_TM_5":     ("HAKKIU Self-Serve TM Add-on ×5",  57900),
    # Per-unit marketplace add-on: quantity = number of extra marketplaces beyond Amazon.
    "STRIPE_PRICE_SELF_SERVE_MARKETPLACE": ("HAKKIU Self-Serve Marketplace Add-on", 4000),
    "STRIPE_PRICE_SELF_SERVE_DOMAIN":   ("HAKKIU Self-Serve Domain Protection", 64900),
}

# ── Legacy plans (USD, kept for backwards-compat) ─────────────────────────────

LEGACY_PLANS = {
    "starter": {"name": "HAKKIU Starter", "monthly_usd": 9900},
    "growth":  {"name": "HAKKIU Growth",  "monthly_usd": 24900},
    "pro":     {"name": "HAKKIU Pro",     "monthly_usd": 59900},
    "agency":  {"name": "HAKKIU Agency",  "monthly_usd": 149900},
}

LEGACY_ADDONS = [
    ("STRIPE_PRICE_ADDON_REGION",           "HAKKIU Add-on: Additional Region",        4900, "month", "usd"),
    ("STRIPE_PRICE_ADDON_DOMAINS",          "HAKKIU Add-on: Domain Tracking (50)",     2900, "month", "usd"),
    ("STRIPE_PRICE_ADDON_REPORTS",          "HAKKIU Add-on: Advanced Reports",         7900, "month", "usd"),
    ("STRIPE_PRICE_ADDON_BRAND",            "HAKKIU Add-on: Extra Brand",              1900, "month", "usd"),
    ("STRIPE_PRICE_ADDON_MANAGED_TAKEDOWN", "HAKKIU Add-on: Managed Takedown",        50000,   None,  "usd"),
]


def find_product(name: str) -> str:
    for product in stripe.Product.list(limit=100, active=True).auto_paging_iter():
        if product.name == name:
            return product.id
    return stripe.Product.create(name=name).id


def find_price(product_id: str, amount: int, interval: str | None, currency: str = "eur") -> str:
    for price in stripe.Price.list(product=product_id, limit=100, active=True).auto_paging_iter():
        same_amount = price.unit_amount == amount
        same_interval = (price.recurring.interval if price.recurring else None) == interval
        same_currency = price.currency == currency
        if same_amount and same_interval and same_currency:
            return price.id
    kwargs = {"product": product_id, "unit_amount": amount, "currency": currency}
    if interval:
        kwargs["recurring"] = {"interval": interval}
    return stripe.Price.create(**kwargs).id


lines: list[str] = ["", "# ── Self-Serve pricing (EUR, monthly) ──────────────"]

for env_var, (product_name, amount_cents) in SELF_SERVE.items():
    product_id = find_product(product_name)
    price_id = find_price(product_id, amount_cents, "month", "eur")
    lines.append(f"{env_var}={price_id}")
    print(f"  {env_var} → {price_id}")

lines.append("")
lines.append("# ── Legacy plans (USD) — keep for existing customers ────")
for plan_key, cfg in LEGACY_PLANS.items():
    product_id = find_product(cfg["name"])
    monthly_id = find_price(product_id, cfg["monthly_usd"], "month", "usd")
    yearly_id  = find_price(product_id, cfg["monthly_usd"] * 10, "year", "usd")
    lines.append(f"STRIPE_PRICE_{plan_key.upper()}_MONTH={monthly_id}")
    lines.append(f"STRIPE_PRICE_{plan_key.upper()}_YEAR={yearly_id}")
    print(f"  STRIPE_PRICE_{plan_key.upper()}_MONTH → {monthly_id}")
    print(f"  STRIPE_PRICE_{plan_key.upper()}_YEAR  → {yearly_id}")

lines.append("")
lines.append("# ── Legacy add-ons (USD) ────────────────────────────────")
for env_var, name, amount, interval, currency in LEGACY_ADDONS:
    product_id = find_product(name)
    price_id = find_price(product_id, amount, interval, currency)
    lines.append(f"{env_var}={price_id}")
    print(f"  {env_var} → {price_id}")

print("\n\n# ── Copy the block below into your .env ──────────────────\n")
print("\n".join(lines))
