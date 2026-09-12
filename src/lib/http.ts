import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AIError } from "./ai";

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status });

export function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** Wraps a handler so thrown validation and provider errors become JSON responses. */
export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response> | Response) {
  return async (...args: A) => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof ZodError) return fail(e.issues[0]?.message ?? "Invalid input", 400);
      if (e instanceof AIError) return fail(e.message, e.status);
      console.error(e);
      return fail(e instanceof Error ? e.message : "Something went wrong", 500);
    }
  };
}
