from __future__ import annotations

from typing import Generic, TypeVar

from pydantic import BaseModel, Field

T = TypeVar("T")


class ApiResponse(BaseModel, Generic[T]):
    """统一的 API 响应格式"""

    code: int = Field(default=0, description="响应状态码，0 表示成功")
    message: str = Field(default="success", description="响应消息")
    data: T | None = Field(default=None, description="响应数据")

    @classmethod
    def success(cls, data: T | None = None, message: str = "success") -> ApiResponse[T]:
        """创建成功响应"""
        return cls(code=0, message=message, data=data)

    @classmethod
    def error(cls, code: int, message: str, data: T | None = None) -> ApiResponse[T]:
        """创建错误响应"""
        return cls(code=code, message=message, data=data)
