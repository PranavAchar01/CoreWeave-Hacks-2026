import os
import shutil
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

# Tests exercise the control plane, not the network or the container runtime.
os.environ.setdefault("SCRUTINEER_SANDBOX", "local")
os.environ.setdefault("SCRUTINEER_INFERENCE", "local")
os.environ.setdefault("SCRUTINEER_TYPED", "local")
os.environ.setdefault("SCRUTINEER_ENGINEER", "local")
os.environ.setdefault("SCRUTINEER_RL", "local")
os.environ.setdefault("SCRUTINEER_REGISTRY", "local")
os.environ.setdefault("SCRUTINEER_ARIA", "off")

# Tests get their own state and lineage directories. Without this a test run overwrites the
# receipts and debriefs a real season signed, which is exactly what happened once.
_TMP = Path(tempfile.mkdtemp(prefix="scrutineer-tests-"))
(_TMP / "state").mkdir(parents=True, exist_ok=True)
(_TMP / "lineage").mkdir(parents=True, exist_ok=True)
shutil.copy(ROOT / "state" / "variants.json", _TMP / "state" / "variants.json")
os.environ["SCRUTINEER_STATE_DIR"] = str(_TMP / "state")
os.environ["SCRUTINEER_LINEAGE_DIR"] = str(_TMP / "lineage")


def pytest_sessionfinish(session, exitstatus):
    shutil.rmtree(_TMP, ignore_errors=True)
