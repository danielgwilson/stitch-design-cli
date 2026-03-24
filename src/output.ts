import { StitchError } from "@google/stitch-sdk";

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export type CliError = {
  code: string;
  message: string;
  retryable: boolean;
  detail?: string;
  suggestion?: string;
};

const RETRYABLE_CODES = new Set(["RATE_LIMITED", "NETWORK_ERROR"]);

export function toErrorCode(error: unknown): string {
  if (error instanceof StitchError) return error.code;

  const code = isObject(error) && typeof error.code === "string" ? error.code : "";
  if (code) return code;

  const message = isObject(error) && typeof error.message === "string" ? error.message : "";
  if (message.toLowerCase().includes("timed out")) return "NETWORK_ERROR";

  return "UNKNOWN_ERROR";
}

export function isRetryable(error: unknown): boolean {
  if (error instanceof StitchError) return error.recoverable;
  return RETRYABLE_CODES.has(toErrorCode(error));
}

export function makeError(error: unknown, { code, message }: { code?: string; message?: string } = {}): CliError {
  const explicitCode = isObject(error) && typeof error.code === "string" ? error.code : "";
  const explicitMessage = isObject(error) && typeof error.message === "string" ? error.message : "";
  const stitchError =
    error instanceof StitchError
      ? error
      : (() => {
          try {
            return StitchError.fromUnknown(error);
          } catch {
            return null;
          }
        })();

  const resolvedCode = code || explicitCode || stitchError?.code || toErrorCode(error);
  const resolvedMessage = message || explicitMessage || stitchError?.message || "Request failed";

  const result: CliError = {
    code: resolvedCode,
    message: resolvedMessage,
    retryable: stitchError ? stitchError.recoverable : isRetryable(error),
  };

  if (stitchError?.suggestion) result.suggestion = stitchError.suggestion;
  if (result.suggestion && result.suggestion !== result.message) result.detail = result.suggestion;

  return result;
}

export type OkEnvelope<T> = { ok: true; data: T; meta?: Record<string, unknown> };
export type FailEnvelope = { ok: false; error: CliError; meta?: Record<string, unknown> };

export function ok<T>(data: T, meta?: Record<string, unknown>): OkEnvelope<T> {
  return meta ? { ok: true, data, meta } : { ok: true, data };
}

export function fail(error: CliError, meta?: Record<string, unknown>): FailEnvelope {
  return meta ? { ok: false, error, meta } : { ok: false, error };
}

export function printJson(value: unknown): void {
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(value, null, 2));
}

export function exitCodeFor(code: string): number {
  return code === "AUTH_MISSING" || code === "VALIDATION_ERROR" ? 2 : 1;
}
