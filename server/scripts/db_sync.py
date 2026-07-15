import subprocess
import os
import sys

# ======================================================
# PostgreSQL BIN PATH
# ======================================================
PG_BIN = r"C:\Program Files\PostgreSQL\18\bin"

PG_DUMP = os.path.join(PG_BIN, "pg_dump.exe")
PG_RESTORE = os.path.join(PG_BIN, "pg_restore.exe")

# ======================================================
# LOCAL DATABASE
# ======================================================
LOCAL_HOST = "localhost"
LOCAL_PORT = "5432"
LOCAL_DB = "algoconnect"
LOCAL_USER = "postgres"
LOCAL_PASSWORD = "123456"

# ======================================================
# LIVE DATABASE (CHANGE THESE)
# ======================================================
LIVE_HOST = "192.168.0.97"
LIVE_PORT = "5432"
LIVE_DB = "algoconnect"
LIVE_USER = "postgres"
LIVE_PASSWORD = "123456"

# ======================================================
BACKUP_FILE = os.path.join(os.getcwd(), "algoconnect.dump")
# ======================================================


def check_file(path):
    if not os.path.exists(path):
        print(f"❌ File not found:\n{path}")
        sys.exit(1)


check_file(PG_DUMP)
check_file(PG_RESTORE)

print("===================================")
print("Creating Local Backup...")
print("===================================")

env = os.environ.copy()
env["PGPASSWORD"] = LOCAL_PASSWORD

try:
    subprocess.run(
        [
            PG_DUMP,
            "-h",
            LOCAL_HOST,
            "-p",
            LOCAL_PORT,
            "-U",
            LOCAL_USER,
            "-d",
            LOCAL_DB,
            "-Fc",
            "-f",
            BACKUP_FILE,
        ],
        env=env,
        check=True,
    )

    print("✅ Backup Created")
    print(BACKUP_FILE)

except subprocess.CalledProcessError:
    print("❌ Backup Failed")
    sys.exit(1)

print("\n===================================")
print("Restoring To Live Server...")
print("===================================")

env["PGPASSWORD"] = LIVE_PASSWORD

try:
    subprocess.run(
        [
            PG_RESTORE,
            "-h",
            LIVE_HOST,
            "-p",
            LIVE_PORT,
            "-U",
            LIVE_USER,
            "-d",
            LIVE_DB,
            "--clean",
            "--if-exists",
            "--no-owner",
            "--no-privileges",
            BACKUP_FILE,
        ],
        env=env,
        check=True,
    )

    print("\n🎉 DATABASE SYNC SUCCESSFUL")

except subprocess.CalledProcessError:
    print("\n❌ Restore Failed")
    sys.exit(1)