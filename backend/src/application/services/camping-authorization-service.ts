import type {
  CampingAccessReader,
  CampingRole,
} from "../ports/camping-access-reader.js";

import { AccessDeniedError } from "../errors/authorization-errors.js";

export class CampingAuthorizationService {
  constructor(private readonly access: CampingAccessReader) {}

  private async requireRole(
    userId: string,
    campingId: string,
    allowedRoles: readonly CampingRole[],
  ): Promise<void> {
    const role = await this.access.findRole(userId, campingId);

    if (!role || !allowedRoles.includes(role)) {
      throw new AccessDeniedError();
    }
  }

  async requireManageCamping(userId: string, campingId: string): Promise<void> {
    await this.requireRole(userId, campingId, ["OWNER", "MANAGER"]);
  }

  async requireManageMembers(userId: string, campingId: string): Promise<void> {
    await this.requireRole(userId, campingId, ["OWNER"]);
  }

  async requirePlatformModerator(userId: string): Promise<void> {
    const authorized = await this.access.isPlatformModerator(userId);

    if (!authorized) {
      throw new AccessDeniedError();
    }
  }
}
