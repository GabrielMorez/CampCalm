import type { Space } from "../entities/space.js";
import type { Period } from "../value-objects/period.js";

export interface SpaceRepository {
  findAvailable(campingId: string, period: Period): Promise<Space[]>;
  findById(id: string): Promise<Space | null>;
  save(space: Space): Promise<void>;
}
