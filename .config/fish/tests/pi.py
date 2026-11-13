"""Run with: python3 .config/fish/tests/pi.py (no config execution)."""
from pathlib import Path
import re
import subprocess

config = Path(__file__).resolve().parents[1] / "config.fish"
text = config.read_text()
assert not re.search(r"(?m)^function pi\s*$", text), "pi should use the executable directly"
assert "PI_CLAUDE_CODE_CONFIG_DIR" not in text, "Pi should use the default Claude configuration"
subprocess.run(["fish", "--no-execute", str(config)], check=True)

print("PASS: no Pi wrapper or Claude config override; Fish syntax valid")
