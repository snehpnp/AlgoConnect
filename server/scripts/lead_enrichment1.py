import os
import time
import requests
from urllib.parse import urlparse
import psycopg2
import psycopg2.extras

# python scripts/lead_enrichment1.py

# --- Configuration ---
DB_URL = "postgresql://postgres:123456@localhost:5432/algoconnect"
SERPER_API_KEY = os.environ.get("SERPER_API_KEY", "e43d60238bb0ad0f5b3296bfbf8ea55fc4643d22") 
print("SERPER_API_KEY",SERPER_API_KEY)
# In sites ko ignore karna hai (taki khud ki website mile, koi directory nahi)
SKIP_DOMAINS = {
    "wikipedia.org", "youtube.com", "sebi.gov.in", "moneycontrol.com",
    "economictimes.indiatimes.com", "google.com", "justdial.com",
    "instagram.com", "facebook.com", "twitter.com", "x.com",
    "linkedin.com", "indiamart.com", "sulekha.com", "zaubacorp.com", 
    "nseindia.com", "bseindia.com", "mca.gov.in", "companycheck.co.in", 
    "probe42.in", "screener.in", "tofler.in", "zoominfo.com", "pitchbook.com", 
    "crunchbase.com", "vakilsearch.com", "bloomberg.com", "algotest.in",
    "glassdoor.co.in", "ambitionbox.com", "startupindia.gov.in", "tradeindia.com","esi.in","jalanco.in","tracxn.com","getdatarobot.com","rocketreach.co","scribd.com","apple.com","mind2markets.com"
}


def search_google(query):
    """Google me search karta hai aur top URLs nikalta hai"""
    if not SERPER_API_KEY:
        print("ERROR: SERPER_API_KEY is missing!")
        return []

    try:
        resp = requests.post(
            "https://google.serper.dev/search",
            headers={"X-API-KEY": SERPER_API_KEY, "Content-Type": "application/json"},
            json={"q": query, "num": 10},
            timeout=10
        )
        resp.raise_for_status()
        results = resp.json().get("organic", [])
        return [r.get("link") for r in results if r.get("link")]
    except Exception as e:
        print(f"Search failed for '{query}': {e}")
        return []


def find_own_website(name, reg_no):
    """Search karta hai aur pehli sahi website dhoondhta hai"""
    query_parts = []
    if name: query_parts.append(name)
    if reg_no: query_parts.append(reg_no)
    
    query = " ".join(query_parts).strip()
    if not query:
        return None

    urls = search_google(query)
    
    for url in urls:
        domain = urlparse(url).netloc.replace("www.", "").lower()
        
        # Check agar domain SKIP_DOMAINS me hai, ya aggregator keyword hai
        is_skip = False
        for skip_d in SKIP_DOMAINS:
            if skip_d in domain:
                is_skip = True
                break
        
        # Aggregator check (lei, zauba, cin etc.)
        for kw in ["lei-", "-lei", "zauba", "tofler", "probe42", "cin-", "gstin"]:
            if kw in domain:
                is_skip = True
                break
                
        if not is_skip:
            return url # Ye inki khud ki website lag rahi hai
            
    return None


def main():
    print("Connecting to DB...")
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
    
    # 1. Fetch leads jinki website nahi hai
    cur.execute('''
        SELECT id, name, "registrationNo", address 
        FROM "Lead" 
        WHERE website = '' OR website IS NULL
    ''')
    leads = cur.fetchall()
    
    print(f"Total leads without website: {len(leads)}")
    
    # Cache to store already found domains
    domain_cache = set()
    
    # 2. Ek-ek lead process karo
    for i, lead in enumerate(leads, 1):
        lead_id = lead["id"]
        name = lead["name"]
        reg_no = lead["registrationNo"]
        
        print(f"[{i}/{len(leads)}] Searching for: {name} ({reg_no})")
        
        # Thoda delay taki API block na ho
        time.sleep(1) 
        
        website = find_own_website(name, reg_no)
        
        if website:
            domain = urlparse(website).netloc.replace("www.", "").lower()
            if domain in domain_cache:
                print(f"  -> DUPLICATE (Already found): {website}")
                # Skipping db update as it's a duplicate domain 
                # (usually means same wrong site matched multiple times)
            else:
                print(f"  -> FOUND NEW: {website}")
                domain_cache.add(domain)
                
                # 3. DB me update karo
                update_cur = conn.cursor()
                update_cur.execute(
                    'UPDATE "Lead" SET website = %s WHERE id = %s',
                    (website, lead_id)
                )
                conn.commit()
                update_cur.close()
        else:
            print("  -> NOT FOUND")

    cur.close()
    conn.close()
    print("Done!")


if __name__ == "__main__":
    main()