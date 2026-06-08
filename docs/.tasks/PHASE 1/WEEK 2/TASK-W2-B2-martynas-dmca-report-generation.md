# TASK-W2-B2 — DMCA / IP Takedown Report Generation (Engineer B)

**Assigned to:** Martynas
**Week:** Week 2
**Priority:** 🔴 High
**Stack:** Python · FastAPI · Pydantic · Supabase · Jinja2

---

## Objective

Once the Gemini decision agent outputs `TAKEDOWN`, the system must **automatically generate a platform-specific DMCA / IP infringement notice** and return the ready-to-submit report (or submit it programmatically where an API exists).

**Success test:**
```python
from tracemark_api.services.takedown import generate_takedown_reports

reports = generate_takedown_reports(case_id="uuid", decision=decision, evidence=evidence)
# Returns list of TakedownReport objects, one per infringing URL / platform
# Each report contains: platform, submission_url, notice_text, method ("form"|"email"|"api")
# Side effect: reports persisted to Supabase `takedown_reports` table
```

---

## Context

After Week 2-B produces a `Decision(recommended_action="TAKEDOWN")`, this subtask adds the next step: turn that decision into **actionable notices** formatted for each platform where infringement was found. Different platforms accept notices in different ways (web form, email, API), so the generator must be platform-aware.

**Scope for Week 2:** Generate the notice text + metadata. Actual automated submission is tracked per platform in the platform catalog below — most platforms require manual form submission; mark those clearly.

---

## Supabase Schema Addition

Add this table in the Supabase SQL editor:

```sql
-- Takedown reports: one row per infringing URL / platform
CREATE TABLE IF NOT EXISTS takedown_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,          -- e.g. "amazon", "google_search", "instagram"
    platform_category TEXT NOT NULL, -- "marketplace" | "social_media" | "search_engine"
                                     -- | "ad_platform" | "domain_registrar" | "app_store"
    infringing_url TEXT NOT NULL,
    submission_url TEXT,             -- where to submit the notice
    submission_method TEXT NOT NULL, -- "web_form" | "email" | "api" | "udrp"
    submission_email TEXT,           -- if method = email
    notice_text TEXT NOT NULL,       -- full generated notice body
    status TEXT NOT NULL DEFAULT 'pending',  -- pending | submitted | acknowledged | resolved
    submitted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_takedown_case ON takedown_reports(case_id);
CREATE INDEX IF NOT EXISTS idx_takedown_status ON takedown_reports(status);
CREATE INDEX IF NOT EXISTS idx_takedown_platform ON takedown_reports(platform);
```

---

## Platform Catalog

All platforms where DMCA / IP takedown notices can be submitted, grouped by category.

> **Submission methods:**
> - `web_form` — fill in an online form manually (most common)
> - `email` — send notice to a designated DMCA agent email
> - `api` — programmatic submission available
> - `udrp` — UDRP arbitration (for domain name disputes, not content)

---

### 1. Search Engines

| Platform | Submission URL / Contact | Method | Notes |
|----------|--------------------------|--------|-------|
| **Google Search** | `https://reportcontent.google.com/forms/dmca_search` | web_form | Removes URL from search index; requires Google account login |
| **Google Images** | `https://reportcontent.google.com/forms/dmca_image` | web_form | Separate form from web search |
| **Bing / Microsoft** | `https://www.bing.com/webmaster/tools/contentremoval` | web_form | Also accepts email: `[email protected]` |
| **Bing (Microsoft Legal)** | `https://www.microsoft.com/en-us/legal/intellectualproperty/infringement` | web_form | Covers Bing + all Microsoft products |
| **Yahoo Search** | `https://help.yahoo.com/kb/SLN28340.html` | web_form | Yahoo uses Bing's index; submit to Bing for faster effect |
| **DuckDuckGo** | `[email protected]` | email | DuckDuckGo uses Bing/other indexes; submit to origin |

---

### 2. Marketplaces

