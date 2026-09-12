"""FIA RECEIPTS — an Ed25519-signed, hash-chained record of every accepted transition.

No fork: each row's `predecessor_hash` is the hash of the row before it, so a season is a single
chain a forty-line verifier can replay. The signing key belongs to the scrutineer; nothing else
in the loop can append.
"""

from __future__ import annotations

import hashlib
import json
import os
import time
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

from nacl import signing
from nacl.encoding import HexEncoder

REPO = Path(__file__).resolve().parents[2]
# SCRUTINEER_LINEAGE_DIR lets a test run keep its own receipts; a real season never sets it, so
# a test can no longer overwrite the chain a season signed.
LINEAGE = Path(os.environ.get("SCRUTINEER_LINEAGE_DIR") or (REPO / "lineage"))
CHAIN = LINEAGE / "chain.jsonl"
KEYFILE = LINEAGE / "scrutineer.key"
PUBFILE = LINEAGE / "scrutineer.pub"

GENESIS = "0" * 64


@dataclass
class ChainRow:
    round: int
    role: str | None
    prefix: str | None
    parent_version: str
    new_version: str
    proposal_hash: str
    defs_hash: str
    regs_hash: str
    official: float
    claimed: float
    verdict: str
    mode: str
    rule_fired: str
    ts: float = field(default_factory=time.time)
    predecessor_hash: str = GENESIS
    signature: str = ""

    def payload(self) -> str:
        d = {k: v for k, v in asdict(self).items() if k != "signature"}
        return json.dumps(d, sort_keys=True, separators=(",", ":"))

    def digest(self) -> str:
        return hashlib.sha256(self.payload().encode()).hexdigest()


def _key() -> signing.SigningKey:
    KEYFILE.parent.mkdir(parents=True, exist_ok=True)
    if KEYFILE.exists():
        return signing.SigningKey(KEYFILE.read_text().strip(), encoder=HexEncoder)
    sk = signing.SigningKey.generate()
    KEYFILE.write_text(sk.encode(encoder=HexEncoder).decode())
    KEYFILE.chmod(0o600)
    PUBFILE.write_text(sk.verify_key.encode(encoder=HexEncoder).decode())
    return sk


def tail() -> str:
    if not CHAIN.exists():
        return GENESIS
    rows = [ln for ln in CHAIN.read_text().splitlines() if ln.strip()]
    if not rows:
        return GENESIS
    last = ChainRow(**{k: v for k, v in json.loads(rows[-1]).items() if k != "signature"})
    last.signature = json.loads(rows[-1])["signature"]
    return last.digest()


def append(row: ChainRow) -> ChainRow:
    row.predecessor_hash = tail()
    sk = _key()
    row.signature = sk.sign(row.payload().encode()).signature.hex()
    CHAIN.parent.mkdir(parents=True, exist_ok=True)
    with CHAIN.open("a") as fh:
        fh.write(json.dumps(asdict(row), sort_keys=True) + "\n")
    return row


def verify_chain(path: Path | None = None) -> tuple[bool, list[str]]:
    """Replay the chain: every signature valid, every predecessor hash correct, no fork."""
    p = path or CHAIN
    if not p.exists():
        return True, ["chain is empty"]
    if not PUBFILE.exists():
        return False, ["no public key to verify against"]
    vk = signing.VerifyKey(PUBFILE.read_text().strip(), encoder=HexEncoder)
    problems: list[str] = []
    prev = GENESIS
    n = 0
    for i, ln in enumerate(x for x in p.read_text().splitlines() if x.strip()):
        d: dict[str, Any] = json.loads(ln)
        sig = d.pop("signature", "")
        row = ChainRow(**d)
        if row.predecessor_hash != prev:
            problems.append(f"row {i} (round {row.round}): predecessor hash does not match the row before it")
        try:
            vk.verify(row.payload().encode(), bytes.fromhex(sig))
        except Exception:
            problems.append(f"row {i} (round {row.round}): signature does not verify")
        row.signature = sig
        prev = row.digest()
        n += 1
    return (not problems), (problems or [f"{n} row(s) verified, chain intact"])


def rows() -> list[dict[str, Any]]:
    if not CHAIN.exists():
        return []
    return [json.loads(ln) for ln in CHAIN.read_text().splitlines() if ln.strip()]
