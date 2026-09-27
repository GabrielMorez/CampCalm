import { DomainValidationError } from "../errors/domain-errors.js";
import { Money } from "../value-objects/money.js";

export type AccommodationType = "TENT" | "MOTORHOME" | "TRAILER";

export interface SpaceProps {
  id: string;
  campingId: string;
  name: string;
  accommodationTypes: AccommodationType[];
  dimensions?: string;
  dailyRate: Money;
  active?: boolean;
}

export class Space {
  readonly id: string;
  readonly campingId: string;
  readonly name: string;
  readonly accommodationTypes: AccommodationType[];
  readonly dimensions: string | undefined;
  readonly dailyRate: Money;
  private currentActive: boolean;

  constructor(props: SpaceProps) {
    if (!props.name.trim()) {
      throw new DomainValidationError("SPACE_INVALID_NAME", "O nome do lote é obrigatório.");
    }

    if (props.accommodationTypes.length === 0) {
      throw new DomainValidationError(
        "SPACE_INVALID_ACCOMMODATION_TYPE",
        "O lote deve aceitar ao menos um tipo de acomodação.",
      );
    }

    this.id = props.id;
    this.campingId = props.campingId;
    this.name = props.name.trim();
    this.accommodationTypes = [...props.accommodationTypes];
    this.dimensions = props.dimensions;
    this.dailyRate = props.dailyRate;
    this.currentActive = props.active ?? true;
  }

  get active(): boolean {
    return this.currentActive;
  }

  deactivate(): void {
    this.currentActive = false;
  }
}
