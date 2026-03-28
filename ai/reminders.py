from ai.database import get_connection


# -------------------------
# CREATE
# -------------------------

def add_reminder(task, date=None, time=None, priority="normal"):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO reminders (task, date, time, priority, completed)
        VALUES (?, ?, ?, ?, 0)
    """, (task, date, time, priority))
    conn.commit()
    conn.close()


# -------------------------
# READ
# -------------------------

def get_reminders():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, task, date, time, priority, completed
        FROM reminders
        ORDER BY completed ASC, id DESC
    """)
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]


# -------------------------
# DELETE
# -------------------------

def delete_reminder(reminder_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM reminders WHERE id = ?", (reminder_id,))
    conn.commit()
    conn.close()


# -------------------------
# TOGGLE COMPLETE
# -------------------------

def toggle_reminder(reminder_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE reminders
        SET completed = CASE WHEN completed = 1 THEN 0 ELSE 1 END
        WHERE id = ?
    """, (reminder_id,))
    conn.commit()
    conn.close()