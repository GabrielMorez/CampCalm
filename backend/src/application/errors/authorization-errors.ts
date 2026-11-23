export class AccessDeniedError extends Error {
  readonly code = "FORBIDDEN";

  constructor() {
    super("Você não possui permissão para esta operação.");
    this.name = "AccessDeniedError";
  }
}