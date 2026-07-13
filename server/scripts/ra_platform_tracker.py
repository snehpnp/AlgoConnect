"""
RA Platform Tracker — AlgoConnect
===================================
Sirf SEBI Research Analysts (registrationNo ILIKE 'INH%') ke liye chalega.

Har RA lead ke liye:
  1. Uske naam + registration number se Google search karta hai
  2. Unke khud ke website ke ALAWA jo bhi platforms/directories milte hain —
     SEBI portal, NSE, BSE, Moneycontrol, Tickertape, Smallcase, Groww,
     JustDial, IndiaMART, Ambitionbox etc. — un sab ke URLs collect karta hai
  3. Top 5 unique platform URLs ko DB ke "otherListings" column me store karta hai
     (JSON array: [{"platform":"SEBI","url":"...","title":"...","snippet":"..."}])

Prerequisites:
  pip install requests psycopg2-binary python-dotenv

Env vars (.env ya shell):
  DATABASE_URL        -> postgresql://user:pass@host:5432/algoconnect
  SERPER_API_KEY(S)   -> comma-separated Serper.dev API keys

Usage:
  python scripts/ra_platform_tracker.py --limit 50 --workers 5
  python scripts/ra_platform_tracker.py --limit 0       # saare RA leads
"""

import argparse
import json
import os
import threading
import time
import random
import concurrent.futures
from urllib.parse import urlparse

import psycopg2
import psycopg2.extras
import requests

REQUEST_TIMEOUT = 12
DELAY_BETWEEN_LEADS = 0.5
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
MAX_LISTINGS = 5

PLATFORM_NAMES = {
    "sebi.gov.in": "SEBI",
    "nseindia.com": "NSE India",
    "bseindia.com": "BSE India",
    "moneycontrol.com": "Moneycontrol",
    "tickertape.in": "Tickertape",
    "smallcase.com": "Smallcase",
    "groww.in": "Groww",
    "economictimes": "Economic Times",
    "livemint.com": "Livemint",
    "business-standard.com": "Business Standard",
    "chittorgarh.com": "Chittorgarh",
    "screener.in": "Screener",
    "tradebrains.in": "Trade Brains",
    "justdial.com": "JustDial",
    "indiamart.com": "IndiaMART",
    "linkedin.com": "LinkedIn",
    "facebook.com": "Facebook",
    "twitter.com": "Twitter/X",
    "x.com": "Twitter/X",
    "youtube.com": "YouTube",
    "instagram.com": "Instagram",
    "mfcentral.com": "MF Central",
    "advisorkhoj.com": "AdvisorKhoj",
    "crunchbase.com": "Crunchbase",
    "zaubacorp.com": "Zaubacorp",
    "paisabazaar.com": "Paisabazaar",
    "finanzen.net": "Finanzen",
}


def search_serper(query, api_key, num=10):
    if not api_key:
        return []
    for attempt in range(5):
        try:
            resp = requests.post(
                "https://google.serper.dev/search",
                headers={"X-API-KEY": api_key, "Content-Type": "application/json"},
                json={"q": query, "num": num},
                timeout=REQUEST_TIMEOUT,
            )
            if resp.status_code in (429, 432, 403):
                time.sleep(4 + attempt * 3 + random.uniform(0, 2))
                continue
            resp.raise_for_status()
            organic = resp.json().get("organic", [])
            return [
                {"title": r.get("title", ""), "url": r.get("link", ""), "snippet": r.get("snippet", "")[:300]}
                for r in organic[:num]
            ]
        except Exception as e:
            print(f"  [search error attempt {attempt+1}] {e}")
            time.sleep(3 + attempt * 2)
    return []


def get_domain(url):
    try:
        return urlparse(url).netloc.replace("www.", "").strip().lower()
    except Exception:
        return ""


