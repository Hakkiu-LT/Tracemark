export interface CountryConfig {
  code: string;
  name: string;
  flag: string;
}

export interface RegionConfig {
  key: string;
  label: string;
  countries: CountryConfig[];
}

export const REGIONS: RegionConfig[] = [
  {
    key: "NA",
    label: "North America",
    countries: [
      { code: "US", name: "United States", flag: "🇺🇸" },
      { code: "CA", name: "Canada", flag: "🇨🇦" },
    ],
  },
  {
    key: "EMEA",
    label: "Europe, Middle East & Africa",
    countries: [
      { code: "DE", name: "Germany", flag: "🇩🇪" },
      { code: "FR", name: "France", flag: "🇫🇷" },
      { code: "GB", name: "United Kingdom", flag: "🇬🇧" },
    ],
  },
  {
    key: "APAC",
    label: "Asia-Pacific",
    countries: [
      { code: "AU", name: "Australia", flag: "🇦🇺" },
      { code: "SG", name: "Singapore", flag: "🇸🇬" },
      { code: "JP", name: "Japan", flag: "🇯🇵" },
    ],
  },
  {
    key: "LATAM",
    label: "Latin America",
    countries: [
      { code: "BR", name: "Brazil", flag: "🇧🇷" },
      { code: "MX", name: "Mexico", flag: "🇲🇽" },
    ],
  },
];

export const COUNTRY_BY_CODE = REGIONS.reduce<Record<string, CountryConfig>>((acc, reg) => {
  reg.countries.forEach((c) => {
    acc[c.code] = c;
  });
  return acc;
}, {});

export function getRegionForId(id: string): string {
  // Deterministic mapping for consistent proxy/region info
  const regions = ["US", "DE", "JP", "BR", "CA", "FR", "GB", "SG", "MX"];
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idx = Math.abs(hash) % regions.length;
  return regions[idx];
}

export function getMacroRegionForCountry(countryCode: string): string {
  const code = countryCode.toUpperCase();
  if (["US", "CA"].includes(code)) return "North America";
  if (["DE", "FR", "GB"].includes(code)) return "EMEA";
  if (["JP", "SG", "AU"].includes(code)) return "APAC";
  return "LATAM";
}
