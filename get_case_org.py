import os
import sys
sys.path.append(os.path.join(os.getcwd(), "apps/api/src"))

os.environ["SUPABASE_URL"] = "http://localhost:54321"
os.environ["SUPABASE_SERVICE_ROLE_KEY"] = "fake-key"
from tracemark_api.services.database import get_supabase

def test_query():
    try:
        sb = get_supabase()
        res = sb.table("cases").select("id, organization_id").limit(1).execute()
        print("Success:", res.data)
    except Exception as e:
        print("Error:", e)

test_query()
