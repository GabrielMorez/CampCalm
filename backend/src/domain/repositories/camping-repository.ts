import type { Camping } from "../entities/camping.js";

export interface CampingRepository {
  findNearby(latitude: number, longitude: number, radiusKm: number): Promise<Camping[]>;
  findById(id: string): Promise<Camping | null>;
  save(camping: Camping): Promise<void>;
}
