"""Small logging bootstrap for the backend runtime."""

import logging
import sys

from loguru import logger

from src.config.settings import settings

LOGURU_CONSOLE_FORMAT = (
    "<green>{time:YYYY-MM-DD HH:mm:ss.SSS}</green> | "
    "<level>{level: <8}</level> | "
    "<cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - "
    "<level>{message}</level>"
)


class InterceptHandler(logging.Handler):
    """Redirect standard logging records to Loguru."""

    def emit(self, record: logging.LogRecord) -> None:
        try:
            level: str | int = logger.level(record.levelname).name
        except Exception:
            level = record.levelno

        frame = logging.currentframe()
        depth = 2

        while frame and frame.f_code.co_filename == logging.__file__:
            frame = frame.f_back
            depth += 1

        logger.opt(depth=depth, exception=record.exc_info).log(
            level,
            record.getMessage(),
        )


def _configure_stdlib_logging_intercept() -> None:
    """Route stdlib logging, uvicorn and third-party loggers into Loguru."""
    intercept_handler = InterceptHandler()

    logging.root.handlers = [intercept_handler]
    logging.root.setLevel(settings.log_level.upper())

    for logger_name in (
        "uvicorn",
        "uvicorn.error",
        "uvicorn.access",
        "fastapi",
        "optuna",
    ):
        std_logger = logging.getLogger(logger_name)
        std_logger.handlers = [intercept_handler]
        std_logger.propagate = False
        std_logger.setLevel(settings.log_level.upper())


def _configure_optuna_logging() -> None:
    """Make Optuna propagate through stdlib logging instead of using its own handler."""
    try:
        import optuna

        optuna.logging.disable_default_handler()
        optuna.logging.enable_propagation()
    except Exception:
        pass


def configure_logging():
    """Configure Loguru once for terminal + file logging."""
    if getattr(configure_logging, "_configured", False):
        return logger

    logger.remove()

    logger.add(
        sys.stderr,
        level=settings.log_level.upper(),
        colorize=True,
        format=LOGURU_CONSOLE_FORMAT,
        backtrace=False,
        diagnose=False,
    )

    if settings.log_to_file:
        settings.log_storage_dir.mkdir(parents=True, exist_ok=True)
        logger.add(
            settings.log_storage_dir / settings.log_file_name,
            level=settings.log_level.upper(),
            encoding="utf-8",
            colorize=False,
            format=(
                "{time:YYYY-MM-DD HH:mm:ss.SSS} | "
                "{level: <8} | "
                "{name}:{function}:{line} - {message}"
            ),
        )

    _configure_stdlib_logging_intercept()
    _configure_optuna_logging()

    configure_logging._configured = True
    return logger
