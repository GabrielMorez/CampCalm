import { DomainValidationError } from "../errors/domain-errors.js";

export interface UserProps {
  id: string;
  email: string;
  passwordHash: string;
  active?: boolean;
}

export class User {
  readonly id: string;
  readonly email: string;
  readonly active: boolean;

  #passwordHash: string;

  constructor(props: UserProps) {
    const email = props.email.trim().toLowerCase();

    if (!email.includes("@")) {
      throw new DomainValidationError(
        "USER_INVALID_EMAIL",
        "O e-mail informado é inválido.",
      );
    }

    if (!props.passwordHash.trim()) {
      throw new DomainValidationError(
        "USER_INVALID_PASSWORD_HASH",
        "O hash da senha é obrigatório.",
      );
    }

    this.id = props.id;
    this.email = email;
    this.active = props.active ?? true;
    this.#passwordHash = props.passwordHash;
  }

  get passwordHash(): string {
    return this.#passwordHash;
  }
}
