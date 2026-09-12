import sqlite3
import json
from pathlib import Path
from typing import List, Optional

from ..models import EvidenceRow, AgentState

class ExecutionHistoryStore:
    def __init__(self, db_path: str = ".data/execution_history.db"):
        self.db_path = Path(db_path)
        self._init_db()

    def _init_db(self):
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        with sqlite3.connect(str(self.db_path)) as conn:
            conn.execute('''
                CREATE TABLE IF NOT EXISTS execution_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    task TEXT,
                    task_type TEXT,
                    provider TEXT,
                    model TEXT,
                    quality REAL,
                    latency_ms INTEGER,
                    cost_usd REAL,
                    reliability REAL,
                    passed BOOLEAN,
                    status TEXT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            # Add an index on task_type for faster evidence retrieval
            conn.execute("CREATE INDEX IF NOT EXISTS idx_history_task_type ON execution_history (task_type)")
            conn.commit()

    def save_run(self, state: dict) -> None:
        """Saves a completed execution into history to inform future tasks."""
        if state.get("status") not in ("done", "failed"):
            return

        task = state.get("task", "")
        task_type = state.get("task_type", "auto")
        provider = state.get("provider", "unknown")
        model = state.get("model", "unknown")

        # If execution wasn't attempted, there is no execution metric to learn from.
        if not provider or provider == "unknown":
            return

        quality = state.get("quality", 0.0)
        latency_ms = state.get("latency_ms", 0)
        cost_usd = state.get("cost_usd", 0.0)

        # passed means no explicit failures and quality >= 0.7
        passed = (state.get("status") == "done") and (quality >= 0.7)
        reliability = 1.0 if passed else 0.0

        with sqlite3.connect(str(self.db_path)) as conn:
            conn.execute('''
                INSERT INTO execution_history
                (task, task_type, provider, model, quality, latency_ms, cost_usd, reliability, passed, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                task, task_type, provider, model, quality, latency_ms, cost_usd, reliability, passed, state.get("status")
            ))
            conn.commit()

    def get_evidence(self, task_type: str, limit: int = 50) -> List[EvidenceRow]:
        """Retrieves history for a task type to be used as evidence for future routing."""
        with sqlite3.connect(str(self.db_path)) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.execute('''
                SELECT task_type, provider, model, quality, latency_ms, cost_usd, reliability, passed
                FROM execution_history
                WHERE task_type = ?
                ORDER BY timestamp DESC
                LIMIT ?
            ''', (task_type, limit))
            rows = cursor.fetchall()

        return [
            EvidenceRow(
                task_type=row["task_type"],
                provider=row["provider"],
                model=row["model"],
                quality=row["quality"],
                latency_ms=row["latency_ms"],
                cost_usd=row["cost_usd"],
                reliability=row["reliability"],
                passed=bool(row["passed"])
            )
            for row in rows
        ]

history_store = ExecutionHistoryStore()
