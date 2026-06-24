from __future__ import annotations

from datetime import datetime, timezone
from typing import Literal, Optional

from pydantic import BaseModel

from tracemark_api.services.ai import Evidence, Decision
from tracemark_api.services.database import get_supabase


# ---------------------------------------------------------------------------
# Pydantic Model
# ---------------------------------------------------------------------------

class TakedownReport(BaseModel):
    id: Optional[str] = None
    platform: str
    platform_category: Literal[
        "marketplace", "social_media", "search_engine",
        "ad_platform", "domain_registrar", "app_store", "other",
    ]
    infringing_url: str
    submission_url: Optional[str] = None
    submission_method: Literal["web_form", "email", "api", "udrp"]
    submission_email: Optional[str] = None
    notice_text: str
    status: str = "pending"


# ---------------------------------------------------------------------------
# Platform Registry — submission URL + method for every supported platform
# ---------------------------------------------------------------------------

PLATFORM_REGISTRY: dict[str, dict] = {
    # Marketplaces
    "amazon": {
        "category": "marketplace",
        "submission_url": "https://www.amazon.com/report/infringement",
        "submission_method": "web_form",
    },
    "ebay": {
        "category": "marketplace",
        "submission_url": "https://contact.ebay.com/ws/eBayISAPI.dll?ReportIPInfringement",
        "submission_method": "web_form",
    },
    "etsy": {
        "category": "marketplace",
        "submission_url": "https://www.etsy.com/report-infringement",
        "submission_method": "web_form",
    },
    "alibaba": {
        "category": "marketplace",
        "submission_url": "https://ipp.aidcgroup.net",
        "submission_method": "web_form",
    },
    "aliexpress": {
        "category": "marketplace",
        "submission_url": "https://ipp.aidcgroup.net/complaint/onlineForm/online.htm",
        "submission_method": "web_form",
    },
    "shopify": {
        "category": "marketplace",
        "submission_url": "https://www.shopify.com/legal/trademark",
        "submission_method": "web_form",
    },
    "walmart": {
        "category": "marketplace",
        "submission_url": "https://www.walmart.com/help/article/report-intellectual-property-infringement/819fb2fcbf7843e2919706cafc10ef00",
        "submission_method": "web_form",
    },
    "wish": {
        "category": "marketplace",
        "submission_url": "https://www.wish.com/legal/ip-policy",
        "submission_method": "web_form",
    },
    "temu": {
        "category": "marketplace",
        "submission_url": "https://www.temu.com/ip-infringement-report.html",
        "submission_method": "web_form",
    },
    "redbubble": {
        "category": "marketplace",
        "submission_url": "https://www.redbubble.com/dmca/report",
        "submission_method": "web_form",
    },
    # Social Media
    "instagram": {
        "category": "social_media",
        "submission_url": "https://help.instagram.com/contact/372592039493026",
        "submission_method": "web_form",
    },
    "facebook": {
        "category": "social_media",
        "submission_url": "https://www.facebook.com/help/contact/208282075858952",
        "submission_method": "web_form",
    },
    "tiktok": {
        "category": "social_media",
        "submission_url": "https://www.tiktok.com/legal/report/Copyright",
        "submission_method": "web_form",
    },
    "youtube": {
        "category": "social_media",
        "submission_url": "https://www.youtube.com/copyright_complaint_form",
        "submission_method": "web_form",
    },
    "twitter": {
        "category": "social_media",
        "submission_url": "https://help.twitter.com/forms/dmca",
        "submission_method": "web_form",
    },
    "pinterest": {
        "category": "social_media",
        "submission_url": "https://www.pinterest.com/about/copyright/dmca-pin/",
        "submission_method": "web_form",
    },
    "linkedin": {
        "category": "social_media",
        "submission_url": "https://www.linkedin.com/help/linkedin/ask/TS-NTCR",
        "submission_method": "web_form",
    },
    "reddit": {
        "category": "social_media",
        "submission_url": None,
        "submission_email": "copyright@reddit.com",
        "submission_method": "email",
    },
    "snapchat": {
        "category": "social_media",
        "submission_url": "https://support.snapchat.com/a/report-copyright",
        "submission_method": "web_form",
    },
    "twitch": {
        "category": "social_media",
        "submission_url": "https://www.twitch.tv/p/en/legal/dmca-guidelines/",
        "submission_method": "web_form",
    },
    "discord": {
        "category": "social_media",
        "submission_url": None,
        "submission_email": "copyright@discord.com",
        "submission_method": "email",
    },
    "tumblr": {
        "category": "social_media",
        "submission_url": "https://www.tumblr.com/dmca",
        "submission_method": "web_form",
    },
    # Search Engines
    "google_search": {
        "category": "search_engine",
        "submission_url": "https://reportcontent.google.com/forms/dmca_search",
        "submission_method": "web_form",
    },
    "google_images": {
        "category": "search_engine",
        "submission_url": "https://reportcontent.google.com/forms/dmca_image",
        "submission_method": "web_form",
    },
    "bing": {
        "category": "search_engine",
        "submission_url": "https://www.bing.com/webmaster/tools/contentremoval",
        "submission_email": "dmca@microsoft.com",
        "submission_method": "web_form",
    },
    # Ad Platforms
    "google_ads": {
        "category": "ad_platform",
        "submission_url": "https://support.google.com/adspolicy/troubleshooter/4578507",
        "submission_email": "trademark@google.com",
        "submission_method": "web_form",
    },
    "meta_ads": {
        "category": "ad_platform",
        "submission_url": "https://www.facebook.com/help/contact/1735443093393986",
        "submission_method": "web_form",
    },
    "tiktok_ads": {
        "category": "ad_platform",
        "submission_url": "https://ads.tiktok.com/help/article/ad-intellectual-property-policy",
        "submission_method": "web_form",
    },
    # Domain Registrars / Hosting
    "cloudflare": {
        "category": "domain_registrar",
        "submission_url": "https://abuse.cloudflare.com/dmca",
        "submission_method": "web_form",
    },
    "godaddy": {
        "category": "domain_registrar",
        "submission_url": "https://supportcenter.godaddy.com/ipclaims",
        "submission_method": "web_form",
    },
    "namecheap": {
        "category": "domain_registrar",
        "submission_url": None,
        "submission_email": "abuse@namecheap.com",
        "submission_method": "email",
    },
    "dreamhost": {
        "category": "domain_registrar",
        "submission_url": "https://www.dreamhost.com/legal/dmca/",
        "submission_method": "web_form",
    },
    "bluehost": {
        "category": "domain_registrar",
        "submission_url": None,
        "submission_email": "dmca@bluehost.com",
        "submission_method": "email",
    },
    "udrp_icann": {
        "category": "domain_registrar",
        "submission_url": "https://www.icann.org/resources/pages/help/dndr/udrp-en",
        "submission_method": "udrp",
    },
    "udrp_wipo": {
        "category": "domain_registrar",
        "submission_url": "https://www.wipo.int/amc/en/domains/",
        "submission_method": "udrp",
    },
    # App Stores
    "google_play": {
        "category": "app_store",
        "submission_url": "https://support.google.com/googleplay/android-developer/contact/ipr",
        "submission_method": "web_form",
    },
    "apple_app_store": {
        "category": "app_store",
        "submission_url": "https://www.apple.com/legal/intellectual-property/",
        "submission_method": "web_form",
    },
    "microsoft_store": {
        "category": "app_store",
        "submission_url": "https://www.microsoft.com/en-us/legal/intellectualproperty/infringement",
        "submission_method": "web_form",
    },
    # Other
    "github": {
        "category": "other",
        "submission_url": "https://github.com/contact/dmca",
        "submission_method": "web_form",
    },
    "vimeo": {
        "category": "other",
        "submission_url": "https://vimeo.com/dmca",
        "submission_method": "web_form",
    },
    "wordpress": {
        "category": "other",
        "submission_url": "https://en.support.wordpress.com/report-blogs/",
        "submission_method": "web_form",
    },
}

