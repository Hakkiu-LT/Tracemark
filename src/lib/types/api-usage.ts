export interface ApiUsageSummary {
  api_key: string;
  label: string;
  category: "search" | "whois" | "ads" | "ai" | "scraper";
  free_limit: number;
  reset_period: "midnight_utc" | "monthly";
  used_today: number;
  remaining: number;
  percent_used: number;
  is_blocked: boolean;
  last_called_at: string | null;
  requires_env_var: string | null;
  env_var_present: boolean;
}

export interface DeveloperUsageSummary {
  caller_id: string;
  total_calls_today: number;
  by_api: Record<string, number>;
}

export interface HourlyBucket {
  hour: string;
  count: number;
}

export interface UsageStatsResponse {
  summary: ApiUsageSummary[];
  by_developer: DeveloperUsageSummary[];
  hourly: HourlyBucket[];
  generated_at: string;
}