| Platform | Submission URL / Contact | Method | Notes |
|----------|--------------------------|--------|-------|
| **Amazon (Public)** | `https://www.amazon.com/report/infringement` | web_form | For copyright + trademark; select infringement type |
| **Amazon Brand Registry** | `https://brandservices.amazon.com` → Report a Violation | web_form | Faster processing; requires trademark registration |
| **eBay (VeRO)** | `https://pages.ebay.com/seller-center/listing-and-marketing/verified-rights-owner-program.html` | web_form | VeRO program; enrollment recommended for brand owners |
| **eBay (one-off)** | `https://contact.ebay.com/ws/eBayISAPI.dll?ReportIPInfringement` | web_form | Single report without VeRO enrollment |
| **Etsy (Portal)** | `https://www.etsy.com/legal/ip` | web_form | Best for managing multiple reports |
| **Etsy (one-off)** | `https://www.etsy.com/report-infringement` | web_form | Single IP infringement report form |
| **Alibaba / AliExpress** | `https://ipp.aidcgroup.net` | web_form | Alibaba International IPP Platform; covers Alibaba + AliExpress |
| **AliExpress complaint** | `https://ipp.aidcgroup.net/complaint/onlineForm/online.htm` | web_form | Direct complaint form within IPP platform |
| **Shopify (merchant stores)** | `https://www.shopify.com/legal/trademark` | web_form | Reports against Shopify-hosted stores; Shopify contacts merchant |
| **Wish** | `https://www.wish.com/legal/ip-policy` | web_form | IP Infringement Policy; submit via their merchant portal |
| **Temu** | `https://www.temu.com/ip-infringement-report.html` | web_form | Relatively new process; may require brand verification |
| **Walmart Marketplace** | `https://www.walmart.com/help/article/report-intellectual-property-infringement/819fb2fcbf7843e2919706cafc10ef00` | web_form | IP infringement report for Walmart.com third-party sellers |
| **Redbubble** | `https://www.redbubble.com/dmca/report` | web_form | User-generated content marketplace; DMCA notice form |
| **Zazzle** | `[email protected]` | email | IP complaints by email to their legal team |

---

### 3. Social Media

| Platform | Submission URL / Contact | Method | Notes |
|----------|--------------------------|--------|-------|
| **Facebook (copyright)** | `https://www.facebook.com/help/contact/208282075858952` | web_form | Copyright infringement on posts/videos/images |
| **Facebook (trademark)** | `https://www.facebook.com/help/contact/540977946019latin` | web_form | Trademark infringement form (separate from copyright) |
| **Instagram (copyright)** | `https://help.instagram.com/contact/372592039493026` | web_form | Same Meta system as Facebook; covers posts, Reels, Stories |
| **Instagram (trademark)** | `https://help.instagram.com/contact/636276399721841` | web_form | Trademark-specific form |
| **X / Twitter (copyright)** | `https://help.twitter.com/forms/dmca` | web_form | Warning: X shares your contact info with the alleged infringer |
| **X / Twitter (trademark)** | `https://help.twitter.com/forms/trademark` | web_form | Separate trademark complaint form |
| **TikTok (copyright)** | `https://www.tiktok.com/legal/report/Copyright` | web_form | Two forms: one for UGC, one for infringing ads |
| **TikTok (trademark)** | `https://www.tiktok.com/legal/report/Trademark` | web_form | Trademark notice form |
| **YouTube** | `https://www.youtube.com/copyright_complaint_form` | web_form | Also available via YouTube Studio → Copyright → Submit |
| **YouTube (Content ID)** | `https://support.google.com/youtube/answer/2605065` | api | Content ID API for rights holders with large catalogs |
| **Pinterest (copyright)** | `https://www.pinterest.com/about/copyright/dmca-pin/` | web_form | Can remove single URL or all duplicates platform-wide |
| **Pinterest (trademark)** | `https://www.pinterest.com/about/copyright/trademark/` | web_form | Separate trademark complaint |
| **LinkedIn** | `https://www.linkedin.com/help/linkedin/ask/TS-NTCR` | web_form | Copyright + trademark reports via Help Center |
| **Twitch** | `https://www.twitch.tv/p/en/legal/dmca-guidelines/` | web_form | DMCA notice form in legal section; also covers music |
| **Reddit** | `https://www.reddit.com/r/legaladvice/` + `[email protected]` | email | Email to Reddit legal team; or use in-platform report |
| **Reddit (official)** | `https://www.redditinc.com/policies/content-policy` → contact | email | `[email protected]` for formal IP notices |
| **Snapchat** | `https://support.snapchat.com/a/report-copyright` | web_form | Copyright infringement report form |
| **Tumblr** | `https://www.tumblr.com/dmca` | web_form | DMCA notice submission page |
| **Discord** | `[email protected]` | email | Email to Discord's DMCA agent |
| **Telegram** | `[email protected]` | email | Copyright/IP complaints to abuse team |

