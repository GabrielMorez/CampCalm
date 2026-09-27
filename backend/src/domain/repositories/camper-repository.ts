import type { Camper } from "../entities/camper.js";

export interface CamperRepository {
  findById(id: string): Promise<Camper | null>;
  save(camper: Camper): Promise<void>;
}
