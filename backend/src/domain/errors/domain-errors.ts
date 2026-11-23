export class DomainValidationError extends Error {
  readonly code: string;

  constructor(code: string, message?: string) {
    super(message ?? code);
    this.name = "DomainValidationError";
    this.code = code;
  }
}

export class ReservationConflictError extends Error {
  readonly code = "RESERVATION_CONFLICT";

  constructor(
    message = "Existe uma reserva incompatível com o período informado.",
  ) {
    super(message);
    this.name = "ReservationConflictError";
  }
}

export class InvalidReservationStateError extends Error {
  readonly code = "RESERVATION_INVALID_STATE";

  constructor(
    message = "A reserva não está em um estado que permita esta operação.",
  ) {
    super(message);
    this.name = "InvalidReservationStateError";
  }
}

export class SpaceUnavailableError extends Error {
  readonly code = "SPACE_UNAVAILABLE";

  constructor(
    message = "O lote não está disponível para o período solicitado.",
  ) {
    super(message);
    this.name = "SpaceUnavailableError";
  }
}

export class CampingInactiveError extends Error {
  readonly code = "CAMPING_INACTIVE";

  constructor(message = "O camping está inativo e não aceita novas reservas.") {
    super(message);
    this.name = "CampingInactiveError";
  }
}

export class CamperEmailAlreadyExistsError extends Error {
  readonly code = "CAMPER_EMAIL_ALREADY_EXISTS";

  constructor() {
    super("Já existe um campista cadastrado com este e-mail.");
    this.name = "CamperEmailAlreadyExistsError";
  }
}

export class CampingNotPublishedError extends Error {
  readonly code = "CAMPING_NOT_PUBLISHED";

  constructor() {
    super("O camping ainda não está disponível para reservas.");
    this.name = "CampingNotPublishedError";
  }
}

export class AccountEmailAlreadyExistsError extends Error {
  readonly code = "ACCOUNT_EMAIL_ALREADY_EXISTS";

  constructor() {
    super("Este e-mail já está cadastrado.");
    this.name = "AccountEmailAlreadyExistsError";
  }
}

export class InvalidCredentialsError extends Error {
  readonly code = "INVALID_CREDENTIALS";

  constructor() {
    super("E-mail ou senha inválidos.");
    this.name = "InvalidCredentialsError";
  }
}

export class InvalidRefreshTokenError extends Error {
  readonly code = "INVALID_REFRESH_TOKEN";

  constructor() {
    super("Sessão inválida ou expirada.");
    this.name = "InvalidRefreshTokenError";
  }
}