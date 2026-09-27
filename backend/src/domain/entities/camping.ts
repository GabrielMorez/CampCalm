import { DomainValidationError } from "../errors/domain-errors.js";

export interface CampingProps {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  active?: boolean;
}

export class Camping {
  readonly id: string;
  readonly name: string;
  readonly latitude: number;
  readonly longitude: number;
  private currentActive: boolean;

  constructor(props: CampingProps) {
    if (!props.name.trim()) {
      throw new DomainValidationError("CAMPING_INVALID_NAME", "O nome do camping é obrigatório.");
    }

    if (props.latitude < -90 || props.latitude > 90) {
      throw new DomainValidationError("CAMPING_INVALID_LATITUDE", "A latitude deve estar entre -90 e 90.");
    }

    if (props.longitude < -180 || props.longitude > 180) {
      throw new DomainValidationError("CAMPING_INVALID_LONGITUDE", "A longitude deve estar entre -180 e 180.");
    }

    this.id = props.id;
    this.name = props.name.trim();
    this.latitude = props.latitude;
    this.longitude = props.longitude;
    this.currentActive = props.active ?? true;
  }

  get active(): boolean {
    return this.currentActive;
  }

  activate(): void {
    this.currentActive = true;
  }

  deactivate(): void {
    this.currentActive = false;
  }
}
