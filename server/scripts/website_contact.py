"""
Lead Enrichment Script (Direct Rule-based Scraping) - Extended v2
-------------------------------------------------------------------------
CHANGES vs previous version (3 small changes, marked with # >>> NEW):

1. eligibility_clause() ab website IS NOT NULL condition nahi maangti.
   Pehle sirf wahi leads mil rahi thi jinke paas already website ho.
   Ab leads jinke paas website NAHI hai, wo bhi eligible hain — unke
   liye hum search engine se company ka naam search karke koi bhi
   page (apni website, JustDial, IndiaMART, TradeIndia, etc.) dhoondte
   hain aur wahan se email/phone scrape karte hain.

2. find_website_via_search() naya function — DuckDuckGo HTML search
   use karke company name se ek usable URL dhoondta hai (social media
   / wiki jaise useless results ko skip karke).

3. process_lead() ab pehle DB ka website check karta hai; agar khali
   hai to search se URL dhoondta hai. Jo bhi URL mile (chahe khud ki
   site ho ya kisi directory listing ho), usse scrape karta hai. Agar
   naya URL search se mila hai to use "website" column me bhi save
   kar deta hai (COALESCE ki wajah se existing value overwrite nahi
   hoga).

Baaki sab safety guarantees same hain jaise pehle:
- COALESCE on every field -> existing non-null DB values NEVER overwritten.
- sanitize_value/sanitize_result -> blank/junk values kabhi DB me nahi jaate.
- Stale [CLAIMED] leads reclaim hoti hain.
- MAX_ATTEMPTS baar fail hone par lead permanently skip.
"""

import os
import sys
import time
import re
import argparse
import logging
from urllib.parse import urljoin, urlparse

import psycopg2
import psycopg2.extras
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright

try:
    from dotenv import load_dotenv
    script_dir = os.path.dirname(os.path.abspath(__file__))
    env_path = os.path.join(script_dir, "..", ".env")
    load_dotenv(env_path)
except ImportError:
    pass

DATABASE_URL = os.environ.get("DATABASE_URL")

PAGE_TIMEOUT_MS = 25000
REQUEST_DELAY_SEC = 2
MAX_TEXT_CHARS = 12000
CLAIM_TIMEOUT_MIN = 15
MAX_ATTEMPTS = 3
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger("enrich")

if not DATABASE_URL:
    log.error("DATABASE_URL env var missing. Set it and re-run.")
    sys.exit(1)


# ---------------------------------------------------------------------------
# SHARED WHERE-CLAUSE (used identically by both count and claim queries)
# ---------------------------------------------------------------------------
def eligibility_clause():
    # >>> NEW: "website IS NOT NULL AND website <> ''" condition hata di gayi hai.
    # Ab leads jinke paas website nahi hai, unhe bhi claim kiya ja sakega —
    # process_lead() unke liye search-fallback try karega.
    return f"""
        (
              "scrapedEmail" IS NULL OR TRIM("scrapedEmail") = ''
              OR "scrapedPhone" IS NULL OR TRIM("scrapedPhone") = ''
        )
        AND (
              "enrichmentNotes" IS NULL
              OR (
                  "enrichmentNotes" NOT LIKE '[CLAIMED]%%'
                  AND "enrichmentNotes" NOT LIKE '[SCRAPE_FAILED:{MAX_ATTEMPTS}]%%'
              )
              OR (
                  "enrichmentNotes" LIKE '[CLAIMED]%%'
                  AND "updatedAt" < NOW() - INTERVAL '{CLAIM_TIMEOUT_MIN} minutes'
              )
        )
    """


# ---------------------------------------------------------------------------
# DB HELPERS
# ---------------------------------------------------------------------------
def get_conn():
    return psycopg2.connect(DATABASE_URL)


def claim_one_lead():
    sql = f"""
        WITH candidate AS (
            SELECT id
            FROM "Lead"
            WHERE {eligibility_clause()}
            ORDER BY id ASC
            FOR UPDATE SKIP LOCKED
            LIMIT 1
        )
        UPDATE "Lead"
        SET "enrichmentNotes" = '[CLAIMED] ' || NOW()::text,
            "updatedAt" = NOW()
        WHERE id IN (SELECT id FROM candidate)
        RETURNING id, name, website, "registrationNo", "enrichmentNotes"
    """
    conn = get_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql)
            row = cur.fetchone()
        conn.commit()
        return row
    finally:
        conn.close()


def get_total_pending_leads():
    sql = f"""
        SELECT COUNT(id)
        FROM "Lead"
        WHERE {eligibility_clause()}
    """
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(sql)
        count = cur.fetchone()[0]
    conn.close()
    return count