---

### 4. Ad Platforms

| Platform | Submission URL / Contact | Method | Notes |
|----------|--------------------------|--------|-------|
| **Google Ads (trademark)** | `https://support.google.com/adspolicy/troubleshooter/4578507` | web_form | Also: `[email protected]`; for trademark in ad text or URL |
| **Google Ads (copyright)** | `https://reportcontent.google.com/forms/dmca_ads` | web_form | For copyrighted content in Display Network ads |
| **Meta Ads (Facebook/IG)** | `https://www.facebook.com/help/contact/1735443093393986` | web_form | IP infringement in Facebook/Instagram ads |
| **Microsoft Advertising (Bing Ads)** | `https://about.ads.microsoft.com/en-us/policies/intellectual-property-policy` | web_form | Trademark + copyright in Bing Ads; also email legal team |
| **TikTok Ads** | `https://ads.tiktok.com/help/article/ad-intellectual-property-policy` | web_form | IP infringement in TikTok Ads; separate from organic content |
| **Pinterest Ads** | `https://policy.pinterest.com/en/advertising-guidelines` | web_form | Ad policy violation + IP; via Pinterest business support |
| **Twitter / X Ads** | `https://business.twitter.com/en/help/ads-policies/other-policy-requirements/copyright-policy.html` | web_form | Copyright in promoted tweets / X Ads |
| **Snapchat Ads** | `https://businesshelp.snapchat.com/s/article/ad-content-requirements` | web_form | Ad policy + IP complaint via Snap business support |
| **Amazon Ads (sponsored)** | Via Brand Registry Report a Violation tool | web_form | Sponsored ads using brand name/logo without authorisation |

---

### 5. Domain Registrars & Hosting

| Platform | Submission URL / Contact | Method | Notes |
|----------|--------------------------|--------|-------|
| **Cloudflare (DMCA)** | `https://abuse.cloudflare.com/dmca` | web_form | Cloudflare forwards notice to origin host; not a host itself |
| **Cloudflare (trademark)** | `https://abuse.cloudflare.com/trademark` | web_form | Separate trademark abuse form |
| **GoDaddy** | `https://supportcenter.godaddy.com/ipclaims` | web_form | Handles hosting AND domain registration complaints |
| **Namecheap (DMCA)** | `https://www.namecheap.com/support/knowledgebase/article.aspx/9198/5/dmca-takedown-request-requirements/` | email | Email `[email protected]`; trademark → UDRP instead |
| **Google Domains / Squarespace** | `https://support.google.com/domains/answer/10070473` | email | Now managed by Squarespace; `[email protected]` |
| **Bluehost** | `[email protected]` | email | DMCA notice to designated agent |
| **HostGator** | `[email protected]` | email | Part of Newfold Digital group |
| **SiteGround** | `[email protected]` | email | EU-based; GDPR + DMCA aware |
| **DreamHost** | `https://www.dreamhost.com/legal/dmca/` | web_form | DMCA form + designated agent info |
| **OVHcloud** | `[email protected]` | email | Major EU/global host; sends forward to customer |
| **ICANN UDRP** | `https://www.icann.org/resources/pages/help/dndr/udrp-en` | udrp | Domain name trademark disputes; not content DMCA |
| **WIPO UDRP** | `https://www.wipo.int/amc/en/domains/` | udrp | Alternative UDRP arbitration body; usually faster |
| **Forum (NAF) UDRP** | `https://www.adrforum.com/domain-names` | udrp | Third UDRP provider; accepts filings online |

---

### 6. App Stores

| Platform | Submission URL / Contact | Method | Notes |
|----------|--------------------------|--------|-------|
| **Google Play Store** | `https://support.google.com/googleplay/android-developer/contact/ipr` | web_form | Copyright + trademark in app listings |
| **Apple App Store** | `https://www.apple.com/legal/intellectual-property/` → Report form | web_form | IP infringement via Apple Legal; includes app names/icons |
| **Microsoft Store** | `https://www.microsoft.com/en-us/legal/intellectualproperty/infringement` | web_form | Same Microsoft Legal form covers Store + Bing |
| **Amazon Appstore** | `[email protected]` | email | IP infringement in Amazon Android app store |

