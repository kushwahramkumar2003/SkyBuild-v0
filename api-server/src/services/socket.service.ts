import { Server, Socket } from "socket.io";
import { Logger } from "../utils/logger";

export class SocketService {
  private static instance: SocketService;
  private io: Server;
  private logger: Logger;

  private constructor(port: number) {
    this.io = new Server({ cors: { origin: "*" } });
    this.logger = Logger.getInstance();
    this.initialize(port);
  }

  public static getInstance(port: number): SocketService {
    if (!SocketService.instance) {
      SocketService.instance = new SocketService(port);
    }
    return SocketService.instance;
  }

  private initialize(port: number): void {
    this.io.on("connection", this.handleConnection.bind(this));
    this.io.listen(port);
    this.logger.info(`Socket server running on port ${port}`);
  }

  private handleConnection(socket: Socket): void {
    socket.on("subscribe", (channel: string) => {
      socket.join(channel);
      socket.emit("message", `Joined ${channel}`);
      this.logger.info(`Client subscribed to channel: ${channel}`);
    });
  }

  public emit(channel: string, message: string): void {
    this.io.to(channel).emit("message", message);
  }
}
