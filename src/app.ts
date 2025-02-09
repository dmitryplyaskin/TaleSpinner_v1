import { ServiceRegistry } from "./services/service-registry";

const app = express();

// ... middleware и другие настройки

// Подключаем все роуты автоматически
const serviceRegistry = ServiceRegistry.getInstance();
const routes = serviceRegistry.getRoutes();
routes.forEach((route) => app.use("/api", route));
