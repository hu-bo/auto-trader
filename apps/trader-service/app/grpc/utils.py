from __future__ import annotations

from collections.abc import Awaitable
from typing import Any

from google.protobuf.json_format import MessageToDict


def protobuf_to_dict(message: Any) -> dict:
    return MessageToDict(
        message,
        preserving_proto_field_name=True,
        including_default_value_fields=False,
        use_integers_for_enums=False,
    )


async def maybe_await(value: Any) -> Any:
    if isinstance(value, Awaitable):
        return await value
    return value