def is_own_website(url, own_website):
    if not own_website or not url:
        return False
    own_domain = get_domain(own_website)
    url_domain = get_domain(url)
    if not own_domain or not url_domain:
        return False
    return own_domain == url_domain or url_domain.endswith("." + own_domain) or own_domain.endswith("." + url_domain)


def classify_platform(url):
    domain = get_domain(url)
    for key, name in PLATFORM_NAMES.items():
        if key in domain:
            return name
    parts = domain.split(".")
    if len(parts) >= 2:
        return parts[-2].capitalize()
    return domain


def find_other_listings(lead, serper_key):
    name = (lead.get("name") or "").strip()
    reg_no = (lead.get("registrationNo") or "").strip()
    own_website = (lead.get("website") or "").strip()
    city = (lead.get("city") or "").strip()

    if not name:
        return []

    collected = []
    seen_domains = set()
    own_domain = get_domain(own_website) if own_website else None
    if own_domain:
        seen_domains.add(own_domain)

    SOCIAL_SKIP_DOMAINS = {"facebook.com", "twitter.com", "linkedin.com", "x.com", "instagram.com", "youtube.com"}

    def process_results(results):
        for r in results:
            url = r.get("url", "")
            if not url:
                continue
            domain = get_domain(url)
            if not domain or domain in seen_domains:
                continue
            
            # Skip social media platforms
            if any(sd in domain for sd in SOCIAL_SKIP_DOMAINS):
                continue
                
            if is_own_website(url, own_website):
                continue
            seen_domains.add(domain)
            collected.append({
                "platform": classify_platform(url),
                "url": url,
                "title": r.get("title", ""),
                "snippet": r.get("snippet", ""),
            })
            if len(collected) >= MAX_LISTINGS * 2:
                return

    # Query 1: RegNo + Name (most specific — SEBI/NSE/BSE registry pages)
    if reg_no:
        results1 = search_serper(f'"{reg_no}" "{name}"', serper_key, num=10)
        process_results(results1)
        time.sleep(0.4)

    # Query 2: Name + SEBI RA keyword
    if len(collected) < MAX_LISTINGS:
        q2 = f'"{name}" SEBI research analyst'
        if city:
            q2 += f" {city}"
        results2 = search_serper(q2, serper_key, num=10)
        process_results(results2)
        time.sleep(0.4)

    # Query 3: RegNo on SEBI/NSE/BSE sites
    if reg_no and len(collected) < MAX_LISTINGS:
        q3 = f'site:sebi.gov.in OR site:nseindia.com OR site:bseindia.com "{reg_no}"'
        results3 = search_serper(q3, serper_key, num=5)
        process_results(results3)

    return collected[:MAX_LISTINGS]


def fetch_ra_leads(db_url, limit=0):
    conn = psycopg2.connect(db_url)
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    query = '''
      SELECT id, name, "registrationNo", website, city, state, address, "otherListings" 
      FROM public."Lead"
      WHERE type='Research Analyst (RA)' AND "otherListings" IS NULL
      ORDER BY "leadScore" ASC 
    '''
    if limit > 0:
        query += f" LIMIT {limit}"
    cur.execute(query)
    rows = cur.fetchall()
    leads = [dict(r) for r in rows]
    cur.close()
    conn.close()
    print(f"DB se {len(leads)} RA leads (INH%) fetch hue.")
    return leads


def update_other_listings(db_url, lead_id, listings):
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    cur.execute('SELECT "otherListings" FROM "Lead" WHERE id = %s', (lead_id,))
    row = cur.fetchone()
    existing = []
    if row and row[0]:
        try:
            existing = json.loads(row[0])
        except Exception:
            existing = []
    existing_urls = {item.get("url") for item in existing if isinstance(item, dict)}
    for item in listings:
        if item.get("url") and item["url"] not in existing_urls:
            existing.append(item)
            existing_urls.add(item["url"])
    merged = existing[:MAX_LISTINGS]
    cur.execute(
        'UPDATE "Lead" SET "otherListings" = %s WHERE id = %s',
        (json.dumps(merged, ensure_ascii=False), lead_id)
    )
    conn.commit()
    cur.close()
    conn.close()


