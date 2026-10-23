#!/usr/bin/env python3
"""Isolated comparison; never contacts Ollama or production databases."""
import io
import json
import os
from pathlib import Path
import shutil
import subprocess
import tarfile
import tempfile

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[2]
OUTPUT = Path(tempfile.mkdtemp(prefix="anilist-benchmark-"))
for label, ref in (("before", "8c89829"), ("previous", "6a98bb2"), ("after", None)):
    checkout = OUTPUT / label
    project = checkout / "backend-spring"
    if ref:
        archive = subprocess.check_output(["git", "archive", ref, "backend-spring"], cwd=REPO)
        with tarfile.open(fileobj=io.BytesIO(archive)) as tar:
            tar.extractall(checkout, filter="data")
    else:
        shutil.copytree(REPO / "backend-spring", project,
                        ignore=shutil.ignore_patterns("build", ".gradle", "docs"))
    sync = project / "src/test/java/com/anilist/server/anime/sync"
    sync.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(HERE / "LocalPerformanceBenchmark.java", sync / "LocalPerformanceBenchmark.java")
    command = ["bash", "gradlew", "test", "--tests", "*LocalPerformanceBenchmark", "--no-daemon", "--max-workers=2"]
    if label == "after":
        localization = project / "src/test/java/com/anilist/server/anime/localization"
        localization.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(HERE / "FieldLedgerBenchmark.java", localization / "FieldLedgerBenchmark.java")
        command += ["--tests", "*FieldLedgerBenchmark"]
    settings = dict(os.environ, BENCH_LABEL=label, BENCH_OUTPUT=str(OUTPUT / (label + ".json")),
                    LEDGER_OUTPUT=str(OUTPUT / "ledger.json"))
    with (OUTPUT / (label + ".log")).open("w") as log:
        subprocess.run(command, cwd=project, env=settings, stdout=log, stderr=subprocess.STDOUT, check=True)
    print(label, json.loads((OUTPUT / (label + ".json")).read_text()), flush=True)
print("Artifacts:", OUTPUT)
