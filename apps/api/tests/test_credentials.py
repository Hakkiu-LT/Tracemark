import os
import requests
import pytest
from datetime import datetime, timezone
from dotenv import load_dotenv, find_dotenv
from google import genai
from tracemark_api.services.database import get_supabase

# Load env variables
env_path = find_dotenv()
load_dotenv(env_path)

# Map local env variables to match Docker Compose settings if they are not already set
if "SUPABASE_URL" not in os.environ and "VITE_SUPABASE_URL" in os.environ:
    os.environ["SUPABASE_URL"] = os.environ["VITE_SUPABASE_URL"]
if "SUPABASE_SERVICE_ROLE_KEY" not in os.environ and "SUPABASE_SECRET_KEY" in os.environ:
    os.environ["SUPABASE_SERVICE_ROLE_KEY"] = os.environ["SUPABASE_SECRET_KEY"]


@pytest.mark.integration
def test_supabase_credentials():
    url = os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or os.environ.get("SUPABASE_SECRET_KEY")
    
    assert url is not None, "SUPABASE_URL / VITE_SUPABASE_URL environment variable is not defined in .env"
    assert key is not None, "SUPABASE_SECRET_KEY / SUPABASE_SERVICE_ROLE_KEY environment variable is not defined in .env"
    assert url.strip() != "", "SUPABASE_URL is empty"
    assert key.strip() != "", "SUPABASE_SECRET_KEY is empty"
    
    print("Verifying Supabase credentials against connection...")
    try:
        sb = get_supabase()
        res = sb.table("cases").select("id").limit(1).execute()
        assert res.data is not None
        print("Success: Supabase credentials are valid!")
    except Exception as e:
        pytest.fail(f"Supabase connection/authentication failed: {e}")

@pytest.mark.integration
def test_gemini_api_key():
    api_key = os.environ.get("GEMINI_API_KEY")
    assert api_key is not None, "GEMINI_API_KEY environment variable is not defined in .env"
    assert api_key.strip() != "", "GEMINI_API_KEY is empty"
    
    print("Verifying GEMINI_API_KEY against Google Gemini models list...")
    try:
        client = genai.Client(api_key=api_key)
        # Simply fetching models checks if the key is authentic and active
        models = client.models.list()
        assert list(models) is not None
        print("Success: GEMINI_API_KEY is valid!")
    except Exception as e:
        pytest.fail(f"Gemini API key verification failed: {e}")

@pytest.mark.integration
def test_firecrawl_api_key():
    api_key = os.environ.get("FIRECRAWL_API_KEY")
    assert api_key is not None, "FIRECRAWL_API_KEY environment variable is not defined in .env"
    assert api_key.strip() != "", "FIRECRAWL_API_KEY is empty"
    
    print("Verifying FIRECRAWL_API_KEY by scraping example.com...")
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    payload = {
        "url": "https://example.com",
        "formats": ["markdown"]
    }
    try:
        resp = requests.post(
            "https://api.firecrawl.dev/v1/scrape",
            json=payload,
            headers=headers,
            timeout=15.0
        )
        assert resp.status_code == 200, f"Firecrawl API returned status code {resp.status_code}: {resp.text}"
        data = resp.json()
        assert data.get("success") is True, f"Firecrawl scrape failed: {data}"
        print("Success: FIRECRAWL_API_KEY is valid!")
    except Exception as e:
        pytest.fail(f"Firecrawl API key verification failed: {e}")

@pytest.mark.integration
def test_meta_ads_credentials():
    token = os.environ.get("META_ADS_ACCESS_TOKEN")
    app_id = os.environ.get("META_APP_ID")
    app_secret = os.environ.get("META_APP_SECRET")
    
    assert token is not None, "META_ADS_ACCESS_TOKEN environment variable is not defined in .env"
    assert token.strip() != "", "META_ADS_ACCESS_TOKEN is empty"
    
    if app_id and app_secret:
        print("Verifying Meta Access Token details via debug_token...")
        debug_url = "https://graph.facebook.com/debug_token"
        debug_params = {
            "input_token": token,
            "access_token": f"{app_id}|{app_secret}"
        }
        try:
            debug_resp = requests.get(debug_url, params=debug_params, timeout=15)
            if debug_resp.status_code == 200:
                debug_data = debug_resp.json().get("data", {})
                expires_at = debug_data.get("expires_at")
                if expires_at == 0:
                    print("Token Expiration: Does not expire (never)")
                elif expires_at:
                    expire_date = datetime.fromtimestamp(expires_at, tz=timezone.utc)
                    print(f"Token Expiration: {expire_date.strftime('%Y-%m-%d %H:%M:%S UTC')}")
            else:
                print(f"debug_token check returned status {debug_resp.status_code}: {debug_resp.text}")
        except Exception as e:
            print(f"Failed to query debug_token: {e}")

    print("Verifying Meta Ads Library Access...")
    url = "https://graph.facebook.com/v19.0/ads_archive"
    params = {
        "access_token": token,
        "search_terms": "test",
        "ad_reached_countries": '["US"]',
        "ad_type": "ALL",
        "fields": "id",
        "limit": 1,
    }
    resp = requests.get(url, params=params, timeout=15)
    assert resp.status_code == 200, (
        f"Meta Ads API request failed (Status {resp.status_code}).\n"
        f"Response Details: {resp.text}\n"
        f"Note: Ensure your Meta Access Token is active and your Meta Developer account "
        f"has completed ID verification (https://www.facebook.com/ads/library/api)."
    )
    print("Success: Meta Ads Access Token is active and working!")