def run_migration(db_url):
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    try:
        cur.execute('ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "otherListings" TEXT;')
        conn.commit()
        print("Migration done: 'otherListings' column ready.")
    except Exception as e:
        conn.rollback()
        print(f"Migration: {e}")
    finally:
        cur.close()
        conn.close()


def main():
    parser = argparse.ArgumentParser(description="RA Lead — Other Platform Listings Tracker")
    parser.add_argument("--limit", type=int, default=0, help="0=saare RA leads")
    parser.add_argument("--workers", type=int, default=5)
    parser.add_argument("--api-keys", default="", help="Comma-separated Serper API keys")
    parser.add_argument("--no-migrate", action="store_true")
    args = parser.parse_args()

    try:
        from dotenv import load_dotenv
        script_dir = os.path.dirname(os.path.abspath(__file__))
        load_dotenv(os.path.join(script_dir, "..", ".env"))
        load_dotenv(os.path.join(script_dir, ".env"))
    except ImportError:
        pass

    db_url = os.environ.get("DATABASE_URL", "")
    if not db_url:
        print("ERROR: DATABASE_URL env var set nahi hai!")
        return

    env_keys = os.environ.get("SERPER_API_KEYS", os.environ.get("SERPER_API_KEY", ""))
    serper_keys_raw = args.api_keys if args.api_keys else env_keys
    serper_keys = [k.strip() for k in serper_keys_raw.split(",") if k.strip()]

    if not serper_keys:
        print("ERROR: SERPER_API_KEY(S) set nahi hai. Script search nahi kar sakta.")
        return

    if not args.no_migrate:
        run_migration(db_url)

    leads = fetch_ra_leads(db_url, args.limit)
    if not leads:
        print("Koi RA lead nahi mili. Khatam.")
        return

    key_state = {"idx": 0, "calls": 0, "lock": threading.Lock()}

    def get_key():
        with key_state["lock"]:
            if key_state["calls"] >= 600:
                key_state["calls"] = 0
                key_state["idx"] = (key_state["idx"] + 1) % len(serper_keys)
            key_state["calls"] += 1
            return serper_keys[key_state["idx"]]

    stats = {"found": 0, "empty": 0, "errors": 0}
    stats_lock = threading.Lock()

    def process(item):
        idx, lead = item
        lead_id = lead["id"]
        name = lead.get("name", "")
        reg_no = lead.get("registrationNo", "")
        try:
            time.sleep(DELAY_BETWEEN_LEADS + random.uniform(0, 0.3))
            key = get_key()
            listings = find_other_listings(lead, key)
            if listings:
                update_other_listings(db_url, lead_id, listings)
                platforms = ", ".join(item["platform"] for item in listings)
                print(f"[{idx}/{len(leads)}] FOUND ID:{lead_id} | {name} ({reg_no}) | {len(listings)} listings: {platforms}")
                with stats_lock:
                    stats["found"] += 1
            else:
                print(f"[{idx}/{len(leads)}] EMPTY ID:{lead_id} | {name} ({reg_no}) | No listings found")
                with stats_lock:
                    stats["empty"] += 1
        except Exception as e:
            import traceback
            traceback.print_exc()
            print(f"[{idx}/{len(leads)}] ERROR ID:{lead_id} | {name} | {e}")
            with stats_lock:
                stats["errors"] += 1

    print(f"Processing {len(leads)} RA leads with {args.workers} workers...")
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as executor:
        executor.map(process, enumerate(leads, 1))

    print(f"\nDone! Found listings: {stats['found']}/{len(leads)} | Empty: {stats['empty']} | Errors: {stats['errors']}")


if __name__ == "__main__":
    main()
