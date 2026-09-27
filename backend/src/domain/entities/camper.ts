import { DomainValidationError } from "../errors/domain-errors.js";

export interface CamperProps {
  id: string;
  name: string;
  email: string;
  phone: string;
}

export class Camper {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly phone: string;

  constructor(props: CamperProps) {
    if (!props.name.trim()) {
      throw new DomainValidationError("CAMPER_INVALID_NAME", "O nome do campista é obrigatório.");
    }

    if (!props.email.includes("@")) {
      throw new DomainValidationError("CAMPER_INVALID_EMAIL", "O e-mail do campista é inválido.");
    }

    if (!props.phone.trim()) {
      throw new DomainValidationError("CAMPER_INVALID_PHONE", "O telefone do campista é obrigatório.");
    }

    this.id = props.id;
    this.name = props.name.trim();
    this.email = props.email.trim().toLowerCase();
    this.phone = props.phone.trim();
  }
}
