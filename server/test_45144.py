import os, psycopg2, psycopg2.extras
from dotenv import load_dotenv
import sys

sys.path.append(r'e:\AlgoConnect\server\scripts')
import lead_enrichment

load_dotenv(r'e:\AlgoConnect\server\.env')
db_url = os.environ.get('DATABASE_URL')
tavily_key = os.environ.get('TAVILY_API_KEYS', '').split(',')[0].strip()
groq_key = os.environ.get('GROQ_API_KEY')

conn = psycopg2.connect(db_url)
cur = conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
cur.execute('SELECT * FROM "Lead" WHERE id = 45144')
lead = dict(cur.fetchone())
conn.close()

print('Lead:', lead['name'], lead['city'])

res = lead_enrichment.enrich_lead(lead, tavily_key, groq_key, False)
print('Website:', res.get('website'))
print('Directory URL:', res.get('directory_url'))
