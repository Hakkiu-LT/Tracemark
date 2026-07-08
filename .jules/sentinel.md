## 2025-02-14 - [Authorization Bypass on Admin Endpoints]
**Vulnerability:** Empty admin email lists resulted in a fail-open condition, allowing unauthorized access to admin-only API routes.
**Learning:** Checking for the presence of a restricted list (`if admin_emails and ...`) creates a dangerous fail-open scenario if the environment variable is unconfigured.
**Prevention:** Always default to deny. Use `if not admin_emails or user_email not in admin_emails:` to ensure access is explicitly blocked when the authorization configuration is missing.
