import type { UserRepository } from "../../domain/repositories/user-repository.js";

import { InvalidCredentialsError } from "../../domain/errors/domain-errors.js";

import type { PasswordHasher } from "../ports/password-hasher.js";

export interface AuthenticateUserInput {
  email: string;
  password: string;
}

export interface AuthenticateUserOutput {
  userId: string;
  email: string;
}

export class AuthenticateUserUseCase {
  constructor(
    private readonly users: UserRepository,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async execute(
    input: AuthenticateUserInput,
  ): Promise<AuthenticateUserOutput> {
    const email = input.email.trim().toLowerCase();

    const user = await this.users.findByEmail(email);

    if (!user) {
      throw new InvalidCredentialsError();
    }

    const passwordValid = await this.passwordHasher.verify(
      input.password,
      user.passwordHash,
    );

    if (!passwordValid || !user.active) {
      throw new InvalidCredentialsError();
    }

    return {
      userId: user.id,
      email: user.email,
    };
  }
}