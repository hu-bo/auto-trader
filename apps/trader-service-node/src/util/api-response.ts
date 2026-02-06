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

export function apiFail(message: string, data?: unknown): ApiFailure {
  return data === undefined ? { code: 500, message } : { code: 500, message, data };
}

