import type { CheckBrandResponse } from "./api.types";

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
  const screenshotUrl = i.screenshot_url || "N/A";
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
- Screenshot URL: ${screenshotUrl}
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

  // Marketplaces
  if (evidence?.marketplaces && evidence.marketplaces.length > 0) {
    body += `\nMarketplace Listings:\n`;
    evidence.marketplaces.forEach((item) => {
      body += `- Seller: ${item.seller_name} on ${item.platform}\n`;
      body += `  URL: ${item.listing_url}\n`;
      if (item.price) body += `  Price: ${item.price}\n`;
      if (item.screenshot_url) body += `  Screenshot: ${item.screenshot_url}\n`;
    });
  }

  // Domains
  if (evidence?.domains && evidence.domains.length > 0) {
    body += `\nWeb Domains:\n`;
    evidence.domains.forEach((item) => {
      body += `- Domain: ${item.domain_name} (Registrar: ${item.registrar || "N/A"})\n`;
      body += `  Similarity Score: ${item.similarity_score}%\n`;
      body += `  Is Clone: ${item.is_clone ? "Yes" : "No"}\n`;
      if (item.screenshot_url) body += `  Screenshot: ${item.screenshot_url}\n`;
    });
  }

  // Ads
  if (evidence?.ads && evidence.ads.length > 0) {
    body += `\nAdvertisements:\n`;
    evidence.ads.forEach((item) => {
      body += `- Ad Copy: "${item.ad_copy}" on ${item.platform}\n`;
      body += `  Destination URL: ${item.destination_url}\n`;
      if (item.screenshot_url) body += `  Screenshot: ${item.screenshot_url}\n`;
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
