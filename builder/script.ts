import { exec, ChildProcess } from "child_process";
import path from "path";
import fs from "fs";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import mime from "mime-types";
import Redis from "ioredis";

// Types
interface Environment {
  PROJECT_ID: string;
  AWS_REGION: string;
  AWS_ACCESS_KEY_ID: string;
  AWS_SECRET_ACCESS_KEY: string;
  REDIS_URL: string;
  S3_BUCKET_NAME: string;
}

interface LogMessage {
  log: string;
  timestamp: string;
  level: "info" | "error" | "success";
}

// Environment validation
const requiredEnvVars: (keyof Environment)[] = [
  "PROJECT_ID",
  "AWS_REGION",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "REDIS_URL",
  "S3_BUCKET_NAME",
];

function validateEnvironment(): Environment {
  const missingVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(", ")}`
    );
  }

  return {
    PROJECT_ID: process.env.PROJECT_ID!,
    AWS_REGION: process.env.AWS_REGION!,
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID!,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY!,
    REDIS_URL: process.env.REDIS_URL!,
    S3_BUCKET_NAME: process.env.S3_BUCKET_NAME!,
  };
}

class DeploymentService {
  private readonly env: Environment;
  private readonly publisher: Redis;
  private readonly s3Client: S3Client;
  private readonly outputDir: string;
  private readonly distDir: string;

  constructor() {
    this.env = validateEnvironment();
    this.publisher = new Redis(this.env.REDIS_URL);
    this.s3Client = new S3Client({
      region: this.env.AWS_REGION,
      credentials: {
        accessKeyId: this.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: this.env.AWS_SECRET_ACCESS_KEY,
      },
    });
    this.outputDir = path.join(__dirname, "output");
    this.distDir = path.join(this.outputDir, "dist");
  }

  private async publishLog(
    message: string,
    level: LogMessage["level"] = "info"
  ): Promise<void> {
    const logMessage: LogMessage = {
      log: message,
      timestamp: new Date().toISOString(),
      level,
    };
    await this.publisher.publish(
      `logs:${this.env.PROJECT_ID}`,
      JSON.stringify(logMessage)
    );
  }

  private setupBuildProcess(): Promise<void> {
    return new Promise((resolve, reject) => {
      const buildProcess: ChildProcess = exec(
        `cd ${this.outputDir} && npm install && npm run build`
      );

      if (!buildProcess.stdout || !buildProcess.stderr) {
        reject(new Error("Failed to start build process"));
        return;
      }

      buildProcess.stdout.on("data", (data: string) => {
        console.log(data);
        this.publishLog(data);
      });

      buildProcess.stderr.on("data", (data: string) => {
        console.error(data);
        this.publishLog(data, "error");
      });

      buildProcess.on("error", (error: Error) => {
        console.error("Build process error:", error);
        this.publishLog(`Build failed: ${error.message}`, "error");
        reject(error);
      });

      buildProcess.on("close", (code: number | null) => {
        if (code === 0) {
          this.publishLog("Build completed successfully", "success");
          resolve();
        } else {
          reject(new Error(`Build process exited with code ${code}`));
        }
      });
    });
  }

  private async uploadFile(filePath: string, fileName: string): Promise<void> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.env.S3_BUCKET_NAME,
        Key: `__outputs/${this.env.PROJECT_ID}/${fileName}`,
        Body: fs.createReadStream(filePath),
        ContentType: mime.lookup(filePath) || "application/octet-stream",
      });

      await this.s3Client.send(command);
      await this.publishLog(`Uploaded ${fileName}`, "success");
    } catch (error) {
      await this.publishLog(`Failed to upload ${fileName}: ${error}`, "error");
      throw error;
    }
  }

  private async uploadDistFolder(): Promise<void> {
    const files = fs.readdirSync(this.distDir, { recursive: true }) as string[];
    await this.publishLog(`Found ${files.length} files to upload`);

    for (const file of files) {
      const filePath = path.join(this.distDir, file);
      if (fs.lstatSync(filePath).isDirectory()) continue;

      await this.uploadFile(filePath, file);
    }
  }

  public async deploy(): Promise<void> {
    try {
      await this.publishLog("Starting deployment...");

      // Ensure output directory exists
      if (!fs.existsSync(this.outputDir)) {
        throw new Error("Output directory not found");
      }

      // Build the project
      await this.publishLog("Starting build process...");
      await this.setupBuildProcess();

      // Upload to S3
      await this.publishLog("Starting upload to S3...");
      await this.uploadDistFolder();

      await this.publishLog("Deployment completed successfully", "success");
    } catch (error) {
      await this.publishLog(
        `Deployment failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        "error"
      );
      throw error;
    } finally {
      await this.publisher.quit();
    }
  }
}

// Execute deployment
async function main() {
  try {
    const deploymentService = new DeploymentService();
    await deploymentService.deploy();
  } catch (error) {
    console.error("Deployment failed:", error);
    process.exit(1);
  }
}

main();
