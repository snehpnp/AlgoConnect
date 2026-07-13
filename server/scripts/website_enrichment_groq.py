"""
Lead Enrichment Script (Hybrid: Groq LLM if available, else Rule-based)
-------------------------------------------------------------------------
Postgres "Lead" table se leads fetch karke website scrape karta hai.
Har lead ke liye:
  1. Website crawl karta hai (Playwright - JS heavy sites ke liye)
  2. About Us / Contact Us / Footer sections se targeted info nikaalta hai
  3. Info extract karta hai:
       - Agar GROQ_API_KEY set hai -> Groq LLM se smart extraction
       - Agar nahi hai -> automatically keyword/regex based extraction
         (koi crash nahi hota, seamlessly fallback ho jaata hai)
  4. Logo/favicon ka live URL nikalta hai (download nahi karta)
  5. Address + company description nikalta hai
  6. Algo-trading keywords ka wide list check karta hai
  7. Same row ko UPDATE karta hai (isEnriched = true)

Setup:
  pip install -r requirements.txt
  playwright install chromium
  -> Run migration_add_columns.sql once (adds scrapedAddress, companyDescription)

Env vars (.env file ya export karo):
  DATABASE_URL=postgresql://user:pass@host:5432/dbname

  # Groq keys - OPTIONAL, na ho to rule-based mode chalega.
  # Multiple keys de sakte ho (comma-separated) - jab ek key ki daily/rate limit
  # khatam ho jaati hai, script automatically agli key pe switch ho jaati hai.
  GROQ_API_KEYS=key_one,key_two,key_three
  # (purana single GROQ_API_KEY bhi chalega, backward-compatible hai)

Run:
  python scripts\website_enrichment_groq.py --limit 50 --workers 1
"""

import os
import sys
import time
import json
import re
import argparse
import logging
from urllib.parse import urljoin, urlparse

import psycopg2
import psycopg2.extras
import requests
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright

# ---------------------------------------------------------------------------
# CONFIG
# ---------------------------------------------------------------------------
try:
    from dotenv import load_dotenv
    script_dir = os.path.dirname(os.path.abspath(__file__))
    env_path = os.path.join(script_dir, "..", ".env")
    load_dotenv(env_path)
except ImportError:
    pass

DATABASE_URL = os.environ.get("DATABASE_URL")

# --- Multiple Groq API keys support ---
# GROQ_API_KEYS=key1,key2,key3  (preferred)  ya purana GROQ_API_KEY=key1 (single, still works)
_raw_keys = os.environ.get("GROQ_API_KEYS") or os.environ.get("GROQ_API_KEY") or ""
GROQ_API_KEYS = [k.strip() for k in _raw_keys.split(",") if k.strip()]
GROQ_MODEL = "llama-3.3-70b-versatile"

PAGE_TIMEOUT_MS = 25000
REQUEST_DELAY_SEC = 3
MAX_TEXT_CHARS = 12000
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

# --- Groq / LLM setup (OPTIONAL, multi-key rotation) ---
USE_LLM = False


class GroqKeyPool:
    """Multiple Groq API keys ko round-robin manage karta hai.
    Jab current key 429 / rate-limit / daily-quota error deti hai, us key ko
    'exhausted' mark karke agli available key pe switch ho jaata hai.
    Sirf tab poore LLM extraction band hota hai jab SAARI keys exhaust ho jaayein
    -> uske baad automatically rule-based fallback chalta rahega (crash nahi hoga)."""

    def __init__(self, keys):
        self.keys = keys
        self.clients = [OpenAI(api_key=k, base_url="https://api.groq.com/openai/v1") for k in keys]
        self.exhausted = [False] * len(keys)
        self.current = 0

    def get_client(self):
        return self.clients[self.current]

    def all_exhausted(self):
        return all(self.exhausted)

    def mark_current_exhausted(self, reason=""):
        idx = self.current
        self.exhausted[idx] = True
        log.warning(
            f"Groq key #{idx + 1} rate-limit/quota khatam ho gayi ({reason}). "
            f"{self.exhausted.count(False)} key(s) abhi bachi hain."
        )
        self.rotate()

    def rotate(self):
        """Agli non-exhausted key dhoondo. Agar sab exhaust ho gayi hain to bas
        current index waisa hi rehne do - all_exhausted() check bahar handle karega."""
        n = len(self.keys)
        for i in range(1, n + 1):
            candidate = (self.current + i) % n
            if not self.exhausted[candidate]:
                self.current = candidate
                log.info(f"Ab Groq key #{candidate + 1} use ho rahi hai.")
                return
        # koi bachi nahi - sab exhausted


