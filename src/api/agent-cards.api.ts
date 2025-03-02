import { GeneralController } from "@core/factories/controller-factory";
import { RouteFactory } from "@core/factories/route-factory";
import { chatService } from "@services/agent-cards.service";

const chatController = new GeneralController(
  chatService.service,
  chatService.settings
);

const chatRoutes = new RouteFactory({ general: chatController }, "agent-cards");

export default chatRoutes.getRouter();
