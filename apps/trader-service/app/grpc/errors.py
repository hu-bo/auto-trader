from __future__ import annotations


class GrpcClientError(RuntimeError):
    pass


class GrpcDependencyMissingError(GrpcClientError):
    pass


class GrpcProtoNotGeneratedError(GrpcClientError):
    pass


class GrpcRequestError(GrpcClientError):
    pass

