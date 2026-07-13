"""Stripe billing configuration.

Single source of truth mapping our canonical plan/add-on keys to Stripe Price
IDs (read from environment variables). Keeping this in one place means the rest
of the billing code never hard-codes a `price_...` string.
"""

from __future__ import annotations

import os

# Canonical plan keys that support self-serve checkout (Enterprise is sales-led).
SELF_SERVE_PLANS = ("starter", "growth", "pro", "agency")

# Human-facing monthly prices in USD — used for validation / display only.
# The real amount charged always comes from the Stripe Price object.
PLAN_MONTHLY_PRICE = {
    "starter": 99,
    "growth": 249,
    "pro": 599,
    "agency": 1499,
}

# (plan, interval) -> env var holding the Stripe Price ID.
_PLAN_PRICE_ENV = {
    ("starter", "month"): "STRIPE_PRICE_STARTER_MONTH",
    ("starter", "year"): "STRIPE_PRICE_STARTER_YEAR",
    ("growth", "month"): "STRIPE_PRICE_GROWTH_MONTH",
    ("growth", "year"): "STRIPE_PRICE_GROWTH_YEAR",
    ("pro", "month"): "STRIPE_PRICE_PRO_MONTH",
    ("pro", "year"): "STRIPE_PRICE_PRO_YEAR",
    ("agency", "month"): "STRIPE_PRICE_AGENCY_MONTH",
    ("agency", "year"): "STRIPE_PRICE_AGENCY_YEAR",
}

# Add-on key -> env var holding the Stripe Price ID.
# region/domains/reports/brand are recurring quantity add-ons handled in v1.
# managed_takedown (one-off) and api_overage (metered) are Phase F.
_ADDON_PRICE_ENV = {
    "addon_region": "STRIPE_PRICE_ADDON_REGION",
    "addon_domains": "STRIPE_PRICE_ADDON_DOMAINS",
    "addon_reports": "STRIPE_PRICE_ADDON_REPORTS",
    "addon_brand": "STRIPE_PRICE_ADDON_BRAND",
    "addon_managed_takedown": "STRIPE_PRICE_ADDON_MANAGED_TAKEDOWN",
    "addon_api_overage": "STRIPE_PRICE_ADDON_API_OVERAGE",
}

# Add-ons that flow through the standard subscription-item checkout (v1).
SUBSCRIPTION_ADDONS = ("addon_region", "addon_domains", "addon_reports", "addon_brand")

# Add-ons whose quantity should always be pinned to 1 (flat fee, not per-unit).
_FLAT_ADDONS = ("addon_reports",)


def get_plan_price_id(plan: str, interval: str) -> str:
    """Return the Stripe Price ID for a (plan, interval) pair or raise ValueError."""
    env_name = _PLAN_PRICE_ENV.get((plan, interval))
    if env_name is None:
        raise ValueError(f"Unknown plan/interval combination: {plan}/{interval}")
    price_id = os.environ.get(env_name)
    if not price_id:
        raise ValueError(f"Missing env var {env_name} for plan {plan} ({interval})")
    return price_id


def get_addon_price_id(addon_key: str) -> str:
    """Return the Stripe Price ID for an add-on key or raise ValueError."""
    env_name = _ADDON_PRICE_ENV.get(addon_key)
    if env_name is None:
        raise ValueError(f"Unknown add-on: {addon_key}")
    price_id = os.environ.get(env_name)
    if not price_id:
        raise ValueError(f"Missing env var {env_name} for add-on {addon_key}")
    return price_id


def normalize_addon_quantity(addon_key: str, quantity: int) -> int:
    """Flat add-ons are always quantity 1; per-unit add-ons must be >= 1."""
    if addon_key in _FLAT_ADDONS:
        return 1
    return max(1, int(quantity))


def price_id_to_plan(price_id: str) -> tuple[str, str] | None:
    """Reverse lookup: given a Stripe Price ID, return (plan, interval).

    Used by the webhook to figure out which plan a subscription maps to.
    """
    for (plan, interval), env_name in _PLAN_PRICE_ENV.items():
        if os.environ.get(env_name) == price_id:
            return plan, interval
    return None


def price_id_to_addon(price_id: str) -> str | None:
    """Reverse lookup: given a Stripe Price ID, return the add-on key."""
    for addon_key, env_name in _ADDON_PRICE_ENV.items():
        if os.environ.get(env_name) == price_id:
            return addon_key
    return None
