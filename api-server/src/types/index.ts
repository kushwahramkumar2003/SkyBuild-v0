export interface ProjectConfig {
  CLUSTER: string;
  TASK: string;
  SUBNETS: string[];
  SECURITY_GROUPS: string[];
  AWS_REGION: string;
  AWS_ACCESS_KEY_ID: string;
  AWS_SECRET_ACCESS_KEY: string;
  REDIS_URL: string;
  API_PORT: number;
  SOCKET_PORT: number;
}

export interface ProjectRequest {
  gitURL: string;
  slug?: string;
}

export interface ProjectResponse {
  status: string;
  data: {
    projectSlug: string;
    url: string;
  };
}

export interface LogMessage {
  timestamp: string;
  message: string;
  level: "info" | "error" | "success";
}
