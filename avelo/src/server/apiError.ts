/**
 * Consistent ApiError shape and status codes used by every API route.
 */
import { NextResponse } from "next/server";
import type { ValidationError } from "@/domain/types";

export type ApiErrorCode =
  | "VALIDATION_FAILED"
  | "STALE_ESTIMATE"
  | "OUT_OF_BOUNDS"
  | "NOT_FOUND"
  | "DUPLICATE_REQUEST"
  | "INVALID_STATE_TRANSITION"
  | "INVALID_EXTRACTION"
  | "UNEXPECTED_ERROR";

export function apiError(
  status: number,
  code: ApiErrorCode,
  message: string,
  details?: ValidationError[] | unknown,
) {
  return NextResponse.json({ error: { code, message, details } }, { status });
}
