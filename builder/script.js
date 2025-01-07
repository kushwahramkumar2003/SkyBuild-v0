"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const child_process_1 = require("child_process");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const client_s3_1 = require("@aws-sdk/client-s3");
const mime_types_1 = __importDefault(require("mime-types"));
const ioredis_1 = __importDefault(require("ioredis"));
// Environment validation
const requiredEnvVars = [
    "PROJECT_ID",
    "AWS_REGION",
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "REDIS_URL",
    "S3_BUCKET_NAME",
];
function validateEnvironment() {
    const missingVars = requiredEnvVars.filter((envVar) => !process.env[envVar]);
    if (missingVars.length > 0) {
        throw new Error(`Missing required environment variables: ${missingVars.join(", ")}`);
    }
    return {
        PROJECT_ID: process.env.PROJECT_ID,
        AWS_REGION: process.env.AWS_REGION,
        AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
        AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
        REDIS_URL: process.env.REDIS_URL,
        S3_BUCKET_NAME: process.env.S3_BUCKET_NAME,
    };
}
class DeploymentService {
    constructor() {
        this.env = validateEnvironment();
        this.publisher = new ioredis_1.default(this.env.REDIS_URL);
        this.s3Client = new client_s3_1.S3Client({
            region: this.env.AWS_REGION,
            credentials: {
                accessKeyId: this.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: this.env.AWS_SECRET_ACCESS_KEY,
            },
        });
        this.outputDir = path_1.default.join(__dirname, "output");
        this.distDir = path_1.default.join(this.outputDir, "dist");
    }
    async publishLog(message, level = "info") {
        const logMessage = {
            log: message,
            timestamp: new Date().toISOString(),
            level,
        };
        await this.publisher.publish(`logs:${this.env.PROJECT_ID}`, JSON.stringify(logMessage));
    }
    setupBuildProcess() {
        return new Promise((resolve, reject) => {
            const buildProcess = (0, child_process_1.exec)(`cd ${this.outputDir} && npm install && npm run build`);
            if (!buildProcess.stdout || !buildProcess.stderr) {
                reject(new Error("Failed to start build process"));
                return;
            }
            buildProcess.stdout.on("data", (data) => {
                console.log(data);
                this.publishLog(data);
            });
            buildProcess.stderr.on("data", (data) => {
                console.error(data);
                this.publishLog(data, "error");
            });
            buildProcess.on("error", (error) => {
                console.error("Build process error:", error);
                this.publishLog(`Build failed: ${error.message}`, "error");
                reject(error);
            });
            buildProcess.on("close", (code) => {
                if (code === 0) {
                    this.publishLog("Build completed successfully", "success");
                    resolve();
                }
                else {
                    reject(new Error(`Build process exited with code ${code}`));
                }
            });
        });
    }
    async uploadFile(filePath, fileName) {
        try {
            const command = new client_s3_1.PutObjectCommand({
                Bucket: this.env.S3_BUCKET_NAME,
                Key: `__outputs/${this.env.PROJECT_ID}/${fileName}`,
                Body: fs_1.default.createReadStream(filePath),
                ContentType: mime_types_1.default.lookup(filePath) || "application/octet-stream",
            });
            await this.s3Client.send(command);
            await this.publishLog(`Uploaded ${fileName}`, "success");
        }
        catch (error) {
            await this.publishLog(`Failed to upload ${fileName}: ${error}`, "error");
            throw error;
        }
    }
    async uploadDistFolder() {
        const files = fs_1.default.readdirSync(this.distDir, { recursive: true });
        await this.publishLog(`Found ${files.length} files to upload`);
        for (const file of files) {
            const filePath = path_1.default.join(this.distDir, file);
            if (fs_1.default.lstatSync(filePath).isDirectory())
                continue;
            await this.uploadFile(filePath, file);
        }
    }
    async deploy() {
        try {
            await this.publishLog("Starting deployment...");
            // Ensure output directory exists
            if (!fs_1.default.existsSync(this.outputDir)) {
                throw new Error("Output directory not found");
            }
            // Build the project
            await this.publishLog("Starting build process...");
            await this.setupBuildProcess();
            // Upload to S3
            await this.publishLog("Starting upload to S3...");
            await this.uploadDistFolder();
            await this.publishLog("Deployment completed successfully", "success");
        }
        catch (error) {
            await this.publishLog(`Deployment failed: ${error instanceof Error ? error.message : "Unknown error"}`, "error");
            throw error;
        }
        finally {
            await this.publisher.quit();
        }
    }
}
// Execute deployment
async function main() {
    try {
        const deploymentService = new DeploymentService();
        await deploymentService.deploy();
    }
    catch (error) {
        console.error("Deployment failed:", error);
        process.exit(1);
    }
}
main();