# Maps raw Gemini-returned platform names → PLATFORM_REGISTRY keys
_PLATFORM_KEY_MAP: dict[str, str] = {
    "amazon": "amazon",
    "ebay": "ebay",
    "etsy": "etsy",
    "alibaba": "alibaba",
    "aliexpress": "aliexpress",
    "ali express": "aliexpress",
    "shopify": "shopify",
    "walmart": "walmart",
    "wish": "wish",
    "temu": "temu",
    "redbubble": "redbubble",
    "instagram": "instagram",
    "facebook": "facebook",
    "tiktok": "tiktok",
    "youtube": "youtube",
    "twitter": "twitter",
    "x": "twitter",
    "x.com": "twitter",
    "pinterest": "pinterest",
    "linkedin": "linkedin",
    "reddit": "reddit",
    "snapchat": "snapchat",
    "twitch": "twitch",
    "discord": "discord",
    "tumblr": "tumblr",
    "google search": "google_search",
    "google": "google_search",
    "bing": "bing",
    "google ads": "google_ads",
    "google_ads": "google_ads",
    "facebook ads": "meta_ads",
    "instagram ads": "meta_ads",
    "meta ads": "meta_ads",
    "meta": "meta_ads",
    "cloudflare": "cloudflare",
    "godaddy": "godaddy",
    "namecheap": "namecheap",
    "dreamhost": "dreamhost",
    "bluehost": "bluehost",
    "github": "github",
    "vimeo": "vimeo",
    "wordpress": "wordpress",
    "wordpress.com": "wordpress",
}

