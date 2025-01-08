import express, { Request, Response, NextFunction } from "express";
import { generateSlug } from "random-word-slugs";
import { AWSService } from "./services/aws.service";
import { RedisService } from "./services/redis.service";
import { SocketService } from "./services/socket.service";
import { config } from "./config/config";
import { Logger } from "./utils/logger";
import { ProjectRequest, ProjectResponse } from "./types";

export class App {
  private app: express.Application;
  private awsService: AWSService;
  private logger: Logger;

  constructor() {
    this.app = express();
    this.awsService = AWSService.getInstance();
    this.logger = Logger.getInstance();
    this.initialize();
  }

  private initialize(): void {
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();

    // Initialize services
    RedisService.getInstance();
    SocketService.getInstance(config.SOCKET_PORT);
  }

  private setupMiddleware(): void {
    this.app.use(express.json());
  }

  private setupRoutes(): void {
    this.app.post("/project", this.handleProjectCreation.bind(this));
  }

  private setupErrorHandling(): void {
    this.app.use(
      (err: Error, req: Request, res: Response, next: NextFunction) => {
        this.logger.error(err.message);
        res.status(500).json({ error: "Internal Server Error" });
      }
    );
  }

  private async handleProjectCreation(
    req: Request<{}, {}, ProjectRequest>,
    res: Response<ProjectResponse>
  ): Promise<void> {
    try {
      const { gitURL, slug } = req.body;
      const projectSlug = slug || generateSlug();

      await this.awsService.runTask(gitURL, projectSlug);

      res.json({
        status: "queued",
        data: {
          projectSlug,
          url: `http://${projectSlug}.localhost:8000`,
        },
      });
    } catch (error) {
      this.logger.error(`Project creation failed: ${error}`);
      throw error;
    }
  }

  public start(): void {
    this.app.listen(config.API_PORT, () => {
      this.logger.info(`API Server running on port ${config.API_PORT}`);
    });
  }
}
