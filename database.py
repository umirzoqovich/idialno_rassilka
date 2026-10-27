import os
import sqlite3
import aiosqlite
import hashlib
import secrets
import hmac
import datetime
import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = DATA_DIR / "app.db"

def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100000)
    return f"{salt.hex()}${key.hex()}"

def verify_password(password: str, hashed: str) -> bool:
    try:
        salt_hex, key_hex = hashed.split("$")
        salt = bytes.fromhex(salt_hex)
        key = bytes.fromhex(key_hex)
        new_key = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100000)
        return hmac.compare_digest(key, new_key)
    except Exception:
        return False

async def init_db():
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("PRAGMA journal_mode=WAL;")
        await db.execute("PRAGMA foreign_keys=ON;")

        # Users table
        await db.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL COLLATE NOCASE,
                password_hash TEXT NOT NULL,
                full_name TEXT DEFAULT '',
                avatar TEXT DEFAULT '',
                created_at TEXT NOT NULL,
                last_login TEXT
            );
        """)

        # User Sessions table
        await db.execute("""
            CREATE TABLE IF NOT EXISTS user_sessions (
                token TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                expires_at TEXT NOT NULL,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            );
        """)

        # User Settings table (isolated per user)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS user_settings (
                user_id INTEGER PRIMARY KEY,
                api_id TEXT DEFAULT '',
                api_hash TEXT DEFAULT '',
                phone TEXT DEFAULT '',
                min_delay INTEGER DEFAULT 15,
                max_delay INTEGER DEFAULT 30,
                auto_clean_contacts INTEGER DEFAULT 1,
                max_limit INTEGER DEFAULT 0,
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            );
        """)

        # Campaign History table (isolated per user)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS campaign_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                total INTEGER DEFAULT 0,
                sent INTEGER DEFAULT 0,
                not_found INTEGER DEFAULT 0,
                failed INTEGER DEFAULT 0,
                status TEXT DEFAULT 'completed',
                message_preview TEXT DEFAULT '',
                report_filename TEXT DEFAULT '',
                report_path TEXT DEFAULT '',
                results_json TEXT DEFAULT '[]',
                FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
            );
        """)

        await db.commit()

async def create_user(email: str, password: str, full_name: str = ""):
    email = email.strip().lower()
    if not email:
        raise ValueError("Email manzili kiritilishi shart!")
    if len(password) < 6:
        raise ValueError("Parol kamida 6 ta belgidan iborat bo'lishi kerak!")

    pwd_hash = hash_password(password)
    now = datetime.datetime.now().isoformat()

    if not full_name:
        full_name = email.split("@")[0].capitalize()

    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        try:
            cursor = await db.execute(
                "INSERT INTO users (email, password_hash, full_name, created_at, last_login) VALUES (?, ?, ?, ?, ?)",
                (email, pwd_hash, full_name, now, now)
            )
            user_id = cursor.lastrowid
            # Initialize default settings
            await db.execute(
                "INSERT INTO user_settings (user_id, min_delay, max_delay, auto_clean_contacts, max_limit) VALUES (?, 15, 30, 1, 0)",
                (user_id,)
            )
            await db.commit()
            return {
                "id": user_id,
                "email": email,
                "full_name": full_name,
                "avatar": "",
                "created_at": now
            }
        except sqlite3.IntegrityError:
            raise ValueError("Ushbu Gmail / Pochta manzili allaqachon ro'yxatdan o'tgan!")

async def authenticate_user(email: str, password: str):
    email = email.strip().lower()
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM users WHERE email = ?", (email,)) as cursor:
            user = await cursor.fetchone()
            if not user:
                return None
            if not verify_password(password, user["password_hash"]):
                return None

            now = datetime.datetime.now().isoformat()
            await db.execute("UPDATE users SET last_login = ? WHERE id = ?", (now, user["id"]))
            await db.commit()
            return dict(user)

async def get_or_create_google_user(email: str, full_name: str = "", avatar: str = ""):
    email = email.strip().lower()
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM users WHERE email = ?", (email,)) as cursor:
            user = await cursor.fetchone()
            now = datetime.datetime.now().isoformat()
            if user:
                # Update last login and avatar if provided
                await db.execute("UPDATE users SET last_login = ?, avatar = COALESCE(NULLIF(?, ''), avatar), full_name = COALESCE(NULLIF(?, ''), full_name) WHERE id = ?", (now, avatar, full_name, user["id"]))
                await db.commit()
                return dict(user)

            # Create random password hash for Google auth users
            pwd_hash = hash_password(secrets.token_urlsafe(32))
            cursor = await db.execute(
                "INSERT INTO users (email, password_hash, full_name, avatar, created_at, last_login) VALUES (?, ?, ?, ?, ?, ?)",
                (email, pwd_hash, full_name or email.split("@")[0].capitalize(), avatar, now, now)
            )
            user_id = cursor.lastrowid
            await db.execute(
                "INSERT INTO user_settings (user_id, min_delay, max_delay, auto_clean_contacts, max_limit) VALUES (?, 15, 30, 1, 0)",
                (user_id,)
            )
            await db.commit()
            return {
                "id": user_id,
                "email": email,
                "full_name": full_name or email.split("@")[0].capitalize(),
                "avatar": avatar,
                "created_at": now
            }

async def create_session(user_id: int, days: int = 30) -> str:
    token = secrets.token_hex(32)
    now = datetime.datetime.now()
    expires = now + datetime.timedelta(days=days)

    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT INTO user_sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
            (token, user_id, now.isoformat(), expires.isoformat())
        )
        await db.commit()
    return token

async def get_user_by_session(token: str):
    if not token:
        return None
    now = datetime.datetime.now().isoformat()
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("""
            SELECT u.id, u.email, u.full_name, u.avatar, u.created_at, u.last_login 
            FROM user_sessions s
            JOIN users u ON s.user_id = u.id
            WHERE s.token = ? AND s.expires_at > ?
        """, (token, now)) as cursor:
            row = await cursor.fetchone()
            return dict(row) if row else None

async def delete_session(token: str):
    if not token:
        return
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("DELETE FROM user_sessions WHERE token = ?", (token,))
        await db.commit()

async def get_user_settings(user_id: int):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("SELECT * FROM user_settings WHERE user_id = ?", (user_id,)) as cursor:
            row = await cursor.fetchone()
            if row:
                res = dict(row)
                res["auto_clean_contacts"] = bool(res.get("auto_clean_contacts", 1))
                return res

            # Default if not found
            default = {
                "user_id": user_id,
                "api_id": "",
                "api_hash": "",
                "phone": "",
                "min_delay": 15,
                "max_delay": 30,
                "auto_clean_contacts": True,
                "max_limit": 0
            }
            await db.execute(
                "INSERT INTO user_settings (user_id, min_delay, max_delay, auto_clean_contacts, max_limit) VALUES (?, 15, 30, 1, 0)",
                (user_id,)
            )
            await db.commit()
            return default

async def save_user_settings(user_id: int, data: dict):
    current = await get_user_settings(user_id)
    current.update(data)
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            INSERT INTO user_settings (user_id, api_id, api_hash, phone, min_delay, max_delay, auto_clean_contacts, max_limit)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
                api_id = excluded.api_id,
                api_hash = excluded.api_hash,
                phone = excluded.phone,
                min_delay = excluded.min_delay,
                max_delay = excluded.max_delay,
                auto_clean_contacts = excluded.auto_clean_contacts,
                max_limit = excluded.max_limit
        """, (
            user_id,
            str(current.get("api_id", "")),
            str(current.get("api_hash", "")),
            str(current.get("phone", "")),
            int(current.get("min_delay", 15)),
            int(current.get("max_delay", 30)),
            1 if current.get("auto_clean_contacts", True) else 0,
            int(current.get("max_limit", 0))
        ))
        await db.commit()
    return current

async def save_campaign_history(user_id: int, stats: dict, message_preview: str, report_filename: str, report_path: str, results: list):
    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute("""
            INSERT INTO campaign_history (
                user_id, created_at, total, sent, not_found, failed, status, message_preview, report_filename, report_path, results_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            user_id,
            now,
            stats.get("total", 0),
            stats.get("sent", 0),
            stats.get("not_found", 0),
            stats.get("failed", 0),
            stats.get("status", "completed"),
            message_preview[:200] if message_preview else "",
            report_filename,
            report_path,
            json.dumps(results[:50], ensure_ascii=False)  # keep top 50 in db preview
        ))
        await db.commit()
        return cursor.lastrowid

async def get_user_campaign_history(user_id: int, limit: int = 20):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("""
            SELECT id, user_id, created_at, total, sent, not_found, failed, status, message_preview, report_filename, report_path
            FROM campaign_history
            WHERE user_id = ?
            ORDER BY id DESC
            LIMIT ?
        """, (user_id, limit)) as cursor:
            rows = await cursor.fetchall()
            return [dict(r) for r in rows]

async def get_campaign_by_id(campaign_id: int, user_id: int):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("""
            SELECT * FROM campaign_history WHERE id = ? AND user_id = ?
        """, (campaign_id, user_id)) as cursor:
            row = await cursor.fetchone()
            return dict(row) if row else None

async def get_user_stats(user_id: int):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("""
            SELECT 
                COUNT(*) as total_campaigns,
                COALESCE(SUM(total), 0) as total_contacts,
                COALESCE(SUM(sent), 0) as total_sent,
                COALESCE(SUM(not_found), 0) as total_not_found,
                COALESCE(SUM(failed), 0) as total_failed
            FROM campaign_history
            WHERE user_id = ?
        """, (user_id,)) as cursor:
            row = await cursor.fetchone()
            if row:
                res = dict(row)
                sent = res["total_sent"]
                total = res["total_contacts"]
                res["success_rate"] = round((sent / total * 100), 1) if total > 0 else 0
                return res
            return {
                "total_campaigns": 0, "total_contacts": 0, "total_sent": 0, 
                "total_not_found": 0, "total_failed": 0, "success_rate": 0
            }

