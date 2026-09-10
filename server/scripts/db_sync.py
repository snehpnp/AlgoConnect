import subprocess
import os
import sys
import psycopg2

# python scripts/db_sync.py local-to-live
# python scripts/db_sync.py live-to-local

# ======================================================
# PostgreSQL BIN PATH
# ======================================================
PG_BIN = r"C:\Program Files\PostgreSQL\18\bin"

PG_DUMP = os.path.join(PG_BIN, "pg_dump.exe")
PG_RESTORE = os.path.join(PG_BIN, "pg_restore.exe")

# ======================================================
# LOCAL DATABASE
# ======================================================
LOCAL = {
    "host": "localhost",
    "port": "5432",
    "db": "algoconnect",
    "user": "postgres",
    "password": "123456"
}

# ======================================================
# LIVE DATABASE
# ======================================================
LIVE = {
    "host": "192.168.0.97",
    "port": "5432",
    "db": "algoconnect",
    "user": "postgres",
    "password": "123456"
}



BACKUP_FILE = os.path.join(os.getcwd(), "algoconnect.dump")


# ======================================================
# Helpers
# ======================================================

def check_file(path):
    if not os.path.exists(path):
        print(f"❌ File not found: {path}")
        sys.exit(1)


check_file(PG_DUMP)
check_file(PG_RESTORE)


def clean_database(db):
    print(f"\n🗑 Cleaning {db['host']}...")

    conn = psycopg2.connect(
        host=db["host"],
        port=db["port"],
        dbname=db["db"],
        user=db["user"],
        password=db["password"],
    )

    conn.autocommit = True

    cur = conn.cursor()

    cur.execute("""
        DROP SCHEMA IF EXISTS public CASCADE;
        CREATE SCHEMA public;
        GRANT ALL ON SCHEMA public TO postgres;
        GRANT ALL ON SCHEMA public TO public;
    """)

    cur.close()
    conn.close()

    print("✅ Database Cleaned")


def sync(source, destination):

    print("\n===================================")
    print("Creating Backup...")
    print("===================================")

    env = os.environ.copy()
    env["PGPASSWORD"] = source["password"]

    subprocess.run(
        [
            PG_DUMP,
            "-h", source["host"],
            "-p", source["port"],
            "-U", source["user"],
            "-d", source["db"],
            "-Fc",
            "-f", BACKUP_FILE,
        ],
        env=env,
        check=True,
    )

    print("✅ Backup Created")

    clean_database(destination)

    print("\n===================================")
    print("Restoring...")
    print("===================================")

    env["PGPASSWORD"] = destination["password"]

    subprocess.run(
        [
            PG_RESTORE,
            "-h", destination["host"],
            "-p", destination["port"],
            "-U", destination["user"],
            "-d", destination["db"],
            "--no-owner",
            "--no-privileges",
            BACKUP_FILE,
        ],
        env=env,
        check=True,
    )

    print("\n🎉 DATABASE SYNC SUCCESSFUL")


# ======================================================
# MAIN
# ======================================================

if len(sys.argv) != 2:
    print("\nUsage:")
    print("python db_sync.py local-to-live")
    print("python db_sync.py live-to-local")
    sys.exit(1)

mode = sys.argv[1].lower()

try:

    if mode == "local-to-live":
        sync(LOCAL, LIVE)

    elif mode == "live-to-local":
        sync(LIVE, LOCAL)

    else:
        print("❌ Invalid Mode")
        print("Use local-to-live OR live-to-local")

except subprocess.CalledProcessError as e:
    print("\n❌ Sync Failed")
    print(e)
    sys.exit(1)