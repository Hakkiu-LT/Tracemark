from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from tracemark_api.dependencies import get_current_user
from datetime import datetime
from typing import Literal, Optional

router = APIRouter(prefix="/check-brand", tags=["check-brand"])


class CheckBrandRequest(BaseModel):
    brand_name: str
    platforms: list[str] = ["amazon", "google_ads", "domains"]
    target_regions: list[str] = ["US"]


# --- Response models ---

class MarketplaceEvidenceResponse(BaseModel):
    platform: str
    seller_name: str
    listing_url: str
    price: Optional[str] = None
    screenshot_url: Optional[str] = None


class AdEvidenceResponse(BaseModel):
    platform: str
    ad_copy: str
    destination_url: str
    screenshot_url: Optional[str] = None


class DomainEvidenceResponse(BaseModel):
    domain_name: str
    registrar: Optional[str] = None
    is_clone: bool
    similarity_score: int = Field(ge=0, le=100)
    screenshot_url: Optional[str] = None
    creation_date: Optional[str] = None
    expiry_date: Optional[str] = None
    name_servers: Optional[list[str]] = None
    registrant_organization: Optional[str] = None
    registrant_country: Optional[str] = None
    registrant_email: Optional[str] = None


class SocialEvidenceResponse(BaseModel):
    platform: str
    handle: str
    post_url: Optional[str] = None
    follower_count: Optional[str] = None


class EvidenceResponse(BaseModel):
    marketplaces: list[MarketplaceEvidenceResponse] = []
    ads: list[AdEvidenceResponse] = []
    domains: list[DomainEvidenceResponse] = []
    social: list[SocialEvidenceResponse] = []
    timestamp: datetime


class DecisionResponse(BaseModel):
    risk_level: Literal["HIGH", "MEDIUM", "LOW"]
    recommended_action: Literal["TAKEDOWN", "MONITOR", "DISMISS"]
    case_summary: str
    confidence_score: float = Field(ge=0.0, le=1.0)
    evidence_quality: Literal["STRONG", "MODERATE", "WEAK"]
    key_findings: list[str] = []


class TakedownReport(BaseModel):
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


class CheckBrandResponse(BaseModel):
    case_id: str
    decision: DecisionResponse
    evidence: EvidenceResponse
    takedown_reports: list[TakedownReport] = []


MOCK_DB: dict[str, dict] = {
    "derila": {
        "case_id": "8ca24f64-5717-4562-b3fc-2c963f66afb7",
        "decision": {
            "risk_level": "HIGH",
            "recommended_action": "TAKEDOWN",
            "case_summary": (
                "3 counterfeit Derila listings detected on Amazon and eBay, "
                "selling unauthorized contoured memory foam pillows at 50% below authentic retail. "
                "1 typosquatting domain impersonating the brand's visual identity. "
                "Immediate takedown action recommended."
            ),
            "confidence_score": 0.92,
            "evidence_quality": "STRONG",
            "key_findings": [
                "2 counterfeit listings found on Amazon from unauthorized seller 'FitGearDirect'",
                "1 counterfeit listing found on eBay from seller 'sleepwell_outlet'",
                "Prices at $18.99 vs. authentic MSRP of $39.99 — strong counterfeit signature",
                "Domain 'buy-derila-pillow-cheap.store' mimics brand design and registered trademark",
            ],
        },
        "evidence": {
            "marketplaces": [
                {
                    "platform": "amazon",
                    "seller_name": "FitGearDirect",
                    "listing_url": "https://www.ebay.com/itm/406929269852",
                    "price": "$18.99",
                    "screenshot_url": None,
                },
                {
                    "platform": "ebay",
                    "seller_name": "sleepwell_outlet",
                    "listing_url": "https://ebay.com/itm/2848822991",
                    "price": "$14.99",
                    "screenshot_url": None,
                },
            ],
            "ads": [],
            "domains": [
                {
                    "domain_name": "buy-derila-pillow-cheap.store",
                    "registrar": "Namecheap Inc.",
                    "is_clone": True,
                    "similarity_score": 92,
                },
            ],
            "social": [],
        },
        "takedown_reports": [
            {
                "platform": "amazon",
                "platform_category": "marketplace",
                "infringing_url": "https://amazon.com/dp/B0CXY9921",
                "submission_url": "https://www.amazon.com/report/infringement",
                "submission_method": "web_form",
                "submission_email": None,
                "notice_text": (
                    "DMCA / IP INFRINGEMENT NOTICE\n"
                    "==============================\n"
                    "Date: 2026-06-08\n"
                    "Platform: amazon\n\n"
                    "To Whom It May Concern,\n\n"
                    "I am the owner / authorized representative of the intellectual property rights\n"
                    "for the brand \"Derila\".\n\n"
                    "I have a good faith belief that the content at the URL below infringes upon\n"
                    "my intellectual property rights without authorization:\n\n"
                    "  Infringing URL: https://amazon.com/dp/B0CXY9921\n\n"
                    "My rights:\n"
                    "  Registered trademark / copyright for \"Derila\" covering goods and\n"
                    "  services in relevant classes.\n\n"
                    "Key evidence:\n"
                    "  - 2 counterfeit listings found on Amazon from unauthorized seller 'FitGearDirect'\n"
                    "  - Prices at $18.99 vs. authentic MSRP of $39.99 — strong counterfeit signature\n\n"
                    "I request the immediate removal or disabling of access to the infringing\n"
                    "material identified above.\n\n"
                    "I swear, under penalty of perjury, that the information in this notification\n"
                    "is accurate and that I am the owner or authorized agent of the affected rights.\n\n"
                    "Signature: [RIGHTS OWNER NAME]\n"
                    "Contact:   [EMAIL ADDRESS]"
                ),
                "status": "pending",
            },
            {
                "platform": "ebay",
                "platform_category": "marketplace",
                "infringing_url": "https://ebay.com/itm/2848822991",
                "submission_url": "https://contact.ebay.com/ws/eBayISAPI.dll?ReportIPInfringement",
                "submission_method": "web_form",
                "submission_email": None,
                "notice_text": (
                    "DMCA / IP INFRINGEMENT NOTICE\n"
                    "==============================\n"
                    "Date: 2026-06-08\n"
                    "Platform: ebay\n\n"
                    "To Whom It May Concern,\n\n"
                    "I am the owner / authorized representative of the intellectual property rights\n"
                    "for the brand \"Derila\".\n\n"
                    "I have a good faith belief that the content at the URL below infringes upon\n"
                    "my intellectual property rights without authorization:\n\n"
                    "  Infringing URL: https://ebay.com/itm/2848822991\n\n"
                    "My rights:\n"
                    "  Registered trademark / copyright for \"Derila\" covering goods and\n"
                    "  services in relevant classes.\n\n"
                    "Key evidence:\n"
                    "  - 1 counterfeit listing found on eBay from seller 'sleepwell_outlet'\n"
                    "  - Prices at $14.99 vs. authentic MSRP of $39.99 — strong counterfeit signature\n\n"
                    "I request the immediate removal or disabling of access to the infringing\n"
                    "material identified above.\n\n"
                    "I swear, under penalty of perjury, that the information in this notification\n"
                    "is accurate and that I am the owner or authorized agent of the affected rights.\n\n"
                    "Signature: [RIGHTS OWNER NAME]\n"
                    "Contact:   [EMAIL ADDRESS]"
                ),
                "status": "pending",
            },
            {
                "platform": "namecheap",
                "platform_category": "domain_registrar",
                "infringing_url": "http://buy-derila-pillow-cheap.store",
                "submission_url": None,
                "submission_method": "email",
                "submission_email": "[email protected]",
                "notice_text": (
                    "DMCA / IP INFRINGEMENT NOTICE\n"
                    "==============================\n"
                    "Date: 2026-06-08\n"
                    "Platform: namecheap\n\n"
                    "To Whom It May Concern,\n\n"
                    "I am the owner / authorized representative of the intellectual property rights\n"
                    "for the brand \"Derila\".\n\n"
                    "I have a good faith belief that the content at the URL below infringes upon\n"
                    "my intellectual property rights without authorization:\n\n"
                    "  Infringing URL: http://buy-derila-pillow-cheap.store\n\n"
                    "My rights:\n"
                    "  Registered trademark / copyright for \"Derila\" covering goods and\n"
                    "  services in relevant classes.\n\n"
                    "Key evidence:\n"
                    "  - Domain 'buy-derila-pillow-cheap.store' mimics brand design and registered trademark\n\n"
                    "I request the immediate removal or disabling of access to the infringing\n"
                    "material identified above.\n\n"
                    "I swear, under penalty of perjury, that the information in this notification\n"
                    "is accurate and that I am the owner or authorized agent of the affected rights.\n\n"
                    "Signature: [RIGHTS OWNER NAME]\n"
                    "Contact:   [EMAIL ADDRESS]"
                ),
                "status": "pending",
            },
        ],
    },

    "matsato": {
        "case_id": "9da35f64-5717-4562-b3fc-2c963f66afc8",
        "decision": {
            "risk_level": "HIGH",
            "recommended_action": "TAKEDOWN",
            "case_summary": (
                "2 counterfeit Matsato listings detected on eBay and Amazon, "
                "selling knock-off Japanese chef knives using the official trademark. "
                "1 suspicious domain squatting on the trademark. "
                "Immediate takedown action recommended."
            ),
            "confidence_score": 0.88,
            "evidence_quality": "STRONG",
            "key_findings": [
                "1 counterfeit listing on eBay from seller 'sharp_knives_outlet' using the Matsato wordmark",
                "1 listing on Amazon from seller 'KitchenProUS' displaying replica knives in product photos",
                "Domain 'matsato-knives-deal.com' registered recently, potential phishing/scam risk",
            ],
        },
        "evidence": {
            "marketplaces": [
                {
                    "platform": "ebay",
                    "seller_name": "sharp_knives_outlet",
                    "listing_url": "https://ebay.com/itm/3348822992",
                    "price": "$24.99",
                    "screenshot_url": "https://i.imgur.com/4fZxQVz.png",
                },
                {
                    "platform": "amazon",
                    "seller_name": "KitchenProUS",
                    "listing_url": "https://amazon.com/dp/B0D123456",
                    "price": "$29.99",
                    "screenshot_url": None,
                },
            ],
            "ads": [],
            "domains": [
                {
                    "domain_name": "matsato-knives-deal.com",
                    "registrar": "GoDaddy LLC",
                    "is_clone": True,
                    "similarity_score": 88,
                },
            ],
            "social": [],
        },
        "takedown_reports": [
            {
                "platform": "ebay",
                "platform_category": "marketplace",
                "infringing_url": "https://ebay.com/itm/3348822992",
                "submission_url": "https://contact.ebay.com/ws/eBayISAPI.dll?ReportIPInfringement",
                "submission_method": "web_form",
                "submission_email": None,
                "notice_text": (
                    "DMCA / IP INFRINGEMENT NOTICE\n"
                    "==============================\n"
                    "Date: 2026-06-08\n"
                    "Platform: ebay\n\n"
                    "To Whom It May Concern,\n\n"
                    "I am the owner / authorized representative of the intellectual property rights\n"
                    "for the brand \"Matsato\".\n\n"
                    "I have a good faith belief that the content at the URL below infringes upon\n"
                    "my intellectual property rights without authorization:\n\n"
                    "  Infringing URL: https://ebay.com/itm/3348822992\n\n"
                    "My rights:\n"
                    "  Registered trademark / copyright for \"Matsato\" covering goods and\n"
                    "  services in relevant classes.\n\n"
                    "Key evidence:\n"
                    "  - 1 counterfeit listing on eBay from seller 'sharp_knives_outlet' using the Matsato wordmark\n\n"
                    "I request the immediate removal or disabling of access to the infringing\n"
                    "material identified above.\n\n"
                    "I swear, under penalty of perjury, that the information in this notification\n"
                    "is accurate and that I am the owner or authorized agent of the affected rights.\n\n"
                    "Signature: [RIGHTS OWNER NAME]\n"
                    "Contact:   [EMAIL ADDRESS]"
                ),
                "status": "pending",
            },
            {
                "platform": "amazon",
                "platform_category": "marketplace",
                "infringing_url": "https://amazon.com/dp/B0D123456",
                "submission_url": "https://www.amazon.com/report/infringement",
                "submission_method": "web_form",
                "submission_email": None,
                "notice_text": (
                    "DMCA / IP INFRINGEMENT NOTICE\n"
                    "==============================\n"
                    "Date: 2026-06-08\n"
                    "Platform: amazon\n\n"
                    "To Whom It May Concern,\n\n"
                    "I am the owner / authorized representative of the intellectual property rights\n"
                    "for the brand \"Matsato\".\n\n"
                    "I have a good faith belief that the content at the URL below infringes upon\n"
                    "my intellectual property rights without authorization:\n\n"
                    "  Infringing URL: https://amazon.com/dp/B0D123456\n\n"
                    "My rights:\n"
                    "  Registered trademark / copyright for \"Matsato\" covering goods and\n"
                    "  services in relevant classes.\n\n"
                    "Key evidence:\n"
                    "  - 1 listing on Amazon from seller 'KitchenProUS' displaying replica knives in product photos\n\n"
                    "I request the immediate removal or disabling of access to the infringing\n"
                    "material identified above.\n\n"
                    "I swear, under penalty of perjury, that the information in this notification\n"
                    "is accurate and that I am the owner or authorized agent of the affected rights.\n\n"
                    "Signature: [RIGHTS OWNER NAME]\n"
                    "Contact:   [EMAIL ADDRESS]"
                ),
                "status": "pending",
            },
            {
                "platform": "godaddy",
                "platform_category": "domain_registrar",
                "infringing_url": "http://matsato-knives-deal.com",
                "submission_url": "https://supportcenter.godaddy.com/ipclaims",
                "submission_method": "web_form",
                "submission_email": None,
                "notice_text": (
                    "DMCA / IP INFRINGEMENT NOTICE\n"
                    "==============================\n"
                    "Date: 2026-06-08\n"
                    "Platform: godaddy\n\n"
                    "To Whom It May Concern,\n\n"
                    "I am the owner / authorized representative of the intellectual property rights\n"
                    "for the brand \"Matsato\".\n\n"
                    "I have a good faith belief that the content at the URL below infringes upon\n"
                    "my intellectual property rights without authorization:\n\n"
                    "  Infringing URL: http://matsato-knives-deal.com\n\n"
                    "My rights:\n"
                    "  Registered trademark / copyright for \"Matsato\" covering goods and\n"
                    "  services in relevant classes.\n\n"
                    "Key evidence:\n"
                    "  - Domain 'matsato-knives-deal.com' registered recently, potential phishing/scam risk\n\n"
                    "I request the immediate removal or disabling of access to the infringing\n"
                    "material identified above.\n\n"
                    "I swear, under penalty of perjury, that the information in this notification\n"
                    "is accurate and that I am the owner or authorized agent of the affected rights.\n\n"
                    "Signature: [RIGHTS OWNER NAME]\n"
                    "Contact:   [EMAIL ADDRESS]"
                ),
                "status": "pending",
            },
        ],
    },

    "nike": {
        "case_id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "decision": {
            "risk_level": "HIGH",
            "recommended_action": "TAKEDOWN",
            "case_summary": (
                "7 counterfeit Nike listings detected across Amazon, with sellers "
                "based in Shenzhen and Guangzhou offering products at 60-80% below "
                "retail. 4 typosquatting domains registered within the last 6 months "
                "redirect to unauthorized resellers. Immediate takedown action recommended."
            ),
            "confidence_score": 0.94,
            "evidence_quality": "STRONG",
            "key_findings": [
                "7 counterfeit listings found on Amazon from 4 distinct sellers",
                "Sellers 'ShenzhenSportsMax' and 'TopGearHK' account for 5 of 7 listings",
                "Prices ranging $18–$34 vs. retail $90–$130 — strong counterfeit signal",
                "Domain 'nike-outlet-official.shop' registered 2026-01-14, active redirect",
                "Domain 'buynike-cheap.store' mimics Nike's visual identity (score: 90%)",
                "Meta ad 'Official Nike clearance — up to 80% off' redirects to unauthorized storefront",
            ],
        },
        "evidence": {
            "marketplaces": [
                {"platform": "amazon", "seller_name": "ShenzhenSportsMax", "listing_url": "https://amazon.com/dp/B0NIKE001", "price": "$22.40", "screenshot_url": None},
                {"platform": "amazon", "seller_name": "ShenzhenSportsMax", "listing_url": "https://amazon.com/dp/B0NIKE002", "price": "$18.99", "screenshot_url": None},
                {"platform": "amazon", "seller_name": "TopGearHK", "listing_url": "https://amazon.com/dp/B0NIKE003", "price": "$34.00", "screenshot_url": None},
                {"platform": "amazon", "seller_name": "TopGearHK", "listing_url": "https://amazon.com/dp/B0NIKE004", "price": "$29.50", "screenshot_url": None},
                {"platform": "amazon", "seller_name": "TopGearHK", "listing_url": "https://amazon.com/dp/B0NIKE005", "price": "$31.00", "screenshot_url": None},
                {"platform": "amazon", "seller_name": "GuangzhouBestShoes", "listing_url": "https://amazon.com/dp/B0NIKE006", "price": "$24.99", "screenshot_url": None},
                {"platform": "amazon", "seller_name": "FastDeals_SZ", "listing_url": "https://amazon.com/dp/B0NIKE007", "price": "$19.00", "screenshot_url": None},
            ],
            "ads": [
                {
                    "platform": "meta_ads",
                    "ad_copy": "Official Nike clearance — up to 80% off",
                    "destination_url": "https://fake-nike-store.com",
                    "screenshot_url": None,
                },
            ],
            "domains": [
                {"domain_name": "nike-outlet-official.shop", "registrar": "Namecheap Inc.", "is_clone": True, "similarity_score": 90},
                {"domain_name": "buynike-cheap.store", "registrar": "GoDaddy LLC", "is_clone": True, "similarity_score": 90},
                {"domain_name": "official-nike.net", "registrar": "unknown", "is_clone": True, "similarity_score": 90},
                {"domain_name": "nikesale.org", "registrar": "Tucows Domains Inc.", "is_clone": True, "similarity_score": 90},
            ],
            "social": [],
        },
        "takedown_reports": [
            {
                "platform": "amazon",
                "platform_category": "marketplace",
                "infringing_url": "https://amazon.com/dp/B0NIKE001",
                "submission_url": "https://www.amazon.com/report/infringement",
                "submission_method": "web_form",
                "submission_email": None,
                "notice_text": (
                    "DMCA / IP INFRINGEMENT NOTICE\n"
                    "==============================\n"
                    "Date: 2026-06-08\n"
                    "Platform: amazon\n\n"
                    "To Whom It May Concern,\n\n"
                    "I am the owner / authorized representative of the intellectual property rights\n"
                    "for the brand \"Nike\".\n\n"
                    "I have a good faith belief that the content at the URLs below infringes upon\n"
                    "my intellectual property rights without authorization:\n\n"
                    "  Infringing URLs:\n"
                    "    - https://amazon.com/dp/B0NIKE001 (seller: ShenzhenSportsMax)\n"
                    "    - https://amazon.com/dp/B0NIKE002 (seller: ShenzhenSportsMax)\n"
                    "    - https://amazon.com/dp/B0NIKE003 (seller: TopGearHK)\n"
                    "    - https://amazon.com/dp/B0NIKE004 (seller: TopGearHK)\n"
                    "    - https://amazon.com/dp/B0NIKE005 (seller: TopGearHK)\n"
                    "    - https://amazon.com/dp/B0NIKE006 (seller: GuangzhouBestShoes)\n"
                    "    - https://amazon.com/dp/B0NIKE007 (seller: FastDeals_SZ)\n\n"
                    "My rights:\n"
                    "  Registered trademark / copyright for \"Nike\" covering goods and\n"
                    "  services in relevant classes.\n\n"
                    "Key evidence:\n"
                    "  - 7 counterfeit listings found on Amazon from 4 distinct sellers\n"
                    "  - Prices ranging $18–$34 vs. retail $90–$130 — strong counterfeit signal\n\n"
                    "I request the immediate removal or disabling of access to all infringing\n"
                    "materials identified above.\n\n"
                    "I swear, under penalty of perjury, that the information in this notification\n"
                    "is accurate and that I am the owner or authorized agent of the affected rights.\n\n"
                    "Signature: [RIGHTS OWNER NAME]\n"
                    "Contact:   [EMAIL ADDRESS]"
                ),
                "status": "pending",
            },
            {
                "platform": "namecheap",
                "platform_category": "domain_registrar",
                "infringing_url": "http://nike-outlet-official.shop",
                "submission_url": None,
                "submission_method": "email",
                "submission_email": "[email protected]",
                "notice_text": (
                    "DMCA / IP INFRINGEMENT NOTICE\n"
                    "==============================\n"
                    "Date: 2026-06-08\n"
                    "Platform: namecheap\n\n"
                    "To Whom It May Concern,\n\n"
                    "I am the owner / authorized representative of the intellectual property rights\n"
                    "for the brand \"Nike\".\n\n"
                    "I have a good faith belief that the content at the URL below infringes upon\n"
                    "my intellectual property rights without authorization:\n\n"
                    "  Infringing URL: http://nike-outlet-official.shop\n\n"
                    "My rights:\n"
                    "  Registered trademark / copyright for \"Nike\" covering goods and\n"
                    "  services in relevant classes.\n\n"
                    "Key evidence:\n"
                    "  - Domain 'nike-outlet-official.shop' registered 2026-01-14, active redirect\n\n"
                    "I request the immediate removal or disabling of access to the infringing\n"
                    "material identified above.\n\n"
                    "I swear, under penalty of perjury, that the information in this notification\n"
                    "is accurate and that I am the owner or authorized agent of the affected rights.\n\n"
                    "Signature: [RIGHTS OWNER NAME]\n"
                    "Contact:   [EMAIL ADDRESS]"
                ),
                "status": "pending",
            },
            {
                "platform": "godaddy",
                "platform_category": "domain_registrar",
                "infringing_url": "http://buynike-cheap.store",
                "submission_url": "https://supportcenter.godaddy.com/ipclaims",
                "submission_method": "web_form",
                "submission_email": None,
                "notice_text": (
                    "DMCA / IP INFRINGEMENT NOTICE\n"
                    "==============================\n"
                    "Date: 2026-06-08\n"
                    "Platform: godaddy\n\n"
                    "To Whom It May Concern,\n\n"
                    "I am the owner / authorized representative of the intellectual property rights\n"
                    "for the brand \"Nike\".\n\n"
                    "I have a good faith belief that the content at the URL below infringes upon\n"
                    "my intellectual property rights without authorization:\n\n"
                    "  Infringing URL: http://buynike-cheap.store\n\n"
                    "My rights:\n"
                    "  Registered trademark / copyright for \"Nike\" covering goods and\n"
                    "  services in relevant classes.\n\n"
                    "Key evidence:\n"
                    "  - Domain 'buynike-cheap.store' mimics Nike's visual identity (score: 90%)\n\n"
                    "I request the immediate removal or disabling of access to the infringing\n"
                    "material identified above.\n\n"
                    "I swear, under penalty of perjury, that the information in this notification\n"
                    "is accurate and that I am the owner or authorized agent of the affected rights.\n\n"
                    "Signature: [RIGHTS OWNER NAME]\n"
                    "Contact:   [EMAIL ADDRESS]"
                ),
                "status": "pending",
            },
            {
                "platform": "udrp_wipo",
                "platform_category": "domain_registrar",
                "infringing_url": "http://official-nike.net",
                "submission_url": "https://www.wipo.int/amc/en/domains/",
                "submission_method": "udrp",
                "submission_email": None,
                "notice_text": (
                    "UDRP COMPLAINT — WIPO ARBITRATION AND MEDIATION CENTER\n"
                    "=========================================================\n"
                    "Date: 2026-06-08\n"
                    "Platform: udrp_wipo\n\n"
                    "Complainant: [RIGHTS OWNER NAME] (authorized representative of Nike, Inc.)\n\n"
                    "Respondent domain: official-nike.net\n\n"
                    "Grounds for complaint:\n"
                    "  The domain 'official-nike.net' is confusingly similar to the registered\n"
                    "  Nike trademark. The registrant has no legitimate rights or interests in\n"
                    "  the name and registered it in bad faith to redirect traffic to\n"
                    "  unauthorized resellers of counterfeit Nike products.\n\n"
                    "Relief requested: Transfer of domain to complainant.\n\n"
                    "I swear, under penalty of perjury, that the information in this notification\n"
                    "is accurate and that I am the owner or authorized agent of the affected rights.\n\n"
                    "Signature: [RIGHTS OWNER NAME]\n"
                    "Contact:   [EMAIL ADDRESS]"
                ),
                "status": "pending",
            },
            {
                "platform": "udrp_icann",
                "platform_category": "domain_registrar",
                "infringing_url": "http://nikesale.org",
                "submission_url": "https://www.icann.org/resources/pages/help/dndr/udrp-en",
                "submission_method": "udrp",
                "submission_email": None,
                "notice_text": (
                    "UDRP COMPLAINT — ICANN\n"
                    "======================\n"
                    "Date: 2026-06-08\n"
                    "Platform: udrp_icann\n\n"
                    "Complainant: [RIGHTS OWNER NAME] (authorized representative of Nike, Inc.)\n\n"
                    "Respondent domain: nikesale.org\n\n"
                    "Grounds for complaint:\n"
                    "  The domain 'nikesale.org' is confusingly similar to the registered\n"
                    "  Nike trademark. The registrant has no legitimate rights or interests in\n"
                    "  the name and registered it in bad faith to divert consumers seeking\n"
                    "  authentic Nike products to counterfeit storefronts.\n\n"
                    "Relief requested: Transfer of domain to complainant.\n\n"
                    "I swear, under penalty of perjury, that the information in this notification\n"
                    "is accurate and that I am the owner or authorized agent of the affected rights.\n\n"
                    "Signature: [RIGHTS OWNER NAME]\n"
                    "Contact:   [EMAIL ADDRESS]"
                ),
                "status": "pending",
            },
            {
                "platform": "meta_ads",
                "platform_category": "ad_platform",
                "infringing_url": "https://fake-nike-store.com",
                "submission_url": "https://www.facebook.com/help/contact/1735443093393986",
                "submission_method": "api",
                "submission_email": None,
                "notice_text": (
                    "TRADEMARK INFRINGEMENT — META ADS (API SUBMISSION)\n"
                    "====================================================\n"
                    "Date: 2026-06-08\n"
                    "Platform: meta_ads\n\n"
                    "To Whom It May Concern,\n\n"
                    "I am the owner / authorized representative of the intellectual property rights\n"
                    "for the brand \"Nike\".\n\n"
                    "I have a good faith belief that the advertisement below infringes upon\n"
                    "my intellectual property rights without authorization:\n\n"
                    "  Ad copy: \"Official Nike clearance — up to 80% off\"\n"
                    "  Destination URL: https://fake-nike-store.com\n\n"
                    "My rights:\n"
                    "  Registered trademark / copyright for \"Nike\" covering goods and\n"
                    "  services in relevant classes.\n\n"
                    "Key evidence:\n"
                    "  - Meta ad impersonates Nike brand to redirect users to unauthorized storefront\n\n"
                    "I request the immediate removal of this advertisement.\n\n"
                    "I swear, under penalty of perjury, that the information in this notification\n"
                    "is accurate and that I am the owner or authorized agent of the affected rights.\n\n"
                    "Signature: [RIGHTS OWNER NAME]\n"
                    "Contact:   [EMAIL ADDRESS]"
                ),
                "status": "pending",
            },
        ],
    },

    "rolex": {
        "case_id": "7cb12a91-3f28-4d7e-a501-9e4b2f77cd12",
        "decision": {
            "risk_level": "HIGH",
            "recommended_action": "TAKEDOWN",
            "case_summary": (
                "3 counterfeit Rolex listings found on Amazon priced between $45–$120, "
                "compared to genuine retail of $7,000+. Seller 'LuxuryTimeHK' has "
                "multiple active listings with forged certification claims. "
                "2 clone domains registered in 2025 actively impersonating the brand."
            ),
            "confidence_score": 0.97,
            "evidence_quality": "STRONG",
            "key_findings": [
                "3 counterfeit listings on Amazon, prices 98% below authentic retail",
                "Seller 'LuxuryTimeHK' claims 'Swiss Made' and 'Official Dealer' — both false",
                "Seller 'WatchDealsPro' listing includes forged serial number format",
                "Domain 'rolex-official-store.shop' registered 2025-11-03, clones brand site",
                "Domain 'buyrolex-authentic.co' redirects to grey-market storefront",
            ],
        },
        "evidence": {
            "marketplaces": [
                {"platform": "amazon", "seller_name": "LuxuryTimeHK", "listing_url": "https://amazon.com/dp/B0ROLEX01", "price": "$89.00", "screenshot_url": None},
                {"platform": "amazon", "seller_name": "LuxuryTimeHK", "listing_url": "https://amazon.com/dp/B0ROLEX02", "price": "$120.00", "screenshot_url": None},
                {"platform": "amazon", "seller_name": "WatchDealsPro", "listing_url": "https://amazon.com/dp/B0ROLEX03", "price": "$45.00", "screenshot_url": None},
            ],
            "ads": [],
            "domains": [
                {"domain_name": "rolex-official-store.shop", "registrar": "Namecheap Inc.", "is_clone": True, "similarity_score": 90},
                {"domain_name": "buyrolex-authentic.co", "registrar": "unknown", "is_clone": True, "similarity_score": 90},
            ],
            "social": [],
        },
        "takedown_reports": [
            {
                "platform": "amazon",
                "platform_category": "marketplace",
                "infringing_url": "https://amazon.com/dp/B0ROLEX01",
                "submission_url": "https://www.amazon.com/report/infringement",
                "submission_method": "web_form",
                "submission_email": None,
                "notice_text": (
                    "DMCA / IP INFRINGEMENT NOTICE\n"
                    "==============================\n"
                    "Date: 2026-06-08\n"
                    "Platform: amazon\n\n"
                    "To Whom It May Concern,\n\n"
                    "I am the owner / authorized representative of the intellectual property rights\n"
                    "for the brand \"Rolex\".\n\n"
                    "I have a good faith belief that the content at the URLs below infringes upon\n"
                    "my intellectual property rights without authorization:\n\n"
                    "  Infringing URLs:\n"
                    "    - https://amazon.com/dp/B0ROLEX01 (seller: LuxuryTimeHK, $89.00)\n"
                    "    - https://amazon.com/dp/B0ROLEX02 (seller: LuxuryTimeHK, $120.00)\n"
                    "    - https://amazon.com/dp/B0ROLEX03 (seller: WatchDealsPro, $45.00)\n\n"
                    "My rights:\n"
                    "  Registered trademark / copyright for \"Rolex\" covering goods and\n"
                    "  services in relevant classes.\n\n"
                    "Key evidence:\n"
                    "  - 3 counterfeit listings on Amazon, prices 98% below authentic retail\n"
                    "  - Seller 'LuxuryTimeHK' claims 'Swiss Made' and 'Official Dealer' — both false\n"
                    "  - Seller 'WatchDealsPro' listing includes forged serial number format\n\n"
                    "I request the immediate removal or disabling of access to all infringing\n"
                    "materials identified above.\n\n"
                    "I swear, under penalty of perjury, that the information in this notification\n"
                    "is accurate and that I am the owner or authorized agent of the affected rights.\n\n"
                    "Signature: [RIGHTS OWNER NAME]\n"
                    "Contact:   [EMAIL ADDRESS]"
                ),
                "status": "pending",
            },
            {
                "platform": "namecheap",
                "platform_category": "domain_registrar",
                "infringing_url": "http://rolex-official-store.shop",
                "submission_url": None,
                "submission_method": "email",
                "submission_email": "[email protected]",
                "notice_text": (
                    "DMCA / IP INFRINGEMENT NOTICE\n"
                    "==============================\n"
                    "Date: 2026-06-08\n"
                    "Platform: namecheap\n\n"
                    "To Whom It May Concern,\n\n"
                    "I am the owner / authorized representative of the intellectual property rights\n"
                    "for the brand \"Rolex\".\n\n"
                    "I have a good faith belief that the content at the URL below infringes upon\n"
                    "my intellectual property rights without authorization:\n\n"
                    "  Infringing URL: http://rolex-official-store.shop\n\n"
                    "My rights:\n"
                    "  Registered trademark / copyright for \"Rolex\" covering goods and\n"
                    "  services in relevant classes.\n\n"
                    "Key evidence:\n"
                    "  - Domain 'rolex-official-store.shop' registered 2025-11-03, clones brand site\n\n"
                    "I request the immediate removal or disabling of access to the infringing\n"
                    "material identified above.\n\n"
                    "I swear, under penalty of perjury, that the information in this notification\n"
                    "is accurate and that I am the owner or authorized agent of the affected rights.\n\n"
                    "Signature: [RIGHTS OWNER NAME]\n"
                    "Contact:   [EMAIL ADDRESS]"
                ),
                "status": "pending",
            },
            {
                "platform": "cloudflare",
                "platform_category": "domain_registrar",
                "infringing_url": "http://buyrolex-authentic.co",
                "submission_url": "https://abuse.cloudflare.com/dmca",
                "submission_method": "web_form",
                "submission_email": None,
                "notice_text": (
                    "DMCA / IP INFRINGEMENT NOTICE\n"
                    "==============================\n"
                    "Date: 2026-06-08\n"
                    "Platform: cloudflare\n\n"
                    "To Whom It May Concern,\n\n"
                    "I am the owner / authorized representative of the intellectual property rights\n"
                    "for the brand \"Rolex\".\n\n"
                    "I have a good faith belief that the content at the URL below infringes upon\n"
                    "my intellectual property rights without authorization:\n\n"
                    "  Infringing URL: http://buyrolex-authentic.co\n\n"
                    "My rights:\n"
                    "  Registered trademark / copyright for \"Rolex\" covering goods and\n"
                    "  services in relevant classes.\n\n"
                    "Key evidence:\n"
                    "  - Domain 'buyrolex-authentic.co' redirects to grey-market storefront\n\n"
                    "I request the immediate removal or disabling of access to the infringing\n"
                    "material identified above.\n\n"
                    "I swear, under penalty of perjury, that the information in this notification\n"
                    "is accurate and that I am the owner or authorized agent of the affected rights.\n\n"
                    "Signature: [RIGHTS OWNER NAME]\n"
                    "Contact:   [EMAIL ADDRESS]"
                ),
                "status": "pending",
            },
        ],
    },

    "apple": {
        "case_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "decision": {
            "risk_level": "MEDIUM",
            "recommended_action": "MONITOR",
            "case_summary": (
                "2 suspicious Amazon listings selling uncertified Apple-branded accessories "
                "without MFi certification, suggesting counterfeit or grey-market goods. "
                "1 typosquatting domain detected targeting Apple Support users. "
                "No immediate takedown threshold reached — monitoring recommended."
            ),
            "confidence_score": 0.76,
            "evidence_quality": "MODERATE",
            "key_findings": [
                "2 Amazon listings selling Apple-branded cables without MFi certification badge",
                "Seller 'TechAccessoriesGZ' pricing 70% below Apple Store",
                "Domain 'apple-support-help.store' mimics Apple Support portal",
                "No paid ad abuse on Google or Meta detected",
            ],
        },
        "evidence": {
            "marketplaces": [
                {"platform": "amazon", "seller_name": "TechAccessoriesGZ", "listing_url": "https://amazon.com/dp/B0APPLE01", "price": "$8.99", "screenshot_url": None},
                {"platform": "amazon", "seller_name": "iGadgetDeals", "listing_url": "https://amazon.com/dp/B0APPLE02", "price": "$11.49", "screenshot_url": None},
            ],
            "ads": [],
            "domains": [
                {"domain_name": "apple-support-help.store", "registrar": "GoDaddy LLC", "is_clone": True, "similarity_score": 90},
            ],
            "social": [],
        },
        "takedown_reports": [],
    },
}

