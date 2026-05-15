from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[3]
BACKEND_SRC = REPO_ROOT / "backend" / "src"


def test_generic_services_package_was_removed():
    assert not (BACKEND_SRC / "services").exists()


def test_experiment_service_modules_live_under_experiments():
    expected_modules = [
        BACKEND_SRC / "experiments" / "application" / "execution_service.py",
        BACKEND_SRC / "experiments" / "application" / "experiment_service.py",
        BACKEND_SRC / "experiments" / "runtime" / "active_runs.py",
        BACKEND_SRC / "experiments" / "runtime" / "model_workers.py",
        BACKEND_SRC / "experiments" / "persistence" / "experiment_repository.py",
        BACKEND_SRC / "experiments" / "diagnostics" / "diagnostics_backfill.py",
    ]

    for module_path in expected_modules:
        assert module_path.exists(), f"Expected module is missing: {module_path}"


def test_backend_code_does_not_import_removed_services_package():
    checked_roots = [REPO_ROOT / "backend" / "src", REPO_ROOT / "backend" / "tests"]
    offenders = []

    for root in checked_roots:
        for path in root.rglob("*.py"):
            text = path.read_text(encoding="utf-8")
            if "src" + ".services" in text:
                offenders.append(str(path.relative_to(REPO_ROOT)))

    assert offenders == []
