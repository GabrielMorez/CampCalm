export type CampingRole = "OWNER" | "MANAGER";

export interface CampingAccessReader {
  findRole(userId: string, campingId: string): Promise<CampingRole | null>;

  isPlatformModerator(userId: string): Promise<boolean>;
}
