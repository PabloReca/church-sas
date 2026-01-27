// =============================================================================
// Error codes - structured error identifiers
// =============================================================================

export const ErrorCode = {
  // Validation
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_INPUT: 'INVALID_INPUT',

  // Auth
  NOT_AUTHENTICATED: 'NOT_AUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  INVALID_TOKEN: 'INVALID_TOKEN',

  // Resources
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  CONFLICT: 'CONFLICT',

  // DB constraints
  UNIQUE_VIOLATION: 'UNIQUE_VIOLATION',
  FOREIGN_KEY_VIOLATION: 'FOREIGN_KEY_VIOLATION',

  // Server
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const

export type ErrorCode = typeof ErrorCode[keyof typeof ErrorCode]

// =============================================================================
// HttpError type
// =============================================================================

export type HttpError = Error & {
  status: number
  code: ErrorCode
  details?: unknown
}

export const httpError = (
  status: number,
  message: string,
  code: ErrorCode,
  details?: unknown
): HttpError => {
  const error = new Error(message) as HttpError
  error.status = status
  error.code = code
  if (details !== undefined) {
    error.details = details
  }
  return error
}

export const isHttpError = (error: unknown): error is HttpError =>
  error instanceof Error && typeof (error as HttpError).status === 'number'

// =============================================================================
// Error factories
// =============================================================================

export const badRequest = (message: string, details?: unknown) =>
  httpError(400, message, ErrorCode.INVALID_INPUT, details)

export const unauthorized = (message = 'Not authenticated', details?: unknown) =>
  httpError(401, message, ErrorCode.NOT_AUTHENTICATED, details)

export const forbidden = (message = 'Forbidden', details?: unknown) =>
  httpError(403, message, ErrorCode.FORBIDDEN, details)

export const notFound = (message: string, details?: unknown) =>
  httpError(404, message, ErrorCode.NOT_FOUND, details)

export const conflict = (message: string, details?: unknown) =>
  httpError(409, message, ErrorCode.CONFLICT, details)

export const alreadyExists = (message: string, details?: unknown) =>
  httpError(409, message, ErrorCode.ALREADY_EXISTS, details)

export const internalError = (message = 'Internal server error', details?: unknown) =>
  httpError(500, message, ErrorCode.INTERNAL_ERROR, details)

// =============================================================================
// DB error wrapping
// =============================================================================

type PostgresError = Error & {
  code?: string
  constraint?: string
  detail?: string
}

const PG_ERROR_CODES = {
  UNIQUE_VIOLATION: '23505',
  FOREIGN_KEY_VIOLATION: '23503',
  NOT_NULL_VIOLATION: '23502',
  CHECK_VIOLATION: '23514',
} as const

/**
 * Wraps a database error into a user-friendly HttpError.
 * Call this in catch blocks when executing DB operations.
 */
export function wrapDbError(error: unknown, context?: string): HttpError {
  const pgError = error as PostgresError
  const prefix = context ? `${context}: ` : ''

  if (pgError.code === PG_ERROR_CODES.UNIQUE_VIOLATION) {
    const field = extractFieldFromConstraint(pgError.constraint)
    return httpError(
      409,
      `${prefix}${field ? `${field} already exists` : 'Record already exists'}`,
      ErrorCode.UNIQUE_VIOLATION,
      { constraint: pgError.constraint }
    )
  }

  if (pgError.code === PG_ERROR_CODES.FOREIGN_KEY_VIOLATION) {
    return httpError(
      400,
      `${prefix}Referenced record does not exist`,
      ErrorCode.FOREIGN_KEY_VIOLATION,
      { constraint: pgError.constraint }
    )
  }

  if (pgError.code === PG_ERROR_CODES.NOT_NULL_VIOLATION) {
    return httpError(
      400,
      `${prefix}Required field is missing`,
      ErrorCode.INVALID_INPUT,
      { constraint: pgError.constraint }
    )
  }

  if (pgError.code === PG_ERROR_CODES.CHECK_VIOLATION) {
    return httpError(
      400,
      `${prefix}Value violates constraint`,
      ErrorCode.INVALID_INPUT,
      { constraint: pgError.constraint }
    )
  }

  // Unknown DB error - return as internal error
  return internalError(prefix + 'Database error')
}

/**
 * Extracts a readable field name from a constraint name.
 * e.g., "emails_email_unique" → "Email"
 */
function extractFieldFromConstraint(constraint?: string): string | null {
  if (!constraint) return null

  // Common patterns: table_field_unique, table_field_key, etc.
  const parts = constraint.split('_')
  const field = parts[1]
  if (field) {
    return field.charAt(0).toUpperCase() + field.slice(1)
  }
  return null
}

/**
 * Helper to check if an error is a Postgres error
 */
export function isDbError(error: unknown): error is PostgresError {
  return error instanceof Error && typeof (error as PostgresError).code === 'string'
}

// =============================================================================
// Error handler for Elysia
// =============================================================================

type ErrorHandlerContext = {
  error: unknown
  code: string | number
  set: { status?: number | string }
}

export const handleHttpError = ({ error, code, set }: ErrorHandlerContext) => {
  // Elysia validation errors
  if (code === 'VALIDATION') {
    set.status = 400
    return {
      error: 'Validation error',
      code: ErrorCode.VALIDATION_ERROR,
      details: error instanceof Error ? error.message : 'Unknown error',
    }
  }

  // Our custom HttpError type
  if (isHttpError(error)) {
    set.status = error.status
    const response: { error: string; code: ErrorCode; details?: unknown } = {
      error: error.message,
      code: error.code,
    }
    if (error.details !== undefined) {
      response.details = error.details
    }
    return response
  }

  // Unknown errors - return 500
  set.status = 500
  return { error: 'Internal server error', code: ErrorCode.INTERNAL_ERROR }
}
