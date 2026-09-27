import { InvalidReservationStateError } from "../errors/domain-errors.js";
import { Money } from "../value-objects/money.js";
import { Period } from "../value-objects/period.js";

export type ReservationStatus = "PENDING" | "CONFIRMED" | "REFUSED" | "CANCELLED";

export interface ReservationProps {
  id: string;
  camperId: string;
  campingId: string;
  spaceId: string;
  period: Period;
  dailyRate: Money;
  status?: ReservationStatus;
}

export class Reservation {
  readonly id: string;
  readonly camperId: string;
  readonly campingId: string;
  readonly spaceId: string;
  readonly period: Period;
  readonly dailyRate: Money;
  private currentStatus: ReservationStatus;

  constructor(props: ReservationProps) {
    this.id = props.id;
    this.camperId = props.camperId;
    this.campingId = props.campingId;
    this.spaceId = props.spaceId;
    this.period = props.period;
    this.dailyRate = props.dailyRate;
    this.currentStatus = props.status ?? "PENDING";
  }

  get status(): ReservationStatus {
    return this.currentStatus;
  }

  get total(): Money {
    return this.dailyRate.multiply(this.period.nights);
  }

  approve(): void {
    this.ensurePending();
    this.currentStatus = "CONFIRMED";
  }

  refuse(): void {
    this.ensurePending();
    this.currentStatus = "REFUSED";
  }

  cancel(): void {
    if (this.currentStatus !== "CONFIRMED") {
      throw new InvalidReservationStateError(
        "Somente reservas confirmadas podem ser canceladas.",
      );
    }

    this.currentStatus = "CANCELLED";
  }

  private ensurePending(): void {
    if (this.currentStatus !== "PENDING") {
      throw new InvalidReservationStateError();
    }
  }
}
