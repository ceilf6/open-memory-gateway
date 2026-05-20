export class MemoryError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = "MemoryError";
  }
}

export class MemoryNotFoundError extends MemoryError {
  constructor(id: string) {
    super(`Memory not found: ${id}`, "MEMORY_NOT_FOUND");
  }
}

export class InvalidMemoryTransitionError extends MemoryError {
  constructor(from: string, to: string) {
    super(`Invalid memory status transition: ${from} -> ${to}`, "INVALID_MEMORY_TRANSITION");
  }
}
