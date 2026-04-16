/** environment.yml top-level structure */
export interface EnvironmentConfig {
  version: "1";
  base: string;
  compose?: string;
  root?: string;
  setup?: string[];
  dev: {
    command: string;
    port: number;
    env?: Record<string, string>;
  };
  services?: Record<string, ServiceConfig>;
}

export interface ServiceConfig {
  image: string;
  port?: number | PortMapping;
  env?: Record<string, string>;
  volumes?: string[];
}

export interface PortMapping {
  container: number;
  host?: number;
}

export type EnvironmentStatus =
  | "idle"
  | "building"
  | "setup"
  | "running"
  | "stopped"
  | "error";

export interface EnvironmentState {
  worktreeId: string;
  branch: string;
  status: EnvironmentStatus;
  config: EnvironmentConfig | null;
  hostPort: number | null;
  containerId: string | null;
  error: string | null;
  setupCompleted: boolean;
  serviceStates: Record<string, ServiceState>;
}

export interface ServiceState {
  name: string;
  containerId: string | null;
  status: "running" | "stopped" | "error";
  hostPort: number | null;
}
