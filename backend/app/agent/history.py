import json
import sqlite3
from pathlib import Path
from typing import List

from ..models import EvidenceRow


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
                    task TEXT, task_type TEXT, provider TEXT, model TEXT,
                    quality REAL, latency_ms INTEGER, cost_usd REAL,
                    reliability REAL, passed BOOLEAN, status TEXT,
                    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            conn.execute('CREATE INDEX IF NOT EXISTS idx_history_task_type ON execution_history (task_type)')
            conn.execute('''
                CREATE TABLE IF NOT EXISTS decision_ledger (
                    decision_id TEXT PRIMARY KEY,
                    run_id TEXT,
                    iteration INTEGER,
                    action TEXT,
                    task TEXT,
                    task_type TEXT,
                    provider TEXT,
                    model TEXT,
                    policy_version TEXT,
                    risk TEXT,
                    reason_code TEXT,
                    reason TEXT,
                    evidence_count INTEGER DEFAULT 0,
                    estimated_cost_usd REAL DEFAULT 0,
                    actual_cost_usd REAL DEFAULT 0,
                    latency_ms INTEGER DEFAULT 0,
                    outcome TEXT,
                    verification TEXT,
                    alternatives TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            conn.execute('CREATE INDEX IF NOT EXISTS idx_ledger_run_id ON decision_ledger (run_id)')
            conn.commit()

    def record_decision(self, state: dict, action: str | None = None, outcome: str | None = None) -> None:
        decision_id = state.get("decision_id")
        if not decision_id:
            return
        decision = state.get("decision") or {}
        with sqlite3.connect(str(self.db_path)) as conn:
            conn.execute('''
                INSERT OR REPLACE INTO decision_ledger
                (decision_id, run_id, iteration, action, task, task_type, provider, model,
                 policy_version, risk, reason_code, reason, evidence_count,
                 estimated_cost_usd, actual_cost_usd, latency_ms, outcome, verification, alternatives)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                decision_id, state.get("run_id", decision_id), state.get("iteration", 0),
                action or state.get("decision_action") or decision.get("action"),
                state.get("task", ""), state.get("task_type", "auto"), state.get("provider"), state.get("model"),
                state.get("policy_version"), decision.get("risk"), decision.get("reason_code"),
                decision.get("reason"), state.get("evidence_count", 0), decision.get("estimated_cost_usd", 0.0),
                state.get("cost_usd", 0.0) or 0.0, state.get("latency_ms", 0) or 0,
                outcome or state.get("status"), json.dumps(state.get("verification", {})),
                json.dumps(decision.get("alternatives", [])),
            ))
            conn.commit()

    def get_decision(self, decision_id: str) -> dict | None:
        with sqlite3.connect(str(self.db_path)) as conn:
            conn.row_factory = sqlite3.Row
            row = conn.execute('SELECT * FROM decision_ledger WHERE decision_id = ?', (decision_id,)).fetchone()
        return dict(row) if row else None

    def list_decisions(self, limit: int = 50) -> list[dict]:
        with sqlite3.connect(str(self.db_path)) as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute('SELECT * FROM decision_ledger ORDER BY created_at DESC LIMIT ?', (limit,)).fetchall()
        return [dict(row) for row in rows]

    def save_run(self, state: dict) -> None:
        if state.get("status") not in ("done", "failed", "aborted", "blocked"):
            return
        provider = state.get("provider", "unknown")
        if not provider or provider == "unknown":
            return
        quality = state.get("quality", 0.0) or 0.0
        latency_ms = state.get("latency_ms", 0) or 0
        cost_usd = state.get("cost_usd", 0.0) or 0.0
        passed = state.get("status") == "done" and quality >= 0.7
        reliability = 1.0 if passed else 0.0
        with sqlite3.connect(str(self.db_path)) as conn:
            conn.execute('''
                INSERT INTO execution_history
                (task, task_type, provider, model, quality, latency_ms, cost_usd, reliability, passed, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (state.get("task", ""), state.get("task_type", "auto"), provider,
                  state.get("model", "unknown"), quality, latency_ms, cost_usd,
                  reliability, passed, state.get("status")))
            conn.commit()

    def get_evidence(self, task_type: str, limit: int = 50) -> List[EvidenceRow]:
        with sqlite3.connect(str(self.db_path)) as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute('''
                SELECT task_type, provider, model, quality, latency_ms, cost_usd, reliability, passed
                FROM execution_history WHERE task_type = ? ORDER BY timestamp DESC LIMIT ?
            ''', (task_type, limit)).fetchall()
        return [EvidenceRow(task_type=r["task_type"], provider=r["provider"], model=r["model"],
                            quality=r["quality"], latency_ms=r["latency_ms"], cost_usd=r["cost_usd"],
                            reliability=r["reliability"], passed=bool(r["passed"])) for r in rows]


history_store = ExecutionHistoryStore()
