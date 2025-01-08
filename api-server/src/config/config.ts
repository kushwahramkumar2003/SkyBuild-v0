import dotenv from "dotenv";
import { ProjectConfig } from "../types";

dotenv.config();

function validateEnvironment(): ProjectConfig {
  const requiredEnvVars = [
    "CLUSTER",
    "TASK",
    "SUBNETS",
    "SECURITY_GROUPS",
    "AWS_REGION",
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "REDIS_URL",
    "API_PORT",
    "SOCKET_PORT",
  ];

  const missingVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(", ")}`
    );
  }

  return {
    CLUSTER: process.env.CLUSTER!,
    TASK: process.env.TASK!,
    SUBNETS: process.env.SUBNETS!.split(","),
    SECURITY_GROUPS: process.env.SECURITY_GROUPS!.split(","),
    AWS_REGION: process.env.AWS_REGION!,
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID!,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY!,
    REDIS_URL: process.env.REDIS_URL!,
    API_PORT: parseInt(process.env.API_PORT!, 10),
    SOCKET_PORT: parseInt(process.env.SOCKET_PORT!, 10),
  };
}

export const config = validateEnvironment();
