<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
## 2025-02-14 - [IDOR in case/takedown report access]
**Vulnerability:** In `apps/api/src/tracemark_api/routes/monitoring.py`, the validation functions `_assert_case_in_org` and `_assert_takedown_in_org` only checked against `organization_id`. For personal users (who don't have an organization, so `org_id` is None), they could access any case or takedown report that also had a `None` organization, allowing arbitrary cross-user data access.
**Learning:** Due to the backend's Supabase RLS bypass, manual assertions must comprehensively validate ownership for *both* organizational users and personal users. A `None == None` equality check for organizations is a common IDOR pitfall for resources lacking explicit user-level validation.
**Prevention:** Always implement dual validation patterns. When asserting ownership, if `organization_id` is absent, fall back to strictly matching the `user_id` of the resource owner against the calling profile's ID.
=======
## 2024-07-05 - SSRF Protection via DNS Resolution Validation
**Vulnerability:** The URL validation logic for monitoring target URLs only relied on string prefix checks against a list of private network addresses (e.g., `127.`, `10.`). This was susceptible to bypasses via decimal IP representation (e.g. `2130706433` for `127.0.0.1`) and DNS resolution pointing to internal IPs (e.g. `localtest.me` resolving to `127.0.0.1`).
**Learning:** In URL validation for potential SSRF vectors, string-based blocklists are insufficient because standard HTTP clients resolve hostnames to IP addresses before making the request. Attackers can control the DNS records of domains they own or use alternative IP representations.
**Prevention:** Incorporate active DNS resolution (`socket.gethostbyname`) during the validation phase and check the resulting resolved IP address against known private/loopback ranges using the `ipaddress` module. Note that while this provides defense-in-depth, robust SSRF protection against DNS rebinding (TOCTOU) requires protections at the HTTP client level.
>>>>>>> origin/sentinel-ssrf-validation-fix-3631052636869859238
=======
## 2024-05-20 - [IDOR in Takedown / Document APIs]
**Vulnerability:** Takedown and Document sending endpoints lacked authorization checks, allowing IDOR.
**Learning:** The FastAPI backend accesses Supabase using the service role key, bypassing RLS. Therefore, any endpoint retrieving or updating data (like `update_takedown_report_endpoint` or `send_document_email_endpoint`) must manually enforce organization ownership using `CurrentProfile`.
**Prevention:** Always inject `profile: CurrentProfile = Depends(get_current_profile)` and manually query the DB to verify that the resource (or its parent case) belongs to `profile.organization_id`.
>>>>>>> origin/sentinel-fix-idor-docs-takedowns-17142356003433081144
=======
## 2025-02-14 - [Authorization Bypass on Admin Endpoints]
**Vulnerability:** Empty admin email lists resulted in a fail-open condition, allowing unauthorized access to admin-only API routes.
**Learning:** Checking for the presence of a restricted list (`if admin_emails and ...`) creates a dangerous fail-open scenario if the environment variable is unconfigured.
**Prevention:** Always default to deny. Use `if not admin_emails or user_email not in admin_emails:` to ensure access is explicitly blocked when the authorization configuration is missing.
>>>>>>> origin/sentinel/auth-bypass-admin-routes-14599662050365692217
