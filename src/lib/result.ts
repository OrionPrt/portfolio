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

/** The data, or a fallback when the read failed: for pages that degrade instead of failing. */
export function unwrapOr<T, E>(result: Result<T, E>, fallback: T): T {
  return result.ok ? result.data : fallback;
}

type DataOf<T extends readonly Result<unknown>[]> = {
  readonly [K in keyof T]: T[K] extends Result<infer U> ? U : never;
};

/** Every read's data, in order, or the first failure: for a view built from several reads. */
export function all<const T extends readonly Result<unknown>[]>(
  results: T,
): Result<DataOf<T>> {
  const failed = results.find((result): result is Err<AppError> => !result.ok);
  if (failed !== undefined) {
    return failed;
  }
  // None failed: every one holds its data.
  return ok(results.map((result) => (result as Ok<unknown>).data) as DataOf<T>);
}
