## 2024-05-20 - [IDOR in Takedown / Document APIs]
**Vulnerability:** Takedown and Document sending endpoints lacked authorization checks, allowing IDOR.
**Learning:** The FastAPI backend accesses Supabase using the service role key, bypassing RLS. Therefore, any endpoint retrieving or updating data (like `update_takedown_report_endpoint` or `send_document_email_endpoint`) must manually enforce organization ownership using `CurrentProfile`.
**Prevention:** Always inject `profile: CurrentProfile = Depends(get_current_profile)` and manually query the DB to verify that the resource (or its parent case) belongs to `profile.organization_id`.
