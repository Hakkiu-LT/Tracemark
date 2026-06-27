export interface MarketplaceEvidence {
  platform: string;
  seller_name: string;
  listing_url: string;
  price: string | null;
  screenshot_url: string | null;
}

export interface AdEvidence {
  platform: string;
  ad_copy: string;
  destination_url: string;
  screenshot_url: string | null;
}

export interface DomainEvidence {
  domain_name: string;
  registrar: string | null;
  is_clone: boolean;
  similarity_score: number;
  screenshot_url: string | null;
  creation_date?: string | null;
  expiry_date?: string | null;
  name_servers?: string[] | null;
  registrant_organization?: string | null;
  registrant_country?: string | null;
  registrant_email?: string | null;
}

export interface SocialEvidence {
  platform: string;
  handle: string;
  post_url: string | null;
  follower_count: number | null;
}

export interface EvidenceResponse {
  marketplaces: MarketplaceEvidence[];
  ads: AdEvidence[];
  domains: DomainEvidence[];
  social: SocialEvidence[];
  timestamp: string;
}

export type RiskLevel = "HIGH" | "MEDIUM" | "LOW";
export type RecommendedAction = "TAKEDOWN" | "MONITOR" | "DISMISS";
export type EvidenceQuality = "STRONG" | "MODERATE" | "WEAK";

export interface DecisionResponse {
  risk_level: RiskLevel;
  recommended_action: RecommendedAction;
  case_summary: string;
  confidence_score: number;
  evidence_quality: EvidenceQuality;
  key_findings: string[];
}

export interface TakedownReport {
  id?: string;
  platform: string;
  platform_category: "marketplace" | "social_media" | "search_engine" | "ad_platform" | "domain_registrar" | "app_store" | "other";
  infringing_url: string;
  submission_url: string | null;
  submission_method: "web_form" | "email" | "api" | "udrp";
  submission_email: string | null;
  notice_text: string;
  status: string;
}

export interface CheckBrandResponse {
  case_id: string;
  decision: DecisionResponse;
  evidence: EvidenceResponse;
  takedown_reports: TakedownReport[];
}

export interface CheckBrandRequest {
  brand_name: string;
  platforms?: string[];
}