_FALLBACK_MOCK = {
    "decision": {
        "risk_level": "LOW",
        "recommended_action": "DISMISS",
        "case_summary": (
            "No suspicious marketplace listings, ads, or domains were detected "
            "for this brand at this time. No enforcement action is required."
        ),
        "confidence_score": 0.88,
        "evidence_quality": "WEAK",
        "key_findings": [
            "0 suspicious listings found across monitored marketplaces",
            "0 typosquatting domains detected via WHOIS",
            "No paid ad abuse detected",
        ],
    },
    "evidence": {
        "marketplaces": [],
        "ads": [],
        "domains": [],
        "social": [],
    },
    "takedown_reports": [],
}


@router.post("", response_model=CheckBrandResponse)
def check_brand_mock(payload: CheckBrandRequest, current_user=Depends(get_current_user)) -> CheckBrandResponse:
    """
    Run a full brand protection check and return an enforcement decision.

    Scrapes marketplace listings, checks typosquatting domains, and scans
    ad platforms for the given brand name. Returns aggregated evidence and
    an AI-generated enforcement decision.

    **Mocked brands:** `nike`, `rolex`, `apple`, `derila`, `matsato`. Any other name returns a LOW / DISMISS scenario.

    ---

   """
    if payload.brand_name == "error":
        raise Exception("Check for error handling")

    import uuid
    import time
    time.sleep(10)
    key = payload.brand_name.strip().lower()
    mock = MOCK_DB.get(key, _FALLBACK_MOCK)

    return CheckBrandResponse(
        case_id=mock.get("case_id", str(uuid.uuid4())),
        decision=DecisionResponse(**mock["decision"]),
        evidence=EvidenceResponse(
            **{k: v for k, v in mock["evidence"].items()},
            timestamp=datetime.now(),
        ),
        takedown_reports=[TakedownReport(**r) for r in mock["takedown_reports"]],
    )