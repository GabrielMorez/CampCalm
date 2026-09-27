export const CAMP_CALM_BACKEND_VERSION = "0.1.0";

export function getHealthStatus() {
  return {
    service: "campcalm-backend",
    version: CAMP_CALM_BACKEND_VERSION,
    status: "ok" as const,
  };
}