---

### 7. Other Platforms

| Platform | Submission URL / Contact | Method | Notes |
|----------|--------------------------|--------|-------|
| **GitHub** | `https://github.com/contact/dmca` | web_form | Well-documented DMCA process; public notices posted |
| **Dropbox** | `[email protected]` | email | DMCA to their designated agent |
| **WordPress.com** | `https://en.support.wordpress.com/report-blogs/` | web_form | Only for WordPress.com hosted sites (not self-hosted) |
| **Blogger / Blogspot** | `https://support.google.com/blogger/answer/76315` | web_form | Managed by Google; use Google's legal removal tools |
| **Vimeo** | `https://vimeo.com/dmca` | web_form | Copyright infringement for video content |
| **Dailymotion** | `https://legal.dailymotion.com/en/copyright/` | web_form | DMCA + EU content removal forms |
| **SoundCloud** | `https://soundcloud.com/copyright` | web_form | Copyright infringement for audio content |
| **Spotify** | `[email protected]` | email | Copyright complaints about music/podcasts |

---

## Step-by-Step Implementation

### Step 1 — Pydantic Models

Create `apps/api/src/tracemark_api/services/takedown.py`:

```python
from pydantic import BaseModel
from typing import Literal, Optional

class TakedownReport(BaseModel):
    platform: str                          # e.g. "amazon", "instagram"
    platform_category: Literal[
        "marketplace", "social_media",
        "search_engine", "ad_platform",
        "domain_registrar", "app_store", "other"
    ]
    infringing_url: str
    submission_url: Optional[str] = None
    submission_method: Literal["web_form", "email", "api", "udrp"]
    submission_email: Optional[str] = None
    notice_text: str
    status: str = "pending"
```

---

### Step 2 — Platform Registry

Define a lookup dict mapping platform names to their submission metadata:

```python
PLATFORM_REGISTRY = {
    # --- Marketplaces ---
    "amazon": {
        "category": "marketplace",
        "submission_url": "https://www.amazon.com/report/infringement",
        "submission_method": "web_form",
        "brand_registry_url": "https://brandservices.amazon.com",
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
    # --- Social Media ---
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
        "submission_email": "[email protected]",
        "submission_method": "email",
    },
    "snapchat": {
        "category": "social_media",
        "submission_url": "https://support.snapchat.com/a/report-copyright",
        "submission_method": "web_form",
    },
    # --- Search Engines ---
    "google_search": {
        "category": "search_engine",
        "submission_url": "https://reportcontent.google.com/forms/dmca_search",
        "submission_method": "web_form",
    },
    "bing": {
        "category": "search_engine",
        "submission_url": "https://www.bing.com/webmaster/tools/contentremoval",
        "submission_method": "web_form",
        "submission_email": "[email protected]",
    },
    # --- Ad Platforms ---
    "google_ads": {
        "category": "ad_platform",
        "submission_url": "https://support.google.com/adspolicy/troubleshooter/4578507",
        "submission_email": "[email protected]",
        "submission_method": "web_form",
    },
    "meta_ads": {
        "category": "ad_platform",
        "submission_url": "https://www.facebook.com/help/contact/1735443093393986",
        "submission_method": "web_form",
    },
    # --- Domain Registrars ---
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
        "submission_email": "[email protected]",
        "submission_method": "email",
    },
    # --- App Stores ---
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
}
```

---

### Step 3 — Notice Text Generator

Generate a DMCA-compliant notice body for each infringing URL:

