import os
import re
import time
import difflib
import requests
from urllib.parse import urlparse
import psycopg2
import psycopg2.extras
from bs4 import BeautifulSoup

# python scripts/lead_enrichment1.py

# --- Configuration ---
DB_URL = "postgresql://postgres:123456@localhost:5432/algoconnect"
SERPER_API_KEY = os.environ.get("SERPER_API_KEY", "fba285443f2f738108ab90784224999c43f40d58")
print("SERPER_API_KEY", SERPER_API_KEY)

# In sites ko ignore karna hai (taki khud ki website mile, koi directory/news/data-aggregator nahi)
SKIP_DOMAINS = {
    "wikipedia.org", "youtube.com", "sebi.gov.in", "moneycontrol.com",
    "economictimes.indiatimes.com", "google.com", "justdial.com",
    "instagram.com", "facebook.com", "twitter.com", "x.com",
    "linkedin.com", "indiamart.com", "sulekha.com", "zaubacorp.com",
    "nseindia.com", "bseindia.com", "mca.gov.in", "companycheck.co.in",
    "probe42.in", "screener.in", "tofler.in", "zoominfo.com", "pitchbook.com",
    "crunchbase.com", "vakilsearch.com", "bloomberg.com", "algotest.in",
    "glassdoor.co.in", "ambitionbox.com", "startupindia.gov.in", "tradeindia.com",
    "esi.in", "jalanco.in", "tracxn.com", "getdatarobot.com", "rocketreach.co",
    "scribd.com", "apple.com", "mind2markets.com", "indiafilings.com",
    "instafinancials.com", "avonmorecapital.in",
    # global finance data/news aggregators jo reg_no-only search me galti se match ho jate hain
    "im.natixis.com", "eatonvance.com", "ftportfolios.com", "enanta.com",
    "dtcc.com", "registry.faa.gov", "citi.com", "ssga.com", "treas.gov",
    "cbonds.com", "janushenderson.com", "businessinsider.com", "mplusfunds.com",
    "nyse.com", "radientanalytics.com", "fintel.io", "yahoo.com", "invesco.com",
    "sec.gov", "reuters.com", "morningstar.com",
}

AGGREGATOR_KEYWORDS = ["lei-", "-lei", "zauba", "tofler", "probe42", "cin-", "gstin"]

# Company suffixes jo domain-name similarity check se pehle hata denge
COMPANY_SUFFIXES = [
    "private limited", "pvt ltd", "pvt. ltd.", "limited", "ltd", "llp",
    "capital", "securities", "advisors", "advisory", "investments",
    "investment", "financial", "finance", "wealth", "broking", "brokers",
    "stock broker", "stock brokers", "solutions", "services", "group",
    "inc", "corp", "co",
]

REQUEST_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
}

# Score threshold - isse kam score wala candidate accept nahi hoga
ACCEPT_THRESHOLD = 3.0


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


def is_domain_skipped(domain):
    for skip_d in SKIP_DOMAINS:
        if skip_d in domain:
            return True
    for kw in AGGREGATOR_KEYWORDS:
        if kw in domain:
            return True
    return False


def is_pdf_url(url):
    path = urlparse(url).path.lower()
    return path.endswith(".pdf")


def normalize_name(name):
    """Company name se suffix/legal-words hata kar core name nikalta hai"""
    n = name.lower()
    n = re.sub(r"[^a-z0-9\s]", " ", n)
    for suf in COMPANY_SUFFIXES:
        n = re.sub(r"\b" + re.escape(suf) + r"\b", " ", n)
    n = re.sub(r"\s+", " ", n).strip()
    return n


def domain_core(domain):
    """Domain se TLD/subdomain hata kar core naam nikalta hai"""
    parts = domain.split(".")
    # www already removed by caller; le lo second-level domain
    if len(parts) >= 2:
        core = parts[-2]
    else:
        core = parts[0]
    return re.sub(r"[^a-z0-9]", "", core.lower())


def name_domain_similarity(company_name, domain):
    """Company name aur domain ke beech fuzzy similarity score (0-1)"""
    norm_name = normalize_name(company_name).replace(" ", "")
    core = domain_core(domain)
    if not norm_name or not core:
        return 0.0
    # Agar core name company name ke andar substring hai (ya vice versa), high score
    if core in norm_name or norm_name in core:
        return 0.9
    return difflib.SequenceMatcher(None, norm_name, core).ratio()


