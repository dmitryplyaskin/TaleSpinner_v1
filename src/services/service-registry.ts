import { ServiceFactory } from "@core/factories/service-factory";
import { ControllerFactory } from "@core/factories/controller-factory";
import { RouteFactory } from "@core/factories/route-factory";
import {
  InstructionType,
  InstructionSettingsType,
} from "@shared/types/instructions";
import {   , UserPersonSettings } from "@shared/types/user-person";

export class ServiceRegistry {
  private static instance: ServiceRegistry;
  private services: Map<string, any> = new Map();

  private constructor() {
    this.initializeServices();
  }

  static getInstance(): ServiceRegistry {
    if (!ServiceRegistry.instance) {
      ServiceRegistry.instance = new ServiceRegistry();
    }
    return ServiceRegistry.instance;
  }

  private initializeServices() {
    // Инициализация Instructions
    const instructionsFactory = new ServiceFactory<
      InstructionType,
      InstructionSettingsType
    >({
      name: "instructions",
      defaultSettings: {
        selectedId: null,
        enabled: true,
      },
    });

    // Инициализация UserPerson
    const userPersonFactory = new ServiceFactory<
      UserPerson,
      UserPersonSettings
    >({
      name: "user-person",
      defaultSettings: {
        selectedUserPersonId: null,
        isUserPersonEnabled: false,
      },
    });

    this.services.set("instructions", {
      service: instructionsFactory.getService(),
      settingsService: instructionsFactory.getSettingsService(),
    });

    this.services.set("userPerson", {
      service: userPersonFactory.getService(),
      settingsService: userPersonFactory.getSettingsService(),
    });
  }

  getRoutes(): Router[] {
    const routes: Router[] = [];

    for (const [name, services] of this.services) {
      const controllerFactory = new ControllerFactory(
        services.service,
        services.settingsService
      );

      const routeFactory = new RouteFactory(controllerFactory, name);
      routes.push(routeFactory.createRoutes());
    }

    return routes;
  }
}
