from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# <repo>/backend/src/config/settings.py -> parents[3] points to the repository root.
PROJECT_ROOT = Path(__file__).resolve().parents[3]
BACKEND_ROOT = PROJECT_ROOT / "backend"


class Settings(BaseSettings):
    """Centralized runtime settings.

    This mirrors the movie project on purpose: keep configuration predictable,
    keep defaults close to the code, and avoid turning settings into runtime
    orchestration logic.
    """

    app_name: str = "Ockham AutoML"
    app_version: str = "0.1.0"

    api_host: str = "127.0.0.1"
    api_port: int = 8000

    log_level: str = "INFO"
    log_to_file: bool = True
    log_file_name: str = "ockham-backend.log"

    cors_origins: str = "http://localhost:5173,http://localhost:3000,http://localhost:8080"

    data_dir: Path = BACKEND_ROOT / "data"
    dataset_storage_dir: Path = BACKEND_ROOT / "storage" / "datasets"
    experiment_storage_dir: Path = BACKEND_ROOT / "storage" / "experiments"
    log_storage_dir: Path = BACKEND_ROOT / "storage" / "logs"
    sqlite_path: Path = BACKEND_ROOT / "data" / "ockham.db"

    enable_llm_ranking: bool = True
    ollama_base_url: str = "http://127.0.0.1:11434"
    ollama_model: str = "llama3.2:3b"
    ollama_timeout_seconds: int = 120
    ollama_temperature: float = 0.0
    ollama_max_retries: int = 1
    ollama_keep_alive: str = "10m"

    model_config = SettingsConfigDict(
        env_file=PROJECT_ROOT / ".env",
        env_file_encoding="utf-8",
        env_prefix="OCKHAM_",
        extra="ignore",
    )

    def resolve_runtime_dirs(self) -> tuple[Path, ...]:
        return (
            self.data_dir,
            self.dataset_storage_dir,
            self.experiment_storage_dir,
            self.log_storage_dir,
        )


settings = Settings()
