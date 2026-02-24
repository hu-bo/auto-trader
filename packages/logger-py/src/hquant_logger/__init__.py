"""High-performance structured logger for hquant services."""

from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Any

from loguru import logger as _loguru_logger

__all__ = ["create_logger", "Logger"]

NODE_ENV = os.getenv("NODE_ENV", "development")
IS_DEV = NODE_ENV != "production"
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
LOG_DIR = Path(os.getenv("LOG_DIR", "logs"))


class Logger:
    """Wrapper around loguru logger with consistent child() API."""

    def __init__(self, logger: Any, service: str, scope: str = "main") -> None:
        self._logger = logger
        self._service = service
        self._scope = scope

    def child(self, scope: str) -> Logger:
        """Create a child logger with a specific scope."""
        return Logger(
            self._logger.bind(scope=scope),
            self._service,
            scope,
        )

    def debug(self, message: str, **kwargs: Any) -> None:
        self._logger.debug(message, **kwargs)

    def info(self, message: str, **kwargs: Any) -> None:
        self._logger.info(message, **kwargs)

    def warning(self, message: str, **kwargs: Any) -> None:
        self._logger.warning(message, **kwargs)

    def error(self, message: str, **kwargs: Any) -> None:
        self._logger.error(message, **kwargs)

    def critical(self, message: str, **kwargs: Any) -> None:
        self._logger.critical(message, **kwargs)

    def exception(self, message: str, **kwargs: Any) -> None:
        """Log error with exception traceback."""
        self._logger.exception(message, **kwargs)

    def bind(self, **kwargs: Any) -> Logger:
        """Bind additional context to logger."""
        return Logger(self._logger.bind(**kwargs), self._service, self._scope)


def create_logger(service: str) -> Logger:
    """
    Create a service-level logger.

    Args:
        service: Service name (required)

    Returns:
        Logger instance with child() method for creating scoped loggers

    Environment Variables:
        NODE_ENV: 'development' | 'production' (default: 'development')
        LOG_LEVEL: DEBUG | INFO | WARNING | ERROR | CRITICAL (default: 'INFO')
        LOG_DIR: Log directory for production (default: 'logs')

    Example:
        >>> logger = create_logger('my-service')
        >>> logger.info('Service started')
        >>> db_logger = logger.child('database')
        >>> db_logger.info('Connected')
    """
    if not service:
        raise ValueError("service name is required for logger initialization")

    # Remove default handler
    _loguru_logger.remove()

    # Base context
    context = {
        "service": service,
        "env": NODE_ENV,
        "pid": os.getpid(),
        "scope": "main",
    }

    # Keys managed by the logger itself — excluded from kwarg output.
    _INTERNAL_KEYS = {"service", "env", "pid", "scope"}

    def _dev_format(record: dict) -> str:
        extra = record["extra"]
        # Collect user-supplied kwargs (exclude internal context)
        kv = {k: v for k, v in extra.items() if k not in _INTERNAL_KEYS}
        kv_str = " ".join(f"<blue>{k}</blue>=<yellow>{v}</yellow>" for k, v in kv.items())
        base = (
            "<green>{time:YYYY-MM-DD HH:mm:ss}</green> | "
            "<level>{level: <8}</level>|"
            "<cyan>{extra[service]}</cyan>:<cyan>{extra[scope]}</cyan> | "
            "<level>{message}</level>"
        )
        if kv_str:
            base += f" {kv_str}"
        return base + "\n"

    if IS_DEV:
        # Development: colorized console output
        _loguru_logger.add(
            sys.stderr,
            level=LOG_LEVEL,
            colorize=True,
            format=_dev_format,
        )
    else:
        # Production: rotating JSON log files
        LOG_DIR.mkdir(parents=True, exist_ok=True)
        _loguru_logger.add(
            LOG_DIR / "{time:YYYY-MM-DD}.log",
            level=LOG_LEVEL,
            rotation="00:00",
            retention="30 days",
            compression="zip",
            enqueue=True,
            serialize=True,
        )

    base_logger = _loguru_logger.bind(**context)
    return Logger(base_logger, service)
