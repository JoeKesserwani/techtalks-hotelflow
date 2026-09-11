/**
 * Throw this from inside any route handler's try block for expected,
 * business-logic errors (not found, conflict, validation, forbidden, etc.).
 * Anything NOT thrown as an ApiError is treated as an unexpected server error.
 */
export class ApiError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'ApiError';
  }
}

/**
 * Call this from every route's catch block:
 *   } catch (err) {
 *     return handleRouteError(err);
 *   }
 */
export function handleRouteError(err: unknown): Response {
  if (err instanceof ApiError) {
    return Response.json({ error: err.message }, { status: err.statusCode });
  }

  // Anything unexpected (DB connection drop, bad JSON, etc.) — never leak internals to the client.
  console.error('[UNHANDLED API ERROR]', err);
  return Response.json({ error: 'Internal server error' }, { status: 500 });
}
