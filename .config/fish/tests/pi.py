"""Run with: python3 .config/fish/tests/pi.py (stubbed picker and Pi only)."""
import os
from pathlib import Path
import re
import subprocess
import tempfile

config = Path(__file__).resolve().parents[1] / "config.fish"
block = re.search(r"(?ms)^function pi\n.*?^end$", config.read_text())
assert block, "could not extract pi"

with tempfile.TemporaryDirectory() as directory:
    root = Path(directory)
    runner = root / "runner.fish"
    runner.write_text(block[0] + '\npi --name "two words"\n')
    picker = root / "fzf"
    picker.write_text('''#!/bin/sh
printf '%s\n' "$@" > "$PI_TEST_DIR/picker-args"
cat > "$PI_TEST_DIR/menu"
printf '%s' "$PI_TEST_SELECTION"
exit "$PI_TEST_PICKER_STATUS"
''')
    executable = root / "pi"
    executable.write_text('''#!/bin/sh
printf '%s\n' "${PI_CLAUDE_CODE_CONFIG_DIR-}" "$@" > "$PI_TEST_DIR/call"
exit 7
''')
    picker.chmod(0o755)
    executable.chmod(0o755)
    env = dict(os.environ, PATH=f"{root}:{os.environ['PATH']}", PI_TEST_DIR=directory)
    env.pop("PI_CLAUDE_CODE_CONFIG_DIR", None)
    for selection, config_dir, model, picker_status in [
        ("None", None, None, "0"),
        ("", None, None, "130"),
        ("GPT Personal", "", "openai-codex/gpt-6.1-sol", "0"),
        ("Claude Personal", str(Path.home() / ".claude"), "claude-code/default", "0"),
        ("Claude VO2", str(Path.home() / ".claude-vo2"), "claude-code/default", "0"),
    ]:
        call = root / "call"
        call.unlink(missing_ok=True)
        result = subprocess.run(
            ["fish", "--no-config", str(runner)],
            env=dict(env, PI_TEST_SELECTION=selection, PI_TEST_PICKER_STATUS=picker_status),
            capture_output=True, text=True,
        )
        assert not result.stdout and not result.stderr, result
        assert (root / "menu").read_text().splitlines() == [
            "None", "GPT Personal", "Claude Personal", "Claude VO2"
        ]
        assert "--no-sort" in (root / "picker-args").read_text().splitlines()
        if model is None:
            assert result.returncode == 0 and not call.exists(), selection
        else:
            assert result.returncode == 7, selection
            assert call.read_text().splitlines() == [config_dir, "--model", model, "--name", "two words"], selection

print("PASS: 5 Pi picker checks (stubbed commands only)")
