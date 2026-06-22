import os
import json
from supabase import create_client

supabase_url = "https://kdiyjwwejrdqnccfqhyv.supabase.co"
supabase_key = "sb_secret_***REVOKED***"

supabase = create_client(supabase_url, supabase_key)

cid = "dd1dc542-a24c-4c06-a593-0c318f0a7405"

# Run get_full_case equivalent query
res = supabase.table("cases").select("*, decisions(*), evidence(*), takedown_reports(*)").eq("id", cid).single().execute()
print("FULL CASE RETRIEVED:")
print(json.dumps(res.data, indent=2))
