import type { CheckBrandResponse } from "./api.types";

// Base URL of the customer app, for linking to case pages in escalation emails.
// Evidence screenshots live in a PRIVATE bucket (C5) and are served via
// short-lived signed URLs, which would 403 by the time an email is read. So
// emails link to the (auth-gated, permanent) in-app case page instead of
// embedding a raw screenshot URL.
const APP_BASE_URL =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_APP_URL) ||
  (typeof window !== "undefined" ? window.location.origin : "https://hakkiu.com");

function caseLink(caseId: string): string {
  return `${APP_BASE_URL}/cases/${caseId}`;
}

/**
 * Trigger browser-based compose window for Gmail or default mail client.
 */
export function openEscalationEmail(options: {
  emailPreference: string;
  subject: string;
  body: string;
}) {
  const { emailPreference, subject, body } = options;
  const isGmail = emailPreference.toLowerCase().endsWith("@gmail.com") || emailPreference.toLowerCase().includes("gmail");

  if (isGmail) {
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(gmailUrl, "_blank");
  } else {
    const mailtoUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoUrl;
  }
}

/**
 * Generate email text for a single suspicious activity / infringement case.
 */
export function buildInfringementEscalationText(i: any): { subject: string; body: string } {
  const caseId = i.id || "N/A";
  const platform = i.platform || "N/A";
  const sourceUrl = i.source_url || "N/A";
  const riskLevel = i.risk_level || "N/A";
  const matchScore = i.match_score !== undefined ? `${i.match_score}%` : "N/A";
  const matchType = i.match_type || "N/A";
  const evidenceLink = i.case_id ? caseLink(i.case_id) : caseLink(caseId);
  const dateStr = i.flagged_at ? new Date(i.flagged_at).toLocaleString() : new Date().toLocaleString();

  const subject = `Escalation: Possible IP Risk Detected - Case #${caseId.slice(0, 8).toUpperCase()}`;
  const body = `Hello,

This case has been escalated for review due to a potential intellectual property (IP) risk.

Case Details:
- Case/Infringement ID: ${caseId}
- Platform: ${platform}
- Source URL: ${sourceUrl}
- Risk Level: ${riskLevel}
- Match Score: ${matchScore}
- Match Type: ${matchType}
- Detected At: ${dateStr}

Evidence:
- Target URL: ${sourceUrl}
- Evidence & screenshot (view in HAKKIU): ${evidenceLink}
- Additional Details: Potential trademark/copyright violation identified on ${platform}.

Please review and initiate the appropriate legal/takedown procedure.

Best regards,`;

  return { subject, body };
}

/**
 * Generate email text for a full brand scan / case report.
 */
export function buildScanResultEscalationText(caseId: string, result: CheckBrandResponse): { subject: string; body: string } {
  const brandName = result.evidence?.marketplaces?.[0]?.seller_name || "your brand";
  const decision = result.decision;
  const evidence = result.evidence;

  const subject = `Escalation: Brand Infringement & IP Risk Report - Case #${caseId.slice(0, 8).toUpperCase()}`;

  let body = `Hello,

This case has been escalated for review due to a potential intellectual property (IP) risk. Below is the decision summary and compiled evidence.

Scan Overview:
- Case ID: ${caseId}
- Risk Level: ${decision?.risk_level || "HIGH"}
- Recommended Action: ${decision?.recommended_action || "TAKEDOWN"}
- Confidence Score: ${decision?.confidence_score !== undefined ? `${decision.confidence_score}%` : "N/A"}
- Evidence Quality: ${decision?.evidence_quality || "N/A"}

`;

  if (decision?.case_summary) {
    body += `Decision Summary:\n${decision.case_summary}\n\n`;
  }

  if (decision?.key_findings && decision.key_findings.length > 0) {
    body += `Key Findings:\n`;
    decision.key_findings.forEach((finding) => {
      body += `- ${finding}\n`;
    });
    body += `\n`;
  }

  body += `Compiled Evidence:\n`;
  // Screenshots live in a private bucket (C5); link to the in-app case page
  // (auth-gated, permanent) rather than embedding expiring signed URLs.
  body += `Full evidence & screenshots (view in HAKKIU): ${caseLink(caseId)}\n`;

  // Marketplaces
  if (evidence?.marketplaces && evidence.marketplaces.length > 0) {
    body += `\nMarketplace Listings:\n`;
    evidence.marketplaces.forEach((item) => {
      body += `- Seller: ${item.seller_name} on ${item.platform}\n`;
      body += `  URL: ${item.listing_url}\n`;
      if (item.price) body += `  Price: ${item.price}\n`;
    });
  }

  // Domains
  if (evidence?.domains && evidence.domains.length > 0) {
    body += `\nWeb Domains:\n`;
    evidence.domains.forEach((item) => {
      body += `- Domain: ${item.domain_name} (Registrar: ${item.registrar || "N/A"})\n`;
      body += `  Similarity Score: ${item.similarity_score}%\n`;
      body += `  Is Clone: ${item.is_clone ? "Yes" : "No"}\n`;
    });
  }

  // Ads
  if (evidence?.ads && evidence.ads.length > 0) {
    body += `\nAdvertisements:\n`;
    evidence.ads.forEach((item) => {
      body += `- Ad Copy: "${item.ad_copy}" on ${item.platform}\n`;
      body += `  Destination URL: ${item.destination_url}\n`;
    });
  }

  // Social
  if (evidence?.social && evidence.social.length > 0) {
    body += `\nSocial Media accounts:\n`;
    evidence.social.forEach((item) => {
      body += `- Handle: ${item.handle} on ${item.platform}\n`;
      if (item.post_url) body += `  Post URL: ${item.post_url}\n`;
      if (item.follower_count) body += `  Followers: ${item.follower_count}\n`;
    });
  }

  body += `\nPlease review and initiate the appropriate legal/takedown procedure.

Best regards,`;

  return { subject, body };
}