groq_pool = None

if GROQ_API_KEYS:
    try:
        from openai import OpenAI  # Groq is OpenAI-SDK compatible
        groq_pool = GroqKeyPool(GROQ_API_KEYS)
        USE_LLM = True
        log.info(f"{len(GROQ_API_KEYS)} Groq API key(s) mil gayi -> LLM-based extraction use hoga.")
    except ImportError:
        log.warning("openai package install nahi hai (`pip install openai`) -> rule-based extraction use hoga.")
else:
    log.info("Koi GROQ_API_KEY/GROQ_API_KEYS set nahi hai -> rule-based (no AI) extraction use hoga.")


# ---------------------------------------------------------------------------
# DB HELPERS
# ---------------------------------------------------------------------------
def get_conn():
    return psycopg2.connect(DATABASE_URL)


def claim_one_lead():
    """Ek lead ko atomically 'claim' karo taaki multiple processes ek saath chalne par
    duplicate scrape na ho. FOR UPDATE SKIP LOCKED use karta hai."""
    sql = """
        WITH candidate AS (
            SELECT id
            FROM "Lead"
            WHERE website IS NOT NULL
              AND website <> ''
              AND ("logoUrl" IS NULL OR "logoUrl" = '')
              AND ("enrichmentNotes" IS NULL OR "enrichmentNotes" NOT LIKE '[CLAIMED]%%')
            ORDER BY
                CASE WHEN "registrationNo" ILIKE 'INH%%' THEN 1 ELSE 2 END,
                CASE WHEN "state" ILIKE '%%Madhya%%' OR "address" ILIKE '%%Madhya%%' THEN 1 ELSE 2 END,
                id ASC
            FOR UPDATE SKIP LOCKED
            LIMIT 1
        )
        UPDATE "Lead"
        SET "enrichmentNotes" = '[CLAIMED] ' || NOW()::text
        WHERE id IN (SELECT id FROM candidate)
        RETURNING id, name, website, "registrationNo"
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
    sql = """
        SELECT COUNT(id)
        FROM "Lead"
        WHERE website IS NOT NULL
          AND website <> ''
          AND ("logoUrl" IS NULL OR "logoUrl" = '')
          AND ("enrichmentNotes" IS NULL OR "enrichmentNotes" NOT LIKE '[CLAIMED]%%')
    """
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(sql)
        count = cur.fetchone()[0]
    conn.close()
    return count


def update_lead(lead_id, data: dict):
    """Enrichment fields ko lead row me update karo.
    address / companyDescription sirf tab overwrite hote hain jab scrape se kuch mila ho
    (COALESCE) — taaki manually entered data overwrite na ho."""
    sql = """
        UPDATE "Lead"
        SET "isEnriched" = true,
            "linkedin" = COALESCE(%(linkedin)s, "linkedin"),
            "twitter" = COALESCE(%(twitter)s, "twitter"),
            "facebook" = COALESCE(%(facebook)s, "facebook"),
            "servicesSummary" = %(servicesSummary)s,
            "productsOffered" = %(productsOffered)s,
            "sellsAlgoTrading" = %(sellsAlgoTrading)s,
            "brokerPartner" = %(brokerPartner)s,
            "companySizeEstimate" = %(companySizeEstimate)s,
            "enrichmentNotes" = %(enrichmentNotes)s,
            "logoUrl" = COALESCE(%(logoUrl)s, "logoUrl"),
            "scrapedEmail" = COALESCE(%(scrapedEmail)s, "scrapedEmail"),
            "scrapedPhone" = COALESCE(%(scrapedPhone)s, "scrapedPhone"),
            "address" = COALESCE("address", %(scrapedAddress)s),
            "scrapedAddress" = COALESCE(%(scrapedAddress)s, "scrapedAddress"),
            "companyDescription" = COALESCE(%(companyDescription)s, "companyDescription"),
            "updatedAt" = NOW()
        WHERE id = %(id)s
    """
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(sql, {**data, "id": lead_id})
    conn.commit()
    conn.close()


def mark_failed(lead_id, reason):
    sql = """
        UPDATE "Lead"
        SET "enrichmentNotes" = %s, "updatedAt" = NOW()
        WHERE id = %s
    """
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(sql, (f"[SCRAPE_FAILED] {reason}", lead_id))
    conn.commit()
    conn.close()


# ---------------------------------------------------------------------------
# SCRAPING
# ---------------------------------------------------------------------------
def normalize_url(url: str) -> str:
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    return url


def fetch_rendered_html(url: str) -> str:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(user_agent=USER_AGENT)
        try:
            page.goto(url, timeout=PAGE_TIMEOUT_MS, wait_until="domcontentloaded")
            page.wait_for_timeout(2000)
            html = page.content()
        finally:
            browser.close()
    return html


def find_relevant_links(base_url: str, html: str, keywords):
    """Services/Pricing/About/Contact jaise pages ke internal links dhoondo."""
    soup = BeautifulSoup(html, "html.parser")
    found = set()
    for a in soup.find_all("a", href=True):
        text = (a.get_text() or "").lower()
        href = a.get("href", "").lower()
        if any(k in text or k in href for k in keywords):
            full = urljoin(base_url, a.get("href", ""))
            if urlparse(full).netloc == urlparse(base_url).netloc:
                found.add(full)
    return list(found)[:4]


def extract_text(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "noscript"]):
        tag.decompose()
    text = " ".join(soup.get_text(separator=" ").split())
    return text[:MAX_TEXT_CHARS]


def extract_footer_text(html: str) -> str:
    """Footer me aksar sabse clean address/contact block hota hai — alag se nikaalte hain."""
    soup = BeautifulSoup(html, "html.parser")
    footer = soup.find("footer")
    if not footer:
        # kai templates footer ki jagah class="footer" wale div use karte hain
        footer = soup.find(attrs={"class": re.compile("footer", re.I)})
    if not footer:
        return ""
    return " ".join(footer.get_text(separator=" ").split())


def extract_social_links(html: str, base_url: str) -> dict:
    soup = BeautifulSoup(html, "html.parser")
    socials = {"linkedin": None, "twitter": None, "facebook": None}
    for a in soup.find_all("a", href=True):
        href = a.get("href", "")
        if "linkedin.com" in href and not socials["linkedin"]:
            socials["linkedin"] = href
        elif ("twitter.com" in href or "x.com" in href) and not socials["twitter"]:
            socials["twitter"] = href
        elif "facebook.com" in href and not socials["facebook"]:
            socials["facebook"] = href
    return socials


# --- Email / Phone extraction (regex-based, no AI needed, always runs) ---
EMAIL_REGEX = re.compile(r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+')
PHONE_REGEX = re.compile(r'(?:\+91[-\s]?)?[6-9]\d{9}')

JUNK_EMAIL_DOMAINS = [
    "example.com", "yourdomain.com", "email.com", "domain.com", "test.com",
    "sentry.io", "wixpress.com", "godaddy.com", "yoursite.com",
]


def extract_contact_info(html: str, text: str) -> dict:
    soup = BeautifulSoup(html, "html.parser")
    emails = set()
    phones = set()

    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
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


# --- Address extraction (regex-based, no AI needed) ---
# Indian PIN code (6 digit) ke aas-paas ka text nikaal lete hain — usually yehi address hota hai.
PINCODE_REGEX = re.compile(r'([^.]{0,120}\b\d{6}\b[^.]{0,40})')
ADDRESS_LABEL_REGEX = re.compile(r'address\s*[:\-]?\s*([^.]{10,180})', re.I)


def extract_address(html: str, footer_text: str, page_text: str) -> str:
    """Priority: <address> tag -> footer text with 'Address:' label / pincode -> body text pincode match."""
    soup = BeautifulSoup(html, "html.parser")

    addr_tag = soup.find("address")
    if addr_tag and addr_tag.get_text(strip=True):
        return " ".join(addr_tag.get_text(separator=" ").split())[:300]

    for source in (footer_text, page_text):
        if not source:
            continue
        m = ADDRESS_LABEL_REGEX.search(source)
        if m:
            return m.group(1).strip()[:300]
        m = PINCODE_REGEX.search(source)
        if m:
            return m.group(1).strip()[:300]

    return None


def find_logo_url(html: str, base_url: str, lead_id: int):
    soup = BeautifulSoup(html, "html.parser")
    candidate_url = None

    og_image = soup.find("meta", property="og:image")
    if og_image and og_image.get("content"):
        candidate_url = urljoin(base_url, og_image["content"])

    if not candidate_url:
        header = soup.find(["header", "nav"])
        if header:
            img = header.find("img")
            if img and img.get("src"):
                candidate_url = urljoin(base_url, img["src"])

    if not candidate_url:
        icon = soup.find("link", rel=lambda v: v and "icon" in v.lower())
        if icon and icon.get("href"):
            candidate_url = urljoin(base_url, icon["href"])

    if not candidate_url:
        candidate_url = urljoin(base_url, "/favicon.ico")

    try:
        resp = requests.get(
            candidate_url, headers={"User-Agent": USER_AGENT}, timeout=10, stream=True
        )
        if resp.status_code == 200:
            return candidate_url
        log.warning(f"[{lead_id}] logo URL returned {resp.status_code}: {candidate_url}")
    except Exception as e:
        log.warning(f"[{lead_id}] logo URL check failed: {e}")
    return None


# ---------------------------------------------------------------------------
# LLM EXTRACTION (used only when USE_LLM = True)
# ---------------------------------------------------------------------------
EXTRACTION_PROMPT = """Neeche ek SEBI-registered RA/IA/Sub-broker company ki website se \
liya gaya text hai (About Us, Contact Us aur Footer sections included). \
Isse neeche diye JSON schema me extract karo. \
Agar koi field ki info text me nahi mile to us field ki value null rakho. \
Sirf raw JSON return karo, koi extra text/markdown fence nahi.

