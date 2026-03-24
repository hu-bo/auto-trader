"""Strategy Engine application package."""

from __future__ import annotations

import os

from dotenv import load_dotenv


# Ensure logger sees env vars when running `uvicorn app.main:app` locally.
load_dotenv()

if "NODE_ENV" not in os.environ and "APP_ENV" in os.environ:
    os.environ["NODE_ENV"] = os.environ["APP_ENV"]
