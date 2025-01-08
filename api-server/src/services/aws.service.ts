import {
  ECSClient,
  RunTaskCommand,
  RunTaskCommandInput,
} from "@aws-sdk/client-ecs";
import { Logger } from "../utils/logger";
import { config } from "../config/config";

export class AWSService {
  private static instance: AWSService;
  private ecsClient: ECSClient;
  private logger: Logger;

  private constructor() {
    this.ecsClient = new ECSClient({
      region: config.AWS_REGION,
      credentials: {
        accessKeyId: config.AWS_ACCESS_KEY_ID,
        secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
      },
    });
    this.logger = Logger.getInstance();
  }

  public static getInstance(): AWSService {
    if (!AWSService.instance) {
      AWSService.instance = new AWSService();
    }
    return AWSService.instance;
  }

  public async runTask(gitURL: string, projectSlug: string): Promise<void> {
    const taskParams: RunTaskCommandInput = {
      cluster: config.CLUSTER,
      taskDefinition: config.TASK,
      launchType: "FARGATE",
      count: 1,
      networkConfiguration: {
        awsvpcConfiguration: {
          assignPublicIp: "ENABLED",
          subnets: config.SUBNETS,
          securityGroups: config.SECURITY_GROUPS,
        },
      },
      overrides: {
        containerOverrides: [
          {
            name: "builder-image",
            environment: [
              { name: "GIT_REPOSITORY__URL", value: gitURL },
              { name: "PROJECT_ID", value: projectSlug },
            ],
          },
        ],
      },
    };

    try {
      const command = new RunTaskCommand(taskParams);
      await this.ecsClient.send(command);
      this.logger.info(`Task started for project: ${projectSlug}`);
    } catch (error) {
      this.logger.error(`Failed to start task for project: ${projectSlug}`);
      throw error;
    }
  }
}
