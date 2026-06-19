# Platform Scrapers Implementation Tasks

> **Goal:** Implement specific parsers and scraping logic for target platforms (Amazon, AliExpress, Shopify, eBay, Instagram, TikTok, Meta Ads, Google Ads, and Web Domains) using the `UnifiedScraper` engine and relevant APIs.

---

## 1. Amazon Parser & Scraper
**Focus:** Extract structured listing data from Amazon search results and product pages.
* [ ] Implement selector-based HTML parser inside `AmazonScraper` using `BeautifulSoup`.
* [ ] Extract listing details:
  * Title (`#productTitle`, `span.a-size-medium`)
  * Price (`span.a-price-whole`, `span.a-offscreen`)
  * Seller Name (`#sellerProfileTriggerId`, `#merchant-info`)
  * Product Image URL (`#landingImage`, `img.s-image`)
  * ASIN (extracted from URL or page metadata)
* [ ] Handle bot-detection/blocked requests by falling back to Firecrawl or retrying with headers.

---

## 2. eBay Scraper
**Focus:** Parse eBay listing cards from search results.
* [ ] Implement selector-based HTML parser inside `EbayScraper`.
* [ ] Map selectors for search result items:
  * Listing Container: `.s-item`
  * Title: `.s-item__title`
  * Price: `.s-item__price`
  * Listing URL: `.s-item__link`
  * Seller Name: `.s-item__seller-info`
  * Image URL: `.s-item__image-img`

---

## 3. AliExpress Scraper
**Focus:** Parse JS-rendered content from AliExpress wholesale searches.
* [ ] Integrate AliExpress as a JS-heavy target.
* [ ] Implement parser for JSON/Markdown returned by Firecrawl JS-evaluation.
* [ ] Extract listing items:
  * Title, price, store name, product ID (from URL), and listing cover image.

---

## 4. Shopify Scraper
**Focus:** High-efficiency product JSON extraction for Shopify-hosted stores.
* [ ] Implement `ShopifyScraper` that detects if a domain is powered by Shopify.
* [ ] Fetch structured product feeds directly from `{shop_url}/products.json` (bypasses HTML parsing and scrapers, returning raw clean JSON).
* [ ] Parse products list:
  * Product Title, Handle (slug), Price (variants), Images, and Description.

---

## 5. Social Media: Instagram Scraper
**Focus:** Detect trademark abuse in Instagram profiles, hashtags, and posts.
* [ ] Implement `InstagramScraper` using Firecrawl JS rendering to crawl posts under specific search hashtags or brand-related queries.
* [ ] Extract:
  * Post caption text, post URL, username (handle), and media image/video links.

---

## 6. Social Media: TikTok Scraper
**Focus:** Scan TikTok search results and posts for infringing listings/videos.
* [ ] Implement `TikTokScraper` using Firecrawl JS rendering to load TikTok search results.
* [ ] Extract:
  * Video description (captions), creator handle, video link, and views.

---

## 7. Meta Ads Library Scraper
**Focus:** Detect active trademark infringement in sponsored ads on Facebook and Instagram.
* [ ] Implement `MetaAdsScraper` utilizing the official **Meta Ads Library API** (via `META_ADS_ACCESS_TOKEN` / `META_APP_ID`).
* [ ] Fallback: Scrape the Meta Ads Transparency Library public URL using Firecrawl if API limits are exceeded.
* [ ] Extract:
  * Ad ID, Advertiser Page, Ad Copy, Ad Creative URL (Image/Video), and platforms active on (FB/IG/Messenger).

---

## 8. Google Ads Transparency Scraper
**Focus:** Monitor sponsored search ads and Google Shopping ads using the trademark.
* [ ] Implement `GoogleAdsScraper` to search sponsored search queries via SERP scraping.
* [ ] Scrape the Google Ad Transparency Center to search for ads sponsored by target competitor entities.
* [ ] Extract:
  * Ad Headline, Display URL, Target landing URL, and Advertiser name.

---

## 9. Web Domain Discovery & Scraper
**Focus:** Scan web search results and domain WHOIS details for trademark squatting.
* [ ] Enhance search engine scraper (`GoogleSerpScraper`) to identify newly registered domains containing the trademarked brand keyword.
* [ ] Integrate a domain checker pipeline to check domain availability, registrar, and active hosting state for suspicious domains.