# Registrar name fragments → PLATFORM_REGISTRY key (for DomainEvidence)
_REGISTRAR_KEY_MAP: dict[str, str] = {
    "godaddy": "godaddy",
    "namecheap": "namecheap",
    "cloudflare": "cloudflare",
    "dreamhost": "dreamhost",
    "bluehost": "bluehost",
    "ovh": "cloudflare",       # fallback — no OVH entry, use Cloudflare abuse
    "squarespace": "godaddy",  # Google Domains migrated to Squarespace
}

# ---------------------------------------------------------------------------
# Notice template
# ---------------------------------------------------------------------------

_NOTICE_TEMPLATE = """\
DMCA / IP INFRINGEMENT NOTICE
==============================
Date: {date}
Platform: {platform}

To Whom It May Concern,

I am the owner / authorized representative of the intellectual property rights
for the brand "{brand_name}".

I have a good faith belief that the content at the URL below infringes upon
my intellectual property rights without authorization:

  Infringing URL: {infringing_url}

My rights:
  Registered trademark / copyright for "{brand_name}" covering goods and
  services in relevant classes.

Key evidence:
{evidence_bullets}

I request the immediate removal or disabling of access to the infringing
material identified above.

I swear, under penalty of perjury, that the information in this notification
is accurate and that I am the owner or authorized agent of the affected rights.

Signature: [RIGHTS OWNER NAME]
Contact:   [EMAIL ADDRESS]
""".strip()


def _build_notice(
    brand_name: str,
    platform: str,
    infringing_url: str,
    key_findings: list[str],
    date: str,
) -> str:
    bullets = "\n".join(f"  - {f}" for f in key_findings) if key_findings else "  - See attached evidence."
    return _NOTICE_TEMPLATE.format(
        date=date,
        platform=platform,
        brand_name=brand_name,
        infringing_url=infringing_url,
        evidence_bullets=bullets,
    )


# ---------------------------------------------------------------------------
# Platform key helpers
# ---------------------------------------------------------------------------

def _normalize_platform_key(raw: str) -> str:
    """Map a Gemini-returned platform string to a PLATFORM_REGISTRY key."""
    return _PLATFORM_KEY_MAP.get(raw.lower().strip(), raw.lower().strip())


def _registrar_to_platform_key(registrar: str | None) -> str:
    """Map a WHOIS registrar string to a PLATFORM_REGISTRY key."""
    if not registrar:
        return "cloudflare"
    lower = registrar.lower()
    for fragment, key in _REGISTRAR_KEY_MAP.items():
        if fragment in lower:
            return key
    return "cloudflare"  # Cloudflare is the most common CDN/proxy; safe fallback


def _lookup(platform_key: str) -> dict:
    return PLATFORM_REGISTRY.get(platform_key, {
        "category": "other",
        "submission_url": None,
        "submission_email": None,
        "submission_method": "email",
    })


# ---------------------------------------------------------------------------
# Main public function
# ---------------------------------------------------------------------------

