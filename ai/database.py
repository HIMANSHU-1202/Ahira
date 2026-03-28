import sqlite3
import os

DB_PATH = "data/ahira.db"


# -------------------------
# CONNECTION
# -------------------------

def get_connection():
    os.makedirs("data", exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


# -------------------------
# INITIALIZE DATABASE
# -------------------------

def init_db():
    conn = get_connection()
    cursor = conn.cursor()

    # Create table if it doesn't exist yet
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS reminders (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            task        TEXT NOT NULL,
            date        TEXT,
            time        TEXT,
            priority    TEXT    DEFAULT 'normal',
            completed   INTEGER DEFAULT 0,
            created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Safe migration: add any missing columns so old databases keep working
    migrations = [
        "ALTER TABLE reminders ADD COLUMN date TEXT",
        "ALTER TABLE reminders ADD COLUMN time TEXT",
        "ALTER TABLE reminders ADD COLUMN priority TEXT DEFAULT 'normal'",
        "ALTER TABLE reminders ADD COLUMN completed INTEGER DEFAULT 0",
        "ALTER TABLE reminders ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
    ]

    for sql in migrations:
        try:
            cursor.execute(sql)
        except Exception:
            pass  # column already exists — safe to ignore

    conn.commit()
    conn.close()