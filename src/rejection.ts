export type Rejection = { status: 400 | 404 | 409; error: string }

export function reject(status: 400 | 404 | 409, error: string): Rejection {
  return { status, error }
}

export function isRejection(value: unknown): value is Rejection {
  return typeof value === 'object' && value !== null && 'status' in value && 'error' in value
}
