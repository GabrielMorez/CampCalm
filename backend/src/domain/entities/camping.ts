
import { DomainValidationError } from "../errors/domain-errors.js";

export type CampingPublicationStatus =
  | "PENDING_REVIEW"
  | "APPROVED"
  | "REJECTED";

export interface CampingProps {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  active?: boolean;
  publicationStatus?: CampingPublicationStatus;
  addressText?: string | null;
}

export class Camping {
  readonly id: string;
  readonly name: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly addressText: string | null;

  private currentActive: boolean;
  private currentPublicationStatus: CampingPublicationStatus;

  constructor(props: CampingProps) {
    if (!props.name.trim()) {
      throw new DomainValidationError(
        "CAMPING_INVALID_NAME",
        "O nome do camping é obrigatório.",
      );
    }

    if (
      !Number.isFinite(props.latitude) ||
      props.latitude < -90 ||
      props.latitude > 90
    ) {
      throw new DomainValidationError(
        "CAMPING_INVALID_LATITUDE",
        "A latitude deve estar entre -90 e 90.",
      );
    }

    if (
      !Number.isFinite(props.longitude) ||
      props.longitude < -180 ||
      props.longitude > 180
    ) {
      throw new DomainValidationError(
        "CAMPING_INVALID_LONGITUDE",
        "A longitude deve estar entre -180 e 180.",
      );
    }

    const publicationStatus =
      props.publicationStatus ?? "PENDING_REVIEW";

    if (
      !["PENDING_REVIEW", "APPROVED", "REJECTED"].includes(
        publicationStatus,
      )
    ) {
      throw new DomainValidationError(
        "CAMPING_INVALID_PUBLICATION_STATUS",
        "Estado de publicação inválido.",
      );
    }

    this.id = props.id;
    this.name = props.name.trim();
    this.latitude = props.latitude;
    this.longitude = props.longitude;
    this.addressText = props.addressText ?? null;

    this.currentActive = props.active ?? true;
    this.currentPublicationStatus = publicationStatus;
  }

  get active(): boolean {
    return this.currentActive;
  }

  get publicationStatus(): CampingPublicationStatus {
    return this.currentPublicationStatus;
  }

  get isPublished(): boolean {
    return (
      this.currentActive &&
      this.currentPublicationStatus === "APPROVED"
    );
  }

  activate(): void {
    this.currentActive = true;
  }

  deactivate(): void {
    this.currentActive = false;
  }
}