def update_lead(lead_id, data: dict):
    """
    COALESCE on every scraped field -> existing non-null DB values are
    NEVER overwritten. data must already be sanitized (no "", "None", etc)
    before calling this — see sanitize_result().
    """
    sql = """
        UPDATE "Lead"
        SET "isEnriched"          = true,
            "website"             = COALESCE(NULLIF(TRIM("website"), ''), %(website)s),
            "scrapedEmail"        = COALESCE(NULLIF(TRIM("scrapedEmail"), ''), %(scrapedEmail)s),
            "scrapedPhone"        = COALESCE(NULLIF(TRIM("scrapedPhone"), ''), %(scrapedPhone)s),
            "linkedin"            = COALESCE("linkedin", %(linkedin)s),
            "twitter"             = COALESCE("twitter", %(twitter)s),
            "facebook"            = COALESCE("facebook", %(facebook)s),
            "logoUrl"             = COALESCE("logoUrl", %(logoUrl)s),
            "servicesSummary"     = COALESCE("servicesSummary", %(servicesSummary)s),
            "sellsAlgoTrading"    = COALESCE("sellsAlgoTrading", %(sellsAlgoTrading)s),
            "brokerPartner"       = COALESCE("brokerPartner", %(brokerPartner)s),
            "companySizeEstimate" = COALESCE("companySizeEstimate", %(companySizeEstimate)s),
            "enrichmentNotes"     = %(enrichmentNotes)s,
            "updatedAt"           = NOW()
        WHERE id = %(id)s
    """
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(sql, {**data, "id": lead_id})
        conn.commit()
    except Exception as e:
        conn.rollback()
        log.error(f"[{lead_id}] DB update failed: {e}")
    finally:
        conn.close()


def mark_failed(lead_id, reason, prev_notes=None):
    attempt = 1
    if prev_notes:
        m = re.match(r"\[SCRAPE_FAILED:(\d+)\]", prev_notes)
        if m:
            attempt = int(m.group(1)) + 1

    sql = """
        UPDATE "Lead"
        SET "enrichmentNotes" = %s, "updatedAt" = NOW()
        WHERE id = %s
    """
    note = f"[SCRAPE_FAILED:{attempt}] {reason}"[:250]
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(sql, (note, lead_id))
        conn.commit()
    except Exception as e:
        conn.rollback()
        log.error(f"[{lead_id}] DB mark_failed update failed: {e}")
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# SANITIZATION (critical: never let blank/junk values touch the DB)
# ---------------------------------------------------------------------------
JUNK_VALUES = {"", "none", "null", "n/a", "na", "-", "undefined"}


def sanitize_value(v):
    if v is None:
        return None
    if isinstance(v, str):
        v = v.strip()
        if v.lower() in JUNK_VALUES:
            return None
        return v
    return v


def sanitize_result(result: dict) -> dict:
    return {k: sanitize_value(v) for k, v in result.items()}


# ---------------------------------------------------------------------------
# SCRAPING HELPERS
# ---------------------------------------------------------------------------
def normalize_url(url: str) -> str:
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    return url


def fetch_rendered_html(browser, url: str) -> str:
    page = browser.new_page(user_agent=USER_AGENT)
    try:
        page.goto(url, timeout=PAGE_TIMEOUT_MS, wait_until="domcontentloaded")
        page.wait_for_timeout(2000)
        html = page.content()
    finally:
        page.close()
    return html


def find_relevant_links(base_url: str, html: str, keywords):
    soup = BeautifulSoup(html, "html.parser")
    found = set()
    for a in soup.find_all("a", href=True):
        text = (a.get_text() or "").lower()
        href = a.get("href", "").lower()
        if any(k in text or k in href for k in keywords):
            full = urljoin(base_url, a.get("href", ""))
            if urlparse(full).netloc == urlparse(base_url).netloc:
                found.add(full)
    return sorted(found)[:4]


def extract_text(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "noscript"]):
        tag.decompose()
    text = " ".join(soup.get_text(separator=" ").split())
    return text[:MAX_TEXT_CHARS]


# ---------------------------------------------------------------------------
# >>> NEW: SEARCH FALLBACK — jin leads ke paas website nahi hai
# ---------------------------------------------------------------------------
# Ye sites result me mile to skip kar dete hain (login-wall / kaam ka nahi):
SEARCH_RESULT_BLACKLIST = [
    "duckduckgo.com", "google.com", "bing.com",
    "facebook.com", "instagram.com", "youtube.com",
    "linkedin.com",  # company pages login ke bina scrape nahi hote
    "wikipedia.org", "twitter.com", "x.com",
]


