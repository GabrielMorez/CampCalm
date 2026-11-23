import { randomUUID } from "node:crypto";

import { User } from "../../domain/entities/user.js";
import { Camper } from "../../domain/entities/camper.js";

import { DomainValidationError } from "../../domain/errors/domain-errors.js";

import type { PasswordHasher } from "../ports/password-hasher.js";
import type { AccountRegistrationRepository } from "../ports/account-registration-repository.js";

export interface RegisterAccountInput {
  name: string;
  email: string;
  phone: string;
  password: string;
}

export interface RegisterAccountOutput {
  userId: string;
  camperId: string;
  email: string;
}

export class RegisterAccountUseCase {
  constructor(
    private readonly accounts: AccountRegistrationRepository,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async execute(input: RegisterAccountInput): Promise<RegisterAccountOutput> {
    if (input.password.length < 12 || input.password.length > 128) {
      throw new DomainValidationError(
        "USER_INVALID_PASSWORD",
        "A senha deve conter entre 12 e 128 caracteres.",
      );
    }

    const email = input.email.trim().toLowerCase();

    const camper = new Camper({
      id: randomUUID(),
      name: input.name,
      email,
      phone: input.phone,
    });

    const passwordHash = await this.passwordHasher.hash(input.password);

    const user = new User({
      id: randomUUID(),
      email,
      passwordHash,
    });

    await this.accounts.save(user, camper);

    return {
      userId: user.id,
      camperId: camper.id,
      email: user.email,
    };
  }
}