def generate_takedown_reports(
    case_id: str,
    brand_name: str,
    decision: Decision,
    evidence: Evidence,
    force: bool = False,
) -> list[TakedownReport]:
    """
    Generates a platform-specific DMCA notice for every infringing URL found
    in evidence when the decision is TAKEDOWN or force=True.
    Persists all reports to the `takedown_reports` Supabase table.
    Returns the list of TakedownReport objects.
    """
    if not force and decision.recommended_action != "TAKEDOWN":
        return []

    date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    reports: list[TakedownReport] = []

    # 1. Marketplace listings
    for listing in evidence.marketplaces:
        platform_key = _normalize_platform_key(listing.platform)
        meta = _lookup(platform_key)
        report = TakedownReport(
            platform=platform_key,
            platform_category=meta["category"],
            infringing_url=listing.listing_url,
            submission_url=meta.get("submission_url"),
            submission_method=meta["submission_method"],
            submission_email=meta.get("submission_email"),
            notice_text=_build_notice(
                brand_name=brand_name,
                platform=platform_key,
                infringing_url=listing.listing_url,
                key_findings=decision.key_findings,
                date=date_str,
            ),
        )
        reports.append(report)

    # 2. Ad evidence
    for ad in evidence.ads:
        platform_key = _normalize_platform_key(ad.platform)
        # Ads go to the ad_platform registry entry, not the social one
        if not platform_key.endswith("_ads") and platform_key in ("facebook", "instagram", "meta"):
            platform_key = "meta_ads"
        elif platform_key == "google":
            platform_key = "google_ads"
        meta = _lookup(platform_key)
        report = TakedownReport(
            platform=platform_key,
            platform_category=meta["category"],
            infringing_url=ad.destination_url,
            submission_url=meta.get("submission_url"),
            submission_method=meta["submission_method"],
            submission_email=meta.get("submission_email"),
            notice_text=_build_notice(
                brand_name=brand_name,
                platform=platform_key,
                infringing_url=ad.destination_url,
                key_findings=decision.key_findings,
                date=date_str,
            ),
        )
        reports.append(report)

    # 3. Domain evidence
    for domain in evidence.domains:
        infringing_url = f"http://{domain.domain_name}"
        platform_key = _registrar_to_platform_key(domain.registrar)
        meta = _lookup(platform_key)
        report = TakedownReport(
            platform=platform_key,
            platform_category=meta["category"],
            infringing_url=infringing_url,
            submission_url=meta.get("submission_url"),
            submission_method=meta["submission_method"],
            submission_email=meta.get("submission_email"),
            notice_text=_build_notice(
                brand_name=brand_name,
                platform=platform_key,
                infringing_url=infringing_url,
                key_findings=decision.key_findings,
                date=date_str,
            ),
        )
        reports.append(report)

    # 4. Social media evidence
    for social in evidence.social:
        if not social.post_url:
            continue
        platform_key = _normalize_platform_key(social.platform)
        meta = _lookup(platform_key)
        report = TakedownReport(
            platform=platform_key,
            platform_category=meta["category"],
            infringing_url=social.post_url,
            submission_url=meta.get("submission_url"),
            submission_method=meta["submission_method"],
            submission_email=meta.get("submission_email"),
            notice_text=_build_notice(
                brand_name=brand_name,
                platform=platform_key,
                infringing_url=social.post_url,
                key_findings=decision.key_findings,
                date=date_str,
            ),
        )
        reports.append(report)

    _persist_reports(case_id, reports)
    return reports


def _persist_reports(case_id: str, reports: list[TakedownReport]) -> None:
    if not reports:
        return
    sb = get_supabase()
    rows = [
        {
            "case_id": case_id,
            "platform": r.platform,
            "platform_category": r.platform_category,
            "infringing_url": r.infringing_url,
            "submission_url": r.submission_url,
            "submission_method": r.submission_method,
            "submission_email": r.submission_email,
            "notice_text": r.notice_text,
            "status": "pending",
        }
        for r in reports
    ]
    result = sb.table("takedown_reports").insert(rows).execute()
    if result.data:
        for r, data_row in zip(reports, result.data):
            r.id = data_row.get("id")