```python
NOTICE_TEMPLATE = """
DMCA / IP INFRINGEMENT NOTICE
==============================
Date: {date}
Platform: {platform}

To Whom It May Concern,

I am the owner / authorized representative of the intellectual property rights
for the brand "{brand_name}".

I have a good faith belief that the content accessible at the URL below is
infringing upon my intellectual property rights:

  Infringing URL: {infringing_url}

My original / registered rights:
  {rights_description}

Evidence of infringement:
{evidence_summary}

I hereby request the immediate removal or disabling of access to the infringing
material identified above.

I swear, under penalty of perjury, that the information in this notification is
accurate and that I am the owner or authorized agent of the affected rights.

Signature: [OWNER NAME]
Contact:   [EMAIL ADDRESS]
""".strip()


def generate_notice_text(
    brand_name: str,
    platform: str,
    infringing_url: str,
    evidence_summary: str,
    date: str,
) -> str:
    rights_description = (
        f"Registered trademark / copyright for '{brand_name}' "
        f"covering goods and services in relevant classes."
    )
    return NOTICE_TEMPLATE.format(
        date=date,
        platform=platform,
        brand_name=brand_name,
        infringing_url=infringing_url,
        rights_description=rights_description,
        evidence_summary=evidence_summary,
    )
```

---

### Step 4 — Main Generator Function

```python
from tracemark_api.services.ai import Evidence, Decision
from tracemark_api.services.database import get_supabase
from datetime import datetime, timezone


def generate_takedown_reports(
    case_id: str,
    brand_name: str,
    decision: Decision,
    evidence: Evidence,
) -> list[TakedownReport]:
    """
    For every infringing URL found in evidence, generate a platform-appropriate
    takedown notice. Persists all reports to Supabase.
    Returns the list of TakedownReport objects.
    """
    if decision.recommended_action != "TAKEDOWN":
        return []

    date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    evidence_summary = "\n".join(f"  - {f}" for f in decision.key_findings)
    reports = []

    # Collect all infringing URLs with their platform tag
    infringing_items: list[tuple[str, str]] = []  # (platform_key, url)
    for listing in evidence.marketplaces:
        platform_key = _detect_platform(listing.url)
        infringing_items.append((platform_key, listing.url))
    for url in evidence.domains:
        infringing_items.append(("cloudflare", url))  # default — refine as needed

    for platform_key, infringing_url in infringing_items:
        meta = PLATFORM_REGISTRY.get(platform_key, {
            "category": "other",
            "submission_url": None,
            "submission_method": "email",
        })
        notice_text = generate_notice_text(
            brand_name=brand_name,
            platform=platform_key,
            infringing_url=infringing_url,
            evidence_summary=evidence_summary,
            date=date_str,
        )
        report = TakedownReport(
            platform=platform_key,
            platform_category=meta["category"],
            infringing_url=infringing_url,
            submission_url=meta.get("submission_url"),
            submission_method=meta["submission_method"],
            submission_email=meta.get("submission_email"),
            notice_text=notice_text,
        )
        reports.append(report)

    _persist_reports(case_id, reports)
    return reports


def _detect_platform(url: str) -> str:
    """Infer platform key from URL domain."""
    url_lower = url.lower()
    mapping = {
        "amazon.": "amazon",
        "ebay.": "ebay",
        "etsy.": "etsy",
        "alibaba.": "alibaba",
        "aliexpress.": "aliexpress",
        "shopify.": "shopify",
        "instagram.": "instagram",
        "facebook.": "facebook",
        "tiktok.": "tiktok",
        "youtube.": "youtube",
        "twitter.": "twitter",
        "x.com": "twitter",
        "pinterest.": "pinterest",
        "linkedin.": "linkedin",
    }
    for fragment, key in mapping.items():
        if fragment in url_lower:
            return key
    return "unknown"


def _persist_reports(case_id: str, reports: list[TakedownReport]) -> None:
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
    if rows:
        sb.table("takedown_reports").insert(rows).execute()
```

---

### Step 5 — Wire into `/check-brand` Endpoint

Update `monitoring.py` to also return takedown reports when action is TAKEDOWN:

```python
from tracemark_api.services.takedown import generate_takedown_reports

@router.post("/check-brand")
def check_brand(payload: CheckBrandRequest):
    case_id = create_case(payload.brand_name)
    evidence = gather_evidence(payload.brand_name, payload.platforms)
    save_evidence(case_id, evidence)
    decision = make_decision(evidence)
    save_decision(case_id, decision)

    reports = generate_takedown_reports(
        case_id=case_id,
        brand_name=payload.brand_name,
        decision=decision,
        evidence=evidence,
    )

    return {
        "case_id": case_id,
        "decision": decision.dict(),
        "evidence": evidence.dict(),
        "takedown_reports": [r.dict() for r in reports],
    }
```

---

## File Summary