def find_website_via_search(browser, company_name: str):
    """
    Company ka koi bhi listing page dhoondta hai — apni website ho ya
    JustDial / IndiaMART / TradeIndia jaisi directory listing, jahan
    bhi company registered/listed ho wahan se URL utha lete hain.
    """
    if not company_name or not company_name.strip():
        return None

    query = f"{company_name.strip()} contact"
    search_url = "https://html.duckduckgo.com/html/?q=" + query.replace(" ", "+")

    try:
        html = fetch_rendered_html(browser, search_url)
    except Exception as e:
        log.warning(f"Search failed for '{company_name}': {e}")
        return None

    soup = BeautifulSoup(html, "html.parser")
    for a in soup.select("a.result__a") or soup.find_all("a", href=True):
        href = a.get("href", "")
        if href.startswith("http") and not any(b in href.lower() for b in SEARCH_RESULT_BLACKLIST):
            return href
    return None


# ---------------------------------------------------------------------------
# FIELD EXTRACTORS
# ---------------------------------------------------------------------------
EMAIL_REGEX = re.compile(r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+')
PHONE_REGEX = re.compile(r'(?:\+91[-\s]?)?[6-9]\d{9}')

JUNK_EMAIL_DOMAINS = [
    "example.com", "yourdomain.com", "email.com", "domain.com", "test.com",
    "sentry.io", "wixpress.com", "godaddy.com", "yoursite.com",
]

ALGO_KEYWORDS = [
    "algo trading", "algorithmic trading", "automated trading",
    "trading bot", "trading algorithm", "auto trading", "quant trading",
]

KNOWN_BROKERS = [
    "Zerodha", "Upstox", "Alice Blue", "Angel One", "Angel Broking",
    "Fyers", "5paisa", "ICICI Direct", "Kotak Securities", "Motilal Oswal",
    "IIFL", "Sharekhan", "Groww", "Dhan", "Paytm Money", "Finvasia",
]

COMPANY_SIZE_REGEX = re.compile(
    r'(team of\s*\d+\+?\s*(?:members|people|employees)?|'
    r'\d+\+?\s*(?:employees|team members|people))',
    re.IGNORECASE
)


def extract_contact_info(html: str, text: str) -> dict:
    soup = BeautifulSoup(html, "html.parser")
    emails, phones = set(), set()

    for a in soup.find_all("a", href=True):
        href = a.get("href", "").strip()
        if href.lower().startswith("mailto:"):
            addr = href.split(":", 1)[1].split("?")[0].strip()
            if addr:
                emails.add(addr.lower())
        elif href.lower().startswith("tel:"):
            digits = re.sub(r"[^\d]", "", href.split(":", 1)[1])
            phones.add(digits)

    for m in EMAIL_REGEX.findall(text):
        emails.add(m.lower())
    for m in PHONE_REGEX.findall(text):
        phones.add(re.sub(r"\D", "", m))

    emails = {e for e in emails if not any(j in e for j in JUNK_EMAIL_DOMAINS)}

    clean_phones = set()
    for p in phones:
        digits = p
        if len(digits) == 12 and digits.startswith("91"):
            digits = digits[2:]
        if len(digits) == 10 and digits[0] in "6789":
            clean_phones.add(digits)

    return {
        "scrapedEmail": sorted(emails)[0] if emails else None,
        "scrapedPhone": sorted(clean_phones)[0] if clean_phones else None,
    }


def extract_social_links(html: str) -> dict:
    soup = BeautifulSoup(html, "html.parser")
    social = {"linkedin": None, "twitter": None, "facebook": None}
    for a in soup.find_all("a", href=True):
        href = a.get("href", "").strip()
        low = href.lower()
        if not social["linkedin"] and "linkedin.com" in low:
            social["linkedin"] = href
        elif not social["twitter"] and ("twitter.com" in low or "x.com/" in low):
            social["twitter"] = href
        elif not social["facebook"] and "facebook.com" in low:
            social["facebook"] = href
    return social


def extract_logo(base_url: str, html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")

    for img in soup.find_all("img"):
        attrs_blob = " ".join([
            (img.get("class") and " ".join(img.get("class"))) or "",
            img.get("id") or "",
            img.get("alt") or "",
            img.get("src") or "",
        ]).lower()
        if "logo" in attrs_blob:
            src = img.get("src")
            if src:
                return urljoin(base_url, src)

    og = soup.find("meta", property="og:image")
    if og and og.get("content"):
        return urljoin(base_url, og["content"])

    return None


def extract_meta_description(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    meta = soup.find("meta", attrs={"name": "description"})
    if meta and meta.get("content"):
        return meta["content"].strip()[:500]
    og = soup.find("meta", property="og:description")
    if og and og.get("content"):
        return og["content"].strip()[:500]
    return None


def detect_algo_trading(text: str) -> str:
    low = text.lower()
    return "Yes" if any(k in low for k in ALGO_KEYWORDS) else "No"


def detect_broker_partner(text: str) -> str:
    found = [b for b in KNOWN_BROKERS if b.lower() in text.lower()]
    return ", ".join(found) if found else None


def detect_company_size(text: str) -> str:
    m = COMPANY_SIZE_REGEX.search(text)
    return m.group(0).strip() if m else None


def merge_field(current, new):
    return current if current else new


def extract_all_fields(base_url: str, html: str, text: str) -> dict:
    contact = extract_contact_info(html, text)
    social = extract_social_links(html)
    return {
        "scrapedEmail": contact["scrapedEmail"],
        "scrapedPhone": contact["scrapedPhone"],
        "linkedin": social["linkedin"],
        "twitter": social["twitter"],
        "facebook": social["facebook"],
        "logoUrl": extract_logo(base_url, html),
        "servicesSummary": extract_meta_description(html),
        "sellsAlgoTrading": detect_algo_trading(text),
        "brokerPartner": detect_broker_partner(text),
        "companySizeEstimate": detect_company_size(text),
    }


# ---------------------------------------------------------------------------
# MAIN WORKER
# ---------------------------------------------------------------------------
FIELD_KEYS = [
    "scrapedEmail", "scrapedPhone", "linkedin", "twitter", "facebook",
    "logoUrl", "servicesSummary", "sellsAlgoTrading", "brokerPartner",
    "companySizeEstimate",
]


def process_lead(browser, lead) -> bool:
    lead_id = lead["id"]
    prev_notes = lead.get("enrichmentNotes")
    db_website = (lead.get("website") or "").strip()

    # >>> NEW: agar DB me website nahi hai to search se dhoondo
    if db_website:
        base_url = normalize_url(db_website)
        found_via_search = False
    else:
        log.info(f"[{lead_id}] Website missing, searching web for '{lead['name']}'")
        found_url = find_website_via_search(browser, lead.get("name"))
        if not found_url:
            mark_failed(lead_id, "No website in DB and none found via search", prev_notes)
            return False
        base_url = found_url
        found_via_search = True
        log.info(f"[{lead_id}] Found candidate URL via search: {base_url}")

    log.info(f"[{lead_id}] Processing {base_url}")

    try:
        html_main = fetch_rendered_html(browser, base_url)
    except Exception as e:
        log.error(f"[{lead_id}] Failed to load {base_url}: {e}")
        mark_failed(lead_id, f"Website load failed: {str(e)[:100]}", prev_notes)
        return False

    text_main = extract_text(html_main)
    result = extract_all_fields(base_url, html_main, text_main)

    missing = [k for k in FIELD_KEYS if not result.get(k)]
    if missing:
        sub_links = find_relevant_links(
            base_url, html_main, ["contact", "about", "support", "reach", "team"]
        )
        for link in sub_links:
            missing = [k for k in FIELD_KEYS if not result.get(k)]
            if not missing:
                break
            try:
                sub_html = fetch_rendered_html(browser, link)
                sub_text = extract_text(sub_html)
                sub_result = extract_all_fields(link, sub_html, sub_text)
                for k in FIELD_KEYS:
                    result[k] = merge_field(result.get(k), sub_result.get(k))
            except Exception as e:
                log.warning(f"[{lead_id}] Failed to load sub-page {link}: {e}")

    # >>> NEW: agar search se URL mila tha, use website column me save karne ke liye bhej do
    result["website"] = base_url if found_via_search else None

    # --- CRITICAL SAFETY STEP ---
    result = sanitize_result(result)

    log.info(f"[{lead_id}] Extracted: { {k: result[k] for k in FIELD_KEYS if result[k]} }")

    if not any(result.get(k) for k in FIELD_KEYS):
        mark_failed(lead_id, "No enrichable data found on site/sub-pages", prev_notes)
        return False

    result["enrichmentNotes"] = "[ENRICHED] Direct rule-based extraction"
    update_lead(lead_id, result)
    return True


def worker_loop(limit: int):
    processed = 0
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        try:
            while processed < limit:
                lead = claim_one_lead()
                if not lead:
                    log.info("No more pending leads found.")
                    break

                try:
                    success = process_lead(browser, lead)
                except Exception as e:
                    log.error(f"[{lead['id']}] Unexpected error: {e}")
                    mark_failed(lead["id"], f"Unexpected error: {str(e)[:100]}", lead.get("enrichmentNotes"))
                    success = False

                processed += 1
                if success:
                    time.sleep(REQUEST_DELAY_SEC)
        finally:
            browser.close()

    log.info(f"Worker finished processing {processed} leads.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=50, help="Number of leads to process")
    args = parser.parse_args()

    pending = get_total_pending_leads()
    log.info(f"Pending leads to scrape: {pending}")

    if pending > 0:
        worker_loop(args.limit)