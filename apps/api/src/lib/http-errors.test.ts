import { describe, expect, test } from 'vitest'
import {
  badRequest,
  ErrorCode,
  forbidden,
  handleHttpError,
  httpError,
  internalError,
  isDbError,
  isHttpError,
  unauthorized,
  wrapDbError,
} from './http-errors'

describe('http errors', () => {
  test('httpError sets status, code and details', () => {
    const error = httpError(418, 'Teapot', ErrorCode.INTERNAL_ERROR, { hint: 'short and stout' })
    expect(isHttpError(error)).toBe(true)
    expect(error.status).toBe(418)
    expect(error.code).toBe(ErrorCode.INTERNAL_ERROR)
    expect(error.details).toEqual({ hint: 'short and stout' })
  })

  test('internalError builds a 500 error with INTERNAL_ERROR code', () => {
    const error = internalError()
    expect(isHttpError(error)).toBe(true)
    expect(error.status).toBe(500)
    expect(error.code).toBe(ErrorCode.INTERNAL_ERROR)
    expect(error.message).toBe('Internal server error')
  })

  test('handleHttpError returns validation errors with code', () => {
    const set: { status?: number | string } = {}
    const result = handleHttpError({
      error: new Error('Missing field'),
      code: 'VALIDATION',
      set,
    })

    expect(set.status).toBe(400)
    expect(result).toEqual({
      error: 'Validation error',
      code: ErrorCode.VALIDATION_ERROR,
      details: 'Missing field',
    })
  })

  test('handleHttpError returns details and code for http errors', () => {
    const set: { status?: number | string } = {}
    const result = handleHttpError({
      error: badRequest('Bad request', { field: 'name' }),
      code: 'OTHER',
      set,
    })

    expect(set.status).toBe(400)
    expect(result).toEqual({
      error: 'Bad request',
      code: ErrorCode.INVALID_INPUT,
      details: { field: 'name' },
    })
  })

  test('handleHttpError handles auth and forbidden errors', () => {
    const authSet: { status?: number | string } = {}
    const authResult = handleHttpError({
      error: unauthorized(),
      code: 'OTHER',
      set: authSet,
    })
    expect(authSet.status).toBe(401)
    expect(authResult).toEqual({
      error: 'Not authenticated',
      code: ErrorCode.NOT_AUTHENTICATED,
    })

    const forbiddenSet: { status?: number | string } = {}
    const forbiddenResult = handleHttpError({
      error: forbidden('Access denied to this tenant'),
      code: 'OTHER',
      set: forbiddenSet,
    })
    expect(forbiddenSet.status).toBe(403)
    expect(forbiddenResult).toEqual({
      error: 'Access denied to this tenant',
      code: ErrorCode.FORBIDDEN,
    })
  })

  test('handleHttpError falls back to 500 for unknown errors', () => {
    const set: { status?: number | string } = {}
    const result = handleHttpError({
      error: 'boom',
      code: 'OTHER',
      set,
    })

    expect(set.status).toBe(500)
    expect(result).toEqual({
      error: 'Internal server error',
      code: ErrorCode.INTERNAL_ERROR,
    })
  })
})

describe('wrapDbError', () => {
  test('wraps unique violation into 409 conflict', () => {
    const pgError = Object.assign(new Error('duplicate key'), {
      code: '23505',
      constraint: 'emails_email_unique',
    })

    const error = wrapDbError(pgError)
    expect(error.status).toBe(409)
    expect(error.code).toBe(ErrorCode.UNIQUE_VIOLATION)
    expect(error.message).toBe('Email already exists')
    expect(error.details).toEqual({ constraint: 'emails_email_unique' })
  })

  test('wraps foreign key violation into 400 bad request', () => {
    const pgError = Object.assign(new Error('violates foreign key'), {
      code: '23503',
      constraint: 'tenant_helpers_tenant_id_fkey',
    })

    const error = wrapDbError(pgError)
    expect(error.status).toBe(400)
    expect(error.code).toBe(ErrorCode.FOREIGN_KEY_VIOLATION)
    expect(error.message).toBe('Referenced record does not exist')
  })

  test('wraps not null violation into 400 bad request', () => {
    const pgError = Object.assign(new Error('null value'), {
      code: '23502',
      constraint: 'people_name_not_null',
    })

    const error = wrapDbError(pgError)
    expect(error.status).toBe(400)
    expect(error.code).toBe(ErrorCode.INVALID_INPUT)
    expect(error.message).toBe('Required field is missing')
  })

  test('wraps check violation into 400 bad request', () => {
    const pgError = Object.assign(new Error('check constraint'), {
      code: '23514',
      constraint: 'people_age_check',
    })

    const error = wrapDbError(pgError)
    expect(error.status).toBe(400)
    expect(error.code).toBe(ErrorCode.INVALID_INPUT)
    expect(error.message).toBe('Value violates constraint')
  })

  test('wraps unknown db error into 500 internal error', () => {
    const pgError = Object.assign(new Error('unknown error'), {
      code: '99999',
    })

    const error = wrapDbError(pgError)
    expect(error.status).toBe(500)
    expect(error.code).toBe(ErrorCode.INTERNAL_ERROR)
  })

  test('includes context prefix when provided', () => {
    const pgError = Object.assign(new Error('duplicate key'), {
      code: '23505',
      constraint: 'emails_email_unique',
    })

    const error = wrapDbError(pgError, 'Creating user')
    expect(error.message).toBe('Creating user: Email already exists')
  })
})

describe('isDbError', () => {
  test('returns true for postgres errors', () => {
    const pgError = Object.assign(new Error('db error'), { code: '23505' })
    expect(isDbError(pgError)).toBe(true)
  })

  test('returns false for regular errors', () => {
    const error = new Error('regular error')
    expect(isDbError(error)).toBe(false)
  })

  test('returns false for non-errors', () => {
    expect(isDbError('string')).toBe(false)
    expect(isDbError(null)).toBe(false)
  })
})
