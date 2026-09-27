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

  constructor(message = "Existe uma reserva incompatível com o período informado.") {
    super(message);
    this.name = "ReservationConflictError";
  }
}

export class InvalidReservationStateError extends Error {
  readonly code = "RESERVATION_INVALID_STATE";

  constructor(message = "A reserva não está em um estado que permita esta operação.") {
    super(message);
    this.name = "InvalidReservationStateError";
  }
}

export class SpaceUnavailableError extends Error {
  readonly code = "SPACE_UNAVAILABLE";

  constructor(message = "O lote não está disponível para o período solicitado.") {
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
