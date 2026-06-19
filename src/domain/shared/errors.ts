export type DomainErrorCode =
  | "NOT_FOUND"
  | "VALIDATION"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "CONFLICT"
  | "INTERNAL";

export class DomainError extends Error {
  readonly code: DomainErrorCode;

  constructor(code: DomainErrorCode, message: string) {
    super(message);
    this.name = "DomainError";
    this.code = code;
  }

  static notFound(resource: string): DomainError {
    return new DomainError("NOT_FOUND", `${resource} not found`);
  }

  static validation(message: string): DomainError {
    return new DomainError("VALIDATION", message);
  }

  static unauthorized(message = "Unauthorized"): DomainError {
    return new DomainError("UNAUTHORIZED", message);
  }

  static forbidden(message = "Forbidden"): DomainError {
    return new DomainError("FORBIDDEN", message);
  }
}
