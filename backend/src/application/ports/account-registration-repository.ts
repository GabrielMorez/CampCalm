import type { User } from "../../domain/entities/user.js";
import type { Camper } from "../../domain/entities/camper.js";

export interface AccountRegistrationRepository {
  save(user: User, camper: Camper): Promise<void>;
}