import { CrudController } from "@core/factories/controller-factory";
import { RouteFactory } from "@core/factories/route-factory";
import { chatService } from "@services/chat-service";

const chatController = new CrudController(chatService.service);

const chatRoutes = new RouteFactory({ crud: chatController }, "chat");

export default chatRoutes.getRouter();
