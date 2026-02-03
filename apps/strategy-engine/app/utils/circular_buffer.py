from __future__ import annotations

from collections import deque
from typing import Deque, Generic, Iterable, Iterator, TypeVar

T = TypeVar("T")


class CircularBuffer(Generic[T]):
    def __init__(self, capacity: int) -> None:
        if capacity <= 0:
            raise ValueError("capacity must be > 0")
        self._data: Deque[T] = deque(maxlen=capacity)

    def append(self, item: T) -> None:
        self._data.append(item)

    def replace_last(self, item: T) -> None:
        if self._data:
            self._data.pop()
        self._data.append(item)

    def clear(self) -> None:
        self._data.clear()

    def to_list(self) -> list[T]:
        return list(self._data)

    def __len__(self) -> int:
        return len(self._data)

    def __iter__(self) -> Iterator[T]:
        return iter(self._data)

    def extend(self, items: Iterable[T]) -> None:
        for item in items:
            self.append(item)

