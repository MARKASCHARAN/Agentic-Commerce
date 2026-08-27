export interface HealthStatus {
  status: "ok";
  service: string;
  version: string;
}

export function getHealthStatus(): HealthStatus {
  return {
    status: "ok",
    service: "agentic-commerce-api",
    version: "0.1.0",
  };
}