from __future__ import annotations

import json
import sqlite3
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field


ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"
DATABASE = DATA_DIR / "medassist.sqlite3"

app = FastAPI(
    title="MedAssist AI API",
    version="1.0.0",
    description="Local demo API. Use synthetic information only.",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:4173", "http://localhost:4173"],
    allow_credentials=False,
    allow_methods=["GET", "PUT", "OPTIONS"],
    allow_headers=["Content-Type"],
)


class PatientProfile(BaseModel):
    model_config = ConfigDict(extra="allow")

    name: str
    email: str = ""
    age: int | str = ""
    bloodType: str = ""
    phone: str = ""
    city: str = ""
    conditions: list[str] = Field(default_factory=list)
    allergies: list[str] = Field(default_factory=list)


class MedAssistState(BaseModel):
    model_config = ConfigDict(extra="allow")

    profile: PatientProfile
    vitals: list[dict[str, Any]] = Field(default_factory=list)
    records: list[dict[str, Any]] = Field(default_factory=list)
    medications: list[dict[str, Any]] = Field(default_factory=list)
    appointments: list[dict[str, Any]] = Field(default_factory=list)
    chat: list[dict[str, Any]] = Field(default_factory=list)
    prescriptionNotes: list[str] = Field(default_factory=list)
    currentRole: str = ""


def connect() -> sqlite3.Connection:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DATABASE, timeout=10)
    connection.row_factory = sqlite3.Row
    return connection


def initialize_database() -> None:
    with closing(connect()) as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS app_state (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                payload TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )
        connection.commit()


initialize_database()


@app.get("/")
def root() -> dict[str, str]:
    return {"name": "MedAssist AI API", "docs": "/docs", "health": "/api/health"}


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "storage": "sqlite", "mode": "local demo"}


@app.get("/api/state")
def get_state() -> dict[str, Any]:
    with closing(connect()) as connection:
        row = connection.execute("SELECT payload FROM app_state WHERE id = 1").fetchone()
    if row is None:
        return {}
    try:
        return json.loads(row["payload"])
    except (json.JSONDecodeError, TypeError) as exc:
        raise HTTPException(status_code=500, detail="Stored demo data could not be read") from exc


@app.put("/api/state")
def put_state(state: MedAssistState) -> dict[str, Any]:
    payload = state.model_dump(mode="json")
    timestamp = datetime.now(timezone.utc).isoformat()
    with closing(connect()) as connection:
        connection.execute(
            """
            INSERT INTO app_state (id, payload, updated_at)
            VALUES (1, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                payload = excluded.payload,
                updated_at = excluded.updated_at
            """,
            (json.dumps(payload, ensure_ascii=False), timestamp),
        )
        connection.commit()
    return {"saved": True, "updatedAt": timestamp}
