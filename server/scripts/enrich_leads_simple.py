"""
Simple Lead Enrichment Script — Email + Phone ONLY
-------------------------------------------------------------------------
Kaam: Jin leads ke paas website hai, unse sirf scrapedEmail aur
scrapedPhone nikalna aur DB me update karna. Bas itna hi.

Safety:
- COALESCE -> existing non-null email/phone kabhi overwrite nahi honge.
- Empty/junk values kabhi DB me nahi jaate.
- Stale [CLAIMED] leads (crashed run) 15 min baad reclaim ho jaati hain.
- 3 baar fail hone par lead permanently skip ho jaati hai.
"""

import os
import sys
import re
import time
import argparse
import logging

import psycopg2
import psycopg2.extras
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright

try:
    from dotenv import load_dotenv
    script_dir = os.path.dirname(os.path.abspath(__file__))
    load_dotenv(os.path.join(script_dir, "..", ".env"))
except ImportError:
    pass

DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    print("DATABASE_URL env var missing. Set it and re-run.")
    sys.exit(1)

PAGE_TIMEOUT_MS = 25000
REQUEST_DELAY_SEC = 2
MAX_TEXT_CHARS = 12000
CLAIM_TIMEOUT_MIN = 15
MAX_ATTEMPTS = 3
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("enrich")


# ---------------------------------------------------------------------------
# WHERE-CLAUSE — bilkul aapki di hui query jaisa hi, bas claim-tracking ke liye
# enrichmentNotes check add kiya hai taki har lead sirf ek baar process ho
# ---------------------------------------------------------------------------
def eligibility_clause():
    return f"""
        website IS NOT NULL
        AND website <> ''
        AND ("scrapedPhone" IS NULL OR TRIM("scrapedPhone") = ''
             OR "scrapedEmail" IS NULL OR TRIM("scrapedEmail") = '')
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
        RETURNING id, name, website, "enrichmentNotes"
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
    sql = f'SELECT COUNT(id) FROM "Lead" WHERE {eligibility_clause()}'
    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(sql)
        count = cur.fetchone()[0]
    conn.close()
    return count


def update_lead(lead_id, email, phone):
    sql = """
        UPDATE "Lead"
        SET "scrapedEmail"    = COALESCE(NULLIF(TRIM("scrapedEmail"), ''), %(email)s),
            "scrapedPhone"    = COALESCE(NULLIF(TRIM("scrapedPhone"), ''), %(phone)s),
            "isEnriched"      = true,
            "enrichmentNotes" = '[ENRICHED] Email/Phone extraction',
            "updatedAt"       = NOW()
        WHERE id = %(id)s
    """
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(sql, {"id": lead_id, "email": email, "phone": phone})
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
    note = f"[SCRAPE_FAILED:{attempt}] {reason}"[:250]
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                'UPDATE "Lead" SET "enrichmentNotes" = %s, "updatedAt" = NOW() WHERE id = %s',
                (note, lead_id),
            )
        conn.commit()
    except Exception as e:
        conn.rollback()
        log.error(f"[{lead_id}] mark_failed update failed: {e}")
    finally:
        conn.close()


# ---------------------------------------------------------------------------
# SANITIZATION
# ---------------------------------------------------------------------------
JUNK_VALUES = {"", "none", "null", "n/a", "na", "-", "undefined"}


def sanitize(v):
    if v is None:
        return None
    v = v.strip()
    return None if v.lower() in JUNK_VALUES else v


# ---------------------------------------------------------------------------
# SCRAPING
# ---------------------------------------------------------------------------
EMAIL_REGEX = re.compile(r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+')
PHONE_REGEX = re.compile(r'(?:\+91[-\s]?)?[6-9]\d{9}')
JUNK_EMAIL_DOMAINS = [
    "example.com", "yourdomain.com", "email.com", "domain.com", "test.com",
    "sentry.io", "wixpress.com", "godaddy.com", "yoursite.com",
]


def normalize_url(url: str) -> str:
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    return url


def fetch_html(browser, url: str) -> str:
    page = browser.new_page(user_agent=USER_AGENT)
    try:
        page.goto(url, timeout=PAGE_TIMEOUT_MS, wait_until="domcontentloaded")
        page.wait_for_timeout(1500)
        return page.content()
    finally:
        page.close()


def find_contact_links(base_url: str, html: str):
    """Contact/About jaise pages dhoondo — inme email/phone milne ke chances zyada hote hain."""
    from urllib.parse import urljoin, urlparse
    soup = BeautifulSoup(html, "html.parser")
    keywords = ["contact", "about", "support", "reach", "get in touch"]
    found = set()
    for a in soup.find_all("a", href=True):
        text = (a.get_text() or "").lower()
        href = a["href"].lower()
        if any(k in text or k in href for k in keywords):
            full = urljoin(base_url, a["href"])
            if urlparse(full).netloc == urlparse(base_url).netloc:
                found.add(full)
    return sorted(found)[:3]


def extract_email_phone(html: str):
    soup = BeautifulSoup(html, "html.parser")
    text = " ".join(soup.get_text(separator=" ").split())[:MAX_TEXT_CHARS]

    emails, phones = set(), set()

    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        if href.lower().startswith("mailto:"):
            addr = href.split(":", 1)[1].split("?")[0].strip()
            if addr:
                emails.add(addr.lower())
        elif href.lower().startswith("tel:"):
            digits = re.sub(r"\D", "", href.split(":", 1)[1])
            phones.add(digits)

    for m in EMAIL_REGEX.findall(text):
        emails.add(m.lower())
    for m in PHONE_REGEX.findall(text):
        phones.add(re.sub(r"\D", "", m))

    emails = {e for e in emails if not any(j in e for j in JUNK_EMAIL_DOMAINS)}

    clean_phones = set()
    for p in phones:
        digits = p[2:] if len(p) == 12 and p.startswith("91") else p
        if len(digits) == 10 and digits[0] in "6789":
            clean_phones.add(digits)

    email = sorted(emails)[0] if emails else None
    phone = sorted(clean_phones)[0] if clean_phones else None
    return email, phone


# ---------------------------------------------------------------------------
# MAIN WORKER
# ---------------------------------------------------------------------------
def process_lead(browser, lead) -> bool:
    lead_id = lead["id"]
    base_url = normalize_url(lead["website"])
    prev_notes = lead.get("enrichmentNotes")
    log.info(f"[{lead_id}] Processing {base_url}")

    try:
        html_main = fetch_html(browser, base_url)
    except Exception as e:
        log.error(f"[{lead_id}] Website load failed: {e}")
        mark_failed(lead_id, f"Website load failed: {str(e)[:100]}", prev_notes)
        return False

    email, phone = extract_email_phone(html_main)

    if not email or not phone:
        for link in find_contact_links(base_url, html_main):
            if email and phone:
                break
            try:
                sub_html = fetch_html(browser, link)
                sub_email, sub_phone = extract_email_phone(sub_html)
                email = email or sub_email
                phone = phone or sub_phone
            except Exception as e:
                log.warning(f"[{lead_id}] Sub-page {link} failed: {e}")

    email, phone = sanitize(email), sanitize(phone)
    log.info(f"[{lead_id}] Found -> email: {email}, phone: {phone}")

    if not email and not phone:
        mark_failed(lead_id, "No email/phone found on site", prev_notes)
        return False

    update_lead(lead_id, email, phone)
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