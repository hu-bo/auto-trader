from __future__ import annotations

import base64
import os
from dataclasses import dataclass

from cryptography.hazmat.primitives.ciphers.aead import AESGCM


def _decode_key(key: str) -> bytes:
    try:
        raw = base64.b64decode(key, validate=True)
        if len(raw) == 32:
            return raw
    except Exception:
        pass

    raw = key.encode("utf-8")
    if len(raw) != 32:
        raise ValueError("ENCRYPTION_KEY must be 32 bytes (raw) or base64-encoded 32 bytes")
    return raw


@dataclass(frozen=True)
class AesGcmEncryptor:
    key: bytes

    @classmethod
    def from_key(cls, key: str) -> "AesGcmEncryptor":
        return cls(key=_decode_key(key))

    def encrypt(self, plaintext: str) -> str:
        aesgcm = AESGCM(self.key)
        nonce = os.urandom(12)
        ciphertext = aesgcm.encrypt(nonce, plaintext.encode("utf-8"), None)
        return base64.b64encode(nonce + ciphertext).decode("utf-8")

    def decrypt(self, token: str) -> str:
        data = base64.b64decode(token)
        nonce, ciphertext = data[:12], data[12:]
        aesgcm = AESGCM(self.key)
        plaintext = aesgcm.decrypt(nonce, ciphertext, None)
        return plaintext.decode("utf-8")
