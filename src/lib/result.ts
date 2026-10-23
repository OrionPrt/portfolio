/**
 * Expected failures (not found, validation, unavailable service…) are returned
 * as values instead of thrown, so callers must handle them explicitly.
 * Exceptions stay reserved for the unexpected.
 */
export interface AppError {
  readonly code: string;
  readonly message: string;
}

export interface Ok<T> {
  readonly ok: true;
  readonly data: T;
}

export interface Err<E> {
  readonly ok: false;
  readonly error: E;
}

export type Result<T, E = AppError> = Ok<T> | Err<E>;

export function ok<T>(data: T): Ok<T> {
  return { ok: true, data };
}

export function err<E = AppError>(error: E): Err<E> {
  return { ok: false, error };
}

export function map<T, U, E>(
  result: Result<T, E>,
  transform: (data: T) => U,
): Result<U, E> {
  return result.ok ? ok(transform(result.data)) : result;
}
