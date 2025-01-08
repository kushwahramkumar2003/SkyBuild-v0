import Redis from "ioredis";

import { SocketService } from "./socket.service";
import { config } from "../config/config";
import { Logger } from "../utils/logger";

export class RedisService {
  private static instance: RedisService;
  private subscriber: Redis;
  private logger: Logger;
  private socketService: SocketService;

  private constructor() {
    this.subscriber = new Redis(config.REDIS_URL);
    this.logger = Logger.getInstance();
    this.socketService = SocketService.getInstance(config.SOCKET_PORT);
    this.initialize();
  }

  public static getInstance(): RedisService {
    if (!RedisService.instance) {
      RedisService.instance = new RedisService();
    }
    return RedisService.instance;
  }

  private initialize(): void {
    this.subscriber.psubscribe("logs:*");
    this.subscriber.on(
      "pmessage",
      (pattern: string, channel: string, message: string) => {
        this.socketService.emit(channel, message);
        this.logger.info(`Message forwarded to channel: ${channel}`);
      }
    );
    this.logger.info("Redis subscription initialized");
  }
}