Schema:
{{
  "companyDescription": "2-4 line 'About Us' style summary of what the company does",
  "servicesSummary": "2-3 line summary of services offered",
  "productsOffered": "comma separated list of products/strategies (e.g. Scalping, Options, Algo bots)",
  "sellsAlgoTrading": "Yes / No / Unclear",
  "brokerPartner": "broker name if mentioned (e.g. Zerodha, Upstox, Alice Blue) else null",
  "companySizeEstimate": "Small / Medium / Large / Unknown (based on team size, offices, client count mentions)",
  "address": "registered/office address if mentioned, else null",
  "enrichmentNotes": "any other useful sales-relevant detail (pricing hints, notable clients, years of experience etc.)"
}}

Website text:
\"\"\"{page_text}\"\"\"
"""


def call_llm_extract(page_text: str) -> dict:
    prompt = EXTRACTION_PROMPT.format(page_text=page_text)
    client = groq_pool.get_client()
    resp = client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0,
        max_tokens=800,
    )
    raw = resp.choices[0].message.content.strip()
    raw = raw.replace("```json", "").replace("```", "").strip()
    return json.loads(raw)


# ---------------------------------------------------------------------------
# RULE-BASED EXTRACTION (No AI) — automatic fallback jab GROQ_API_KEY na ho
# ---------------------------------------------------------------------------
# Wide keyword list, jaisa requirement me diya gaya hai. Note: "algo" aur "automation"
# jaise short/generic words false positives de sakte hain, lekin requirement explicitly
# in sabko cover karne ko bola hai.
ALGO_KEYWORDS = [
    "algo trading", "algorithmic trading", "algo", "trading automation",
    "automation", "automated trading", "trading software", "api trading",
    "quant trading", "quant strategy", "trading bot", "systematic trading",
    "auto trading", "algo strategies", "trading algorithm", "backtesting engine",
]

BROKER_LIST = [
    "Zerodha", "Upstox", "Alice Blue", "Angel One", "Angel Broking",
    "ICICI Direct", "HDFC Securities", "Kotak Securities", "5paisa",
    "Fyers", "IIFL", "Motilal Oswal", "Sharekhan", "Groww", "Dhan",
    "SAS Online", "Paytm Money", "Axis Direct",
]

PRODUCT_KEYWORDS = [
    "Scalping", "Intraday", "Positional", "Swing Trading", "Option Strategy",
    "Options Trading", "Portfolio Management", "Research Advisory",
    "Equity Advisory", "Commodity Trading", "Futures Trading",
    "Technical Analysis", "Charting", "Backtesting",
]

SIZE_HINT_PATTERNS = {
    "Large": [r"\b(pan[- ]india|500\+|1000\+|multiple branches|nationwide)\b"],
    "Medium": [r"\b(team of \d{2,3}|\d{2,3}\+ employees|multiple offices)\b"],
    "Small": [r"\b(boutique|small team|family-owned|founded by)\b"],
}


def rule_based_extract(text: str, html: str, about_text: str = "") -> dict:
    text_lower = text.lower()

    sells_algo = "Unclear"
    if any(kw in text_lower for kw in ALGO_KEYWORDS):
        sells_algo = "Yes"

    broker_partner = None
    for broker in BROKER_LIST:
        if broker.lower() in text_lower:
            broker_partner = broker
            break

    products_found = [kw for kw in PRODUCT_KEYWORDS if kw.lower() in text_lower]
    products_offered = ", ".join(products_found) if products_found else None

    soup = BeautifulSoup(html, "html.parser")
    meta_desc = soup.find("meta", attrs={"name": "description"})
    services_summary = meta_desc["content"].strip() if meta_desc and meta_desc.get("content") else None

    # About Us page ka pehla paragraph-ish chunk -> companyDescription
    company_description = None
    if about_text:
        company_description = about_text.strip()[:400]
    elif services_summary:
        company_description = services_summary

    company_size = "Unknown"
    for size, patterns in SIZE_HINT_PATTERNS.items():
        if any(re.search(p, text_lower) for p in patterns):
            company_size = size
            break

    return {
        "companyDescription": company_description,
        "servicesSummary": services_summary,
        "productsOffered": products_offered,
        "sellsAlgoTrading": sells_algo,
        "brokerPartner": broker_partner,
        "companySizeEstimate": company_size,
        "address": None,  # address extract_address() se alag se aata hai
        "enrichmentNotes": None,
    }


# ---------------------------------------------------------------------------
# HYBRID EXTRACTION DISPATCHER
# ---------------------------------------------------------------------------
def is_rate_limit_error(e: Exception) -> bool:
    err_str = str(e).lower()
    return (
        "429" in err_str
        or "rate_limit" in err_str
        or "rate limit" in err_str
        or "quota" in err_str
        or "insufficient_quota" in err_str
    )


def extract_lead_info(lead_id: int, page_text: str, html: str, about_text: str = "") -> dict:
    """LLM try karo. Agar current key rate-limited/quota-exhausted hai to pool
    apne aap agli key pe rotate kar deta hai aur hum retry karte hain -> jab tak
    koi key kaam kare ya sab exhaust na ho jaayein. Sab keys exhaust hone par
    (ya koi non-rate-limit error aane par) rule-based fallback use hota hai."""
    global USE_LLM
    if USE_LLM:
        attempts = len(groq_pool.keys)
        for _ in range(attempts):
            try:
                return call_llm_extract(page_text)
            except Exception as e:
                if is_rate_limit_error(e):
                    groq_pool.mark_current_exhausted(reason=str(e)[:120])
                    if groq_pool.all_exhausted():
                        log.warning(
                            f"[{lead_id}] Saari Groq keys ki limit khatam ho gayi -> "
                            f"is poore run ke liye LLM band kar rahe hain, ab sab leads "
                            f"rule-based se process honge."
                        )
                        USE_LLM = False
                        break
                    # agli key ke saath retry (loop continue)
                    continue
                else:
                    log.warning(f"[{lead_id}] LLM extraction fail hui ({e}) -> rule-based fallback use ho raha hai.")
                    break
    return rule_based_extract(page_text, html, about_text)


# ---------------------------------------------------------------------------
# MAIN PER-LEAD PIPELINE
# ---------------------------------------------------------------------------
KEYWORDS_FOR_EXTRA_PAGES = ["service", "pricing", "plan", "product", "about", "contact"]
ABOUT_PAGE_KEYWORDS = ["about"]
CONTACT_PAGE_KEYWORDS = ["contact"]

BLOCKED_WEBSITE_DOMAINS = [
    "justdial.com", "scribd.com", "indiamart.com", "facebook.com",
    "instagram.com", "linkedin.com", "sulekha.com", "tradeindia.com",
    "yellowpages.in", "google.com", "youtube.com", "twitter.com", "x.com",
]


def is_blocked_domain(url: str) -> bool:
    domain = urlparse(url).netloc.lower()
    return any(blocked in domain for blocked in BLOCKED_WEBSITE_DOMAINS)


def process_lead(lead: dict, current_count: int = 0, total_pending: int = 0):
    lead_id = lead["id"]
    url = normalize_url(lead["website"])
    progress_str = f"[{current_count}/{total_pending}] " if total_pending > 0 else ""
    log.info(f"{progress_str}ID: {lead_id} | {lead['name']} ({lead.get('registrationNo')}) -> {url}")

    if is_blocked_domain(url):
        mark_failed(lead_id, f"skipped - directory/aggregator listing, not a real company website: {url}")
        log.warning(f"{progress_str}[{lead_id}] directory/aggregator site hai (JustDial/Scribd/etc.), skip kar rahe hain.")
        return

    try:
        home_html = fetch_rendered_html(url)
    except Exception as e:
        mark_failed(lead_id, f"homepage fetch failed: {e}")
        log.error(f"[{lead_id}] homepage fetch failed: {e}")
        return

    combined_text = extract_text(home_html)
    all_htmls = [home_html]
    about_text = ""

    for link in find_relevant_links(url, home_html, KEYWORDS_FOR_EXTRA_PAGES):
        try:
            extra_html = fetch_rendered_html(link)
            extra_text = extract_text(extra_html)
            combined_text += " " + extra_text
            all_htmls.append(extra_html)
            if any(k in link.lower() for k in ABOUT_PAGE_KEYWORDS) and not about_text:
                about_text = extra_text
        except Exception:
            continue
        if len(combined_text) >= MAX_TEXT_CHARS:
            break
    combined_text = combined_text[:MAX_TEXT_CHARS]

    footer_text = extract_footer_text(home_html)
    socials = extract_social_links(home_html, url)
    logo_url = find_logo_url(home_html, url, lead_id)

    # Address footer + all crawled pages me se dhoondo
    scraped_address = extract_address(home_html, footer_text, combined_text)
    if not scraped_address:
        for extra_html in all_htmls[1:]:
            scraped_address = extract_address(extra_html, "", extract_text(extra_html))
            if scraped_address:
                break

    # Email/phone: har crawl ki hui page pe try karo, jo pehle mile wahi rakho
    contact_info = {"scrapedEmail": None, "scrapedPhone": None}
    for page_html in all_htmls:
        page_text = extract_text(page_html)
        found = extract_contact_info(page_html, page_text)
        if not contact_info["scrapedEmail"] and found["scrapedEmail"]:
            contact_info["scrapedEmail"] = found["scrapedEmail"]
        if not contact_info["scrapedPhone"] and found["scrapedPhone"]:
            contact_info["scrapedPhone"] = found["scrapedPhone"]
        if contact_info["scrapedEmail"] and contact_info["scrapedPhone"]:
            break

    # footer text bhi combined text me shaamil kar do taaki algo-keyword/broker detection
    # footer-only mentions bhi pakad le
    extraction_input_text = combined_text + " " + footer_text
    extracted = extract_lead_info(lead_id, extraction_input_text, home_html, about_text)

    # LLM ne agar address diya ho to usse priority do, warna regex wala use karo
    final_address = extracted.get("address") or scraped_address

    update_data = {
        "linkedin": socials.get("linkedin"),
        "twitter": socials.get("twitter"),
        "facebook": socials.get("facebook"),
        "servicesSummary": extracted.get("servicesSummary"),
        "productsOffered": extracted.get("productsOffered"),
        "sellsAlgoTrading": extracted.get("sellsAlgoTrading"),
        "brokerPartner": extracted.get("brokerPartner"),
        "companySizeEstimate": extracted.get("companySizeEstimate"),
        "enrichmentNotes": extracted.get("enrichmentNotes"),
        "logoUrl": logo_url,
        "scrapedEmail": contact_info.get("scrapedEmail"),
        "scrapedPhone": contact_info.get("scrapedPhone"),
        "scrapedAddress": final_address,
        "companyDescription": extracted.get("companyDescription"),
    }
    update_lead(lead_id, update_data)
    log.info(
        f"[{lead_id}] enriched successfully. logo={logo_url}, "
        f"email={contact_info.get('scrapedEmail')}, phone={contact_info.get('scrapedPhone')}, "
        f"address={final_address}, algo={extracted.get('sellsAlgoTrading')}"
    )


# ---------------------------------------------------------------------------
# ENTRYPOINT
# ---------------------------------------------------------------------------
def worker_loop(worker_id: int, max_leads: int, total_pending: int = 0, shared_counter = None):
    processed = 0
    log.info(f"[Worker-{worker_id}] shuru ho gaya.")
    while processed < max_leads:
        lead = claim_one_lead()
        if not lead:
            log.info(f"[Worker-{worker_id}] koi pending lead nahi mila, band ho raha hai.")
            break
            
        current_count = 0
        if shared_counter:
            with shared_counter.get_lock():
                shared_counter.value += 1
                current_count = shared_counter.value

        try:
            process_lead(lead, current_count, total_pending)
        except Exception as e:
            log.error(f"[Worker-{worker_id}] lead {lead['id']} process karte waqt crash: {e}")
            mark_failed(lead["id"], f"worker crash: {e}")
        processed += 1
        time.sleep(REQUEST_DELAY_SEC)
    log.info(f"[Worker-{worker_id}] khatam. Total processed: {processed}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=50, help="Total leads process karne hain (sab workers milakar)")
    parser.add_argument("--workers", type=int, default=1, help="Kitne parallel processes chalane hain")
    args = parser.parse_args()

    total_pending = get_total_pending_leads()
    print(f"\n--- Total DB se {total_pending} leads nikle hain website enrichment ke liye. ---\n")

    from multiprocessing import Process, Value
    shared_counter = Value('i', 0)

    if args.workers <= 1:
        worker_loop(1, args.limit, total_pending, shared_counter)
        log.info("Enrichment run complete.")
        return

    per_worker_limit = (args.limit // args.workers) + 5

    processes = []
    for w in range(1, args.workers + 1):
        p = Process(target=worker_loop, args=(w, per_worker_limit, total_pending, shared_counter))
        p.start()
        processes.append(p)

    for p in processes:
        p.join()

    log.info("Sab workers khatam ho gaye. Enrichment run complete.")


if __name__ == "__main__":
    main()
