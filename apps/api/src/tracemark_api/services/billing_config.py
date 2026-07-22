"""Stripe billing configuration.

Single source of truth mapping our canonical plan/add-on keys to Stripe Price
IDs (read from environment variables). Keeping this in one place means the rest
of the billing code never hard-codes a `price_...` string.
"""
from __future__ import annotations

import os

# Canonical plan keys that support self-serve checkout.
SELF_SERVE_PLANS = ("self_serve", "starter", "growth", "pro", "agency")

# Human-facing monthly prices (indicative only — actual charge comes from Stripe).
PLAN_MONTHLY_PRICE = {
    "self_serve": 849,   # EUR — base only; TM + marketplace + domain add-ons on top
    "starter": 99,
    "growth": 249,
    "pro": 599,
    "agency": 1499,
}

# (plan, interval) -> env var holding the Stripe Price ID.
_PLAN_PRICE_ENV = {
    ("self_serve", "month"): "STRIPE_PRICE_SELF_SERVE_BASE",
    # Legacy plans (USD, monthly + annual).
    ("starter", "month"): "STRIPE_PRICE_STARTER_MONTH",
    ("starter", "year"):  "STRIPE_PRICE_STARTER_YEAR",
    ("growth",  "month"): "STRIPE_PRICE_GROWTH_MONTH",
    ("growth",  "year"):  "STRIPE_PRICE_GROWTH_YEAR",
    ("pro",     "month"): "STRIPE_PRICE_PRO_MONTH",
    ("pro",     "year"):  "STRIPE_PRICE_PRO_YEAR",
    ("agency",  "month"): "STRIPE_PRICE_AGENCY_MONTH",
    ("agency",  "year"):  "STRIPE_PRICE_AGENCY_YEAR",
}

# Add-on key -> env var holding the Stripe Price ID.
_ADDON_PRICE_ENV = {
    # Self-Serve TM tiers (mutually exclusive; quantity=1 each).
    "addon_self_serve_tm_1": "STRIPE_PRICE_SELF_SERVE_TM_1",
    "addon_self_serve_tm_2": "STRIPE_PRICE_SELF_SERVE_TM_2",
    "addon_self_serve_tm_3": "STRIPE_PRICE_SELF_SERVE_TM_3",
    "addon_self_serve_tm_4": "STRIPE_PRICE_SELF_SERVE_TM_4",
    "addon_self_serve_tm_5": "STRIPE_PRICE_SELF_SERVE_TM_5",
    # Self-Serve per-unit marketplace (quantity = extra marketplaces beyond Amazon).
    "addon_self_serve_marketplace": "STRIPE_PRICE_SELF_SERVE_MARKETPLACE",
    # Self-Serve domain protection (quantity=1, flat).
    "addon_self_serve_domain": "STRIPE_PRICE_SELF_SERVE_DOMAIN",
    # Legacy add-ons.
    "addon_region":           "STRIPE_PRICE_ADDON_REGION",
    "addon_domains":          "STRIPE_PRICE_ADDON_DOMAINS",
    "addon_reports":          "STRIPE_PRICE_ADDON_REPORTS",
    "addon_brand":            "STRIPE_PRICE_ADDON_BRAND",
    "addon_managed_takedown": "STRIPE_PRICE_ADDON_MANAGED_TAKEDOWN",
    "addon_api_overage":      "STRIPE_PRICE_ADDON_API_OVERAGE",
}

# All add-on keys that flow through subscription-item checkout.
SUBSCRIPTION_ADDONS = (
    "addon_self_serve_tm_1",
    "addon_self_serve_tm_2",
    "addon_self_serve_tm_3",
    "addon_self_serve_tm_4",
    "addon_self_serve_tm_5",
    "addon_self_serve_marketplace",
    "addon_self_serve_domain",
    "addon_region",
    "addon_domains",
    "addon_reports",
    "addon_brand",
)

# Add-ons whose quantity must always be pinned to 1 (flat fee, not per-unit).
_FLAT_ADDONS = (
    "addon_reports",
    "addon_self_serve_tm_1",
    "addon_self_serve_tm_2",
    "addon_self_serve_tm_3",
    "addon_self_serve_tm_4",
    "addon_self_serve_tm_5",
    "addon_self_serve_domain",
)

# The set of mutually-exclusive TM tier keys (only one can be active at a time).
SELF_SERVE_TM_ADDONS: frozenset[str] = frozenset(
    f"addon_self_serve_tm_{n}" for n in range(1, 6)
)


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
