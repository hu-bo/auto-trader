export type ApiSuccess<T> = {
  message: string;
  data: T;
  code: number;
};

export type ApiFailure = {
  code: number;
  message: string;
  data?: unknown;
};

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export function apiOk<T>(data: T, message = 'OK'): ApiSuccess<T> {
  return {  message, data, code: 0 };
}

export function apiFail(message: string, data?: unknown, code = 500): ApiFailure {
  return data === undefined ? { code, message } : { code, message, data };
}