| File | Action |
|------|--------|
| `apps/api/src/tracemark_api/services/takedown.py` | **Create** — `TakedownReport` model, `PLATFORM_REGISTRY`, notice generator |
| `apps/api/src/tracemark_api/routes/monitoring.py` | **Update** — call `generate_takedown_reports` in `/check-brand` |
| Supabase SQL Editor | **Run** — `takedown_reports` table from schema addition above |

---

## Acceptance Criteria

- [ ] `generate_takedown_reports()` returns an empty list when `recommended_action != "TAKEDOWN"`
- [ ] For a HIGH risk decision with 3 infringing Amazon URLs, returns 3 `TakedownReport` objects with correct `submission_url` and `notice_text`
- [ ] Every report is persisted to the `takedown_reports` Supabase table with `status = "pending"`
- [ ] `notice_text` includes: date, infringing URL, brand name, evidence summary, and DMCA perjury statement
- [ ] `_detect_platform()` correctly identifies amazon / instagram / aliexpress from sample URLs
- [ ] `POST /api/v1/monitoring/check-brand` response includes a `takedown_reports` array when action is TAKEDOWN
- [ ] Unknown platform URLs still generate a report (fallback to `"unknown"` platform with `method = "email"`)

---

## Platform Quick-Reference Card

```
MARKETPLACES          URL
  Amazon              https://www.amazon.com/report/infringement
  Amazon Brand Reg.   https://brandservices.amazon.com
  eBay VeRO           https://contact.ebay.com/ws/eBayISAPI.dll?ReportIPInfringement
  Etsy                https://www.etsy.com/report-infringement
  Alibaba/AliExpress  https://ipp.aidcgroup.net
  Shopify             https://www.shopify.com/legal/trademark
  Walmart             walmart.com/help/article/report-intellectual-property-infringement/...
  Wish                https://www.wish.com/legal/ip-policy
  Temu                https://www.temu.com/ip-infringement-report.html

SOCIAL MEDIA          URL / Email
  Facebook            https://www.facebook.com/help/contact/208282075858952
  Instagram           https://help.instagram.com/contact/372592039493026
  TikTok              https://www.tiktok.com/legal/report/Copyright
  YouTube             https://www.youtube.com/copyright_complaint_form
  X / Twitter         https://help.twitter.com/forms/dmca
  Pinterest           https://www.pinterest.com/about/copyright/dmca-pin/
  LinkedIn            https://www.linkedin.com/help/linkedin/ask/TS-NTCR
  Reddit              [email protected]
  Snapchat            https://support.snapchat.com/a/report-copyright
  Twitch              https://www.twitch.tv/p/en/legal/dmca-guidelines/
  Discord             [email protected]

SEARCH ENGINES        URL / Email
  Google Search       https://reportcontent.google.com/forms/dmca_search
  Google Images       https://reportcontent.google.com/forms/dmca_image
  Bing                https://www.bing.com/webmaster/tools/contentremoval
  Bing (email)        [email protected]

AD PLATFORMS          URL / Email
  Google Ads          https://support.google.com/adspolicy/troubleshooter/4578507
  Google Ads (email)  [email protected]
  Meta Ads            https://www.facebook.com/help/contact/1735443093393986
  Bing Ads            microsoft.com/en-us/legal/intellectualproperty/infringement

DOMAIN / HOSTING      URL / Email
  Cloudflare          https://abuse.cloudflare.com/dmca
  GoDaddy             https://supportcenter.godaddy.com/ipclaims
  Namecheap           [email protected]
  DreamHost           https://www.dreamhost.com/legal/dmca/
  ICANN UDRP          https://www.icann.org/resources/pages/help/dndr/udrp-en
  WIPO UDRP           https://www.wipo.int/amc/en/domains/

APP STORES            URL
  Google Play         https://support.google.com/googleplay/android-developer/contact/ipr
  Apple App Store     https://www.apple.com/legal/intellectual-property/
  Microsoft Store     microsoft.com/en-us/legal/intellectualproperty/infringement

OTHER                 URL / Email
  GitHub              https://github.com/contact/dmca
  Vimeo               https://vimeo.com/dmca
  WordPress.com       https://en.support.wordpress.com/report-blogs/
  SoundCloud          [email protected]
  Spotify             [email protected]
```
