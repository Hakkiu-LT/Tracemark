from fastapi import APIRouter
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Literal, Optional

router = APIRouter(prefix="/check-brand", tags=["check-brand"])


class CheckBrandRequest(BaseModel):
    brand_name: str
    platforms: list[str] = ["amazon", "google_ads", "domains"]


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


class CheckBrandResponse(BaseModel):
    case_id: str
    decision: DecisionResponse
    evidence: EvidenceResponse


MOCK_DB: dict[str, dict] = {
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
                "No Meta or Google Ads abuse detected at this time",
            ],
        },
        "evidence": {
            "marketplaces": [
                {
                    "platform": "amazon",
                    "seller_name": "ShenzhenSportsMax",
                    "listing_url": "https://amazon.com/dp/B0NIKE001",
                    "price": "$22.40",
                    "screenshot_url": None,
                },
                {
                    "platform": "amazon",
                    "seller_name": "ShenzhenSportsMax",
                    "listing_url": "https://amazon.com/dp/B0NIKE002",
                    "price": "$18.99",
                    "screenshot_url": None,
                },
                {
                    "platform": "amazon",
                    "seller_name": "TopGearHK",
                    "listing_url": "https://amazon.com/dp/B0NIKE003",
                    "price": "$34.00",
                    "screenshot_url": None,
                },
                {
                    "platform": "amazon",
                    "seller_name": "TopGearHK",
                    "listing_url": "https://amazon.com/dp/B0NIKE004",
                    "price": "$29.50",
                    "screenshot_url": None,
                },
                {
                    "platform": "amazon",
                    "seller_name": "TopGearHK",
                    "listing_url": "https://amazon.com/dp/B0NIKE005",
                    "price": "$31.00",
                    "screenshot_url": None,
                },
                {
                    "platform": "amazon",
                    "seller_name": "GuangzhouBestShoes",
                    "listing_url": "https://amazon.com/dp/B0NIKE006",
                    "price": "$24.99",
                    "screenshot_url": None,
                },
                {
                    "platform": "amazon",
                    "seller_name": "FastDeals_SZ",
                    "listing_url": "https://amazon.com/dp/B0NIKE007",
                    "price": "$19.00",
                    "screenshot_url": None,
                },
            ],
            "ads": [],
            "domains": [
                {
                    "domain_name": "nike-outlet-official.shop",
                    "registrar": "Namecheap Inc.",
                    "is_clone": True,
                    "similarity_score": 90,
                },
                {
                    "domain_name": "buynike-cheap.store",
                    "registrar": "GoDaddy LLC",
                    "is_clone": True,
                    "similarity_score": 90,
                },
                {
                    "domain_name": "official-nike.net",
                    "registrar": "unknown",
                    "is_clone": True,
                    "similarity_score": 90,
                },
                {
                    "domain_name": "nikesale.org",
                    "registrar": "Tucows Domains Inc.",
                    "is_clone": True,
                    "similarity_score": 90,
                },
            ],
            "social": [],
        },
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
                {
                    "platform": "amazon",
                    "seller_name": "LuxuryTimeHK",
                    "listing_url": "https://amazon.com/dp/B0ROLEX01",
                    "price": "$89.00",
                    "screenshot_url": None,
                },
                {
                    "platform": "amazon",
                    "seller_name": "LuxuryTimeHK",
                    "listing_url": "https://amazon.com/dp/B0ROLEX02",
                    "price": "$120.00",
                    "screenshot_url": None,
                },
                {
                    "platform": "amazon",
                    "seller_name": "WatchDealsPro",
                    "listing_url": "https://amazon.com/dp/B0ROLEX03",
                    "price": "$45.00",
                    "screenshot_url": None,
                },
            ],
            "ads": [],
            "domains": [
                {
                    "domain_name": "rolex-official-store.shop",
                    "registrar": "Namecheap Inc.",
                    "is_clone": True,
                    "similarity_score": 90,
                },
                {
                    "domain_name": "buyrolex-authentic.co",
                    "registrar": "unknown",
                    "is_clone": True,
                    "similarity_score": 90,
                },
            ],
            "social": [],
        },
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
                {
                    "platform": "amazon",
                    "seller_name": "TechAccessoriesGZ",
                    "listing_url": "https://amazon.com/dp/B0APPLE01",
                    "price": "$8.99",
                    "screenshot_url": None,
                },
                {
                    "platform": "amazon",
                    "seller_name": "iGadgetDeals",
                    "listing_url": "https://amazon.com/dp/B0APPLE02",
                    "price": "$11.49",
                    "screenshot_url": None,
                },
            ],
            "ads": [],
            "domains": [
                {
                    "domain_name": "apple-support-help.store",
                    "registrar": "GoDaddy LLC",
                    "is_clone": True,
                    "similarity_score": 90,
                },
            ],
            "social": [],
        },
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
}


@router.post("", response_model=CheckBrandResponse)
def check_brand_mock(payload: CheckBrandRequest) -> CheckBrandResponse:
    """
    Run a full brand protection check and return an enforcement decision.

    Scrapes marketplace listings, checks typosquatting domains, and scans
    ad platforms for the given brand name. Returns aggregated evidence and
    an AI-generated enforcement decision.

    **Mocked brands:** `nike`, `rolex`, `apple`. Any other name returns a LOW / DISMISS scenario.

    ---

   """
    if (payload.brand_name == "error"):
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
    )