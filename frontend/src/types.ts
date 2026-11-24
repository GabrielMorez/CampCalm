export type AccommodationType = 'TENT' | 'MOTORHOME' | 'TRAILER';
export type PublicationStatus = 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';
export type ReservationStatus = 'PENDING' | 'CONFIRMED' | 'REFUSED' | 'CANCELLED';

export interface AddressCandidate {
  label: string;
  latitude: number;
  longitude: number;
  resultType: string | null;
}


export interface PublicCamping {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  addressText: string | null;
}

export interface OwnedCamping {
  id: string;
  name: string;
  addressText: string | null;
  active: boolean;
  publicationStatus: PublicationStatus;
  role: 'OWNER' | 'MANAGER';
}

export interface Space {
  id: string;
  campingId: string;
  name: string;
  accommodationTypes: AccommodationType[];
  dimensions?: string | null;
  dailyRateCents: number;
  active: boolean;
}

export interface AvailableSpace extends Omit<Space, 'active'> {
  nights: number;
  totalCents: number;
}

export interface ManagedReservation {
  id: string;
  campingId: string;
  spaceId: string;
  spaceName: string;
  camperId: string;
  camperName: string;
  startDate: string;
  endDate: string;
  nights: number;
  dailyRateCents: number;
  totalCents: number;
  status: ReservationStatus;
}

export interface ReservationCreated {
  id: string;
  campingId: string;
  spaceId: string;
  status: 'PENDING';
  startDate: string;
  endDate: string;
  totalCents: number;
}

export interface AuthUser {
  id: string;
  email: string;
}

export interface LoginResponse {
  tokenType: 'Bearer';
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  sessionExpiresAt: string;
  user: AuthUser;
}

export interface RefreshResponse {
  tokenType: 'Bearer';
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  sessionExpiresAt: string;
}

export interface RegisterInput {
  name: string;
  email: string;
  phone: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface SearchFilters {
  latitude: string;
  longitude: string;
  radiusKm: string;
  startDate: string;
  endDate: string;
}
