import psycopg2
conn = psycopg2.connect('postgresql://postgres:123456@localhost:5432/algoconnect')
cur = conn.cursor()
cur.execute('SELECT id, "servicesSummary" FROM "Lead" WHERE website IS NOT NULL AND website <> \'\' LIMIT 5')
print('Sample:', cur.fetchall())
