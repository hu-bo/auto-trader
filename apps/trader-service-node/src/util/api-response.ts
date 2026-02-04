export type ApiSuccess<T> = {
  success: true;
  message: string;
  data: T;
};

export type ApiFailure = {
  success: false;
  message: string;
  data?: unknown;
};

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export function apiOk<T>(data: T, message = 'OK'): ApiSuccess<T> {
  return { success: true, message, data };
}

export function apiFail(message: string, data?: unknown): ApiFailure {
  return data === undefined ? { success: false, message } : { success: false, message, data };
}