def reg_no_signal(html, reg_no):
    """
    Returns (found_outside_table: bool, found_in_table_only: bool)
    Reg no ko word-boundary ke sath dhoondta hai taaki koi doosra
    lamba number galti se match na ho jaye.
    """
    soup = BeautifulSoup(html, "html.parser")
    target = re.sub(r"[^a-z0-9]", "", reg_no.lower())
    if not target:
        return False, False

    found_in_table = False
    found_outside = False

    for table in soup.find_all("table"):
        table_text = re.sub(r"[^a-z0-9]", "", table.get_text().lower())
        if target in table_text:
            found_in_table = True

    body_text = soup.get_text()
    # non-table text alag se nikalne ke liye tables ko pehle remove karo
    soup_copy = BeautifulSoup(html, "html.parser")
    for t in soup_copy.find_all("table"):
        t.decompose()
    non_table_text = re.sub(r"[^a-z0-9]", "", soup_copy.get_text().lower())
    if target in non_table_text:
        found_outside = True

    return found_outside, found_in_table


def name_in_title_or_heading(html, company_name):
    soup = BeautifulSoup(html, "html.parser")
    norm_name = normalize_name(company_name)
    name_tokens = [t for t in norm_name.split() if len(t) > 2]
    if not name_tokens:
        return False

    candidates_text = ""
    if soup.title:
        candidates_text += " " + soup.title.get_text()
    for tag in soup.find_all(["h1", "h2"]):
        candidates_text += " " + tag.get_text()
    candidates_text = candidates_text.lower()

    matches = sum(1 for t in name_tokens if t in candidates_text)
    return matches >= max(1, len(name_tokens) // 2)


def score_candidate(url, name, reg_no):
    """Candidate URL ko score karta hai. Returns (score, reason_list) or None on hard-skip."""
    domain = urlparse(url).netloc.replace("www.", "").lower()

    if is_domain_skipped(domain):
        print(f"    skip (domain blocklist): {url}")
        return None

    if is_pdf_url(url):
        print(f"    skip (PDF url): {url}")
        return None

    try:
        resp = requests.get(url, headers=REQUEST_HEADERS, timeout=10)
        resp.raise_for_status()
        content_type = resp.headers.get("Content-Type", "").lower()
        if "pdf" in content_type:
            print(f"    skip (PDF content-type): {url}")
            return None
    except Exception as e:
        print(f"    fetch failed ({url}): {e}")
        return None

    score = 0.0
    reasons = []

    sim = name_domain_similarity(name, domain)
    score += sim * 4  # sabse bhaari weight - domain khud company jaisa lagna chahiye
    reasons.append(f"domain_similarity={sim:.2f}")

    found_outside, found_in_table = reg_no_signal(resp.text, reg_no)
    if found_outside:
        score += 2.0
        reasons.append("regno_in_content")
    if found_in_table and not found_outside:
        score -= 1.0  # sirf table me mila (directory jaisa pattern) -> penalty
        reasons.append("regno_only_in_table(-)")

    if name_in_title_or_heading(resp.text, name):
        score += 1.5
        reasons.append("name_in_title/heading")

    print(f"    candidate {url} -> score={score:.2f} [{', '.join(reasons)}]")
    return (score, url, domain)


def find_own_website(name, reg_no):
    """Name+reg_no se search, fir sab candidates ko score karke best pick karta hai"""
    query = f'"{name}" {reg_no}'.strip()
    urls = search_google(query)

    # Fallback: agar kuch na mile to sirf naam se try karo
    if not urls:
        urls = search_google(name)

    scored = []
    for url in urls:
        result = score_candidate(url, name, reg_no)
        if result:
            scored.append(result)

    if not scored:
        return None

    scored.sort(key=lambda x: x[0], reverse=True)
    best_score, best_url, best_domain = scored[0]

    if best_score < ACCEPT_THRESHOLD:
        print(f"    best candidate score {best_score:.2f} < threshold {ACCEPT_THRESHOLD} -> rejecting")
        return None

    return best_url


def main():
    print("Connecting to DB...")
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)

    cur.execute('''
       SELECT id, name, "registrationNo", address 
FROM "Lead"
WHERE website = '' OR website IS NULL
ORDER BY id ASC;
    ''')
    leads = cur.fetchall()

    print(f"Total leads without website: {len(leads)}")

    domain_cache = set()

    for i, lead in enumerate(leads, 1):
        lead_id = lead["id"]
        name = lead["name"]
        reg_no = lead["registrationNo"]

        if not reg_no or not name:
            print(f"[{i}/{len(leads)}] Skipping (missing name/regno): {name}")
            continue

        print(f"[{i}/{len(leads)}] Searching: {name} ({reg_no})")

        time.sleep(1)

        website = find_own_website(name, reg_no)

        if website:
            domain = urlparse(website).netloc.replace("www.", "").lower()
            if domain in domain_cache:
                print(f"  -> DUPLICATE (Already found): {website}")
            else:
                print(f"  -> FOUND & VERIFIED: {website}")
                domain_cache.add(domain)

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