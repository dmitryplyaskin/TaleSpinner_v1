import { Router, RequestHandler } from "express";
import { asyncHandler } from "@core/middleware/async-handler";
import {
  ConfigController,
  CrudController,
  GeneralController,
} from "./controller-factory";
import { BaseEntity, BaseConfig } from "@core/types/common";

// Тип для допустимых HTTP-методов
type HTTPMethod =
  | "get"
  | "post"
  | "put"
  | "delete"
  | "patch"
  | "options"
  | "head";

export class RouteFactory<T extends BaseEntity, S extends BaseConfig> {
  private router: Router;

  constructor(
    private controllersFactory: {
      crud?: CrudController<T>;
      config?: ConfigController<S>;
      general?: GeneralController<T, S>;
    },
    private basePath: string
  ) {
    // Инициализируем роутер и стандартные маршруты
    this.router = Router();
    this.createDefaultRoutes();
  }

  // Метод для создания стандартных маршрутов
  private createDefaultRoutes(): void {
    const crud =
      this.controllersFactory.crud || this.controllersFactory.general;
    const config =
      this.controllersFactory.config || this.controllersFactory.general;

    if (crud) {
      this.router
        .route(`/${this.basePath}`)
        .get(asyncHandler(crud.getList))
        .post(asyncHandler(crud.create));

      this.router
        .route(`/${this.basePath}/:id`)
        .get(asyncHandler(crud.getById))
        .put(asyncHandler(crud.update))
        .delete(asyncHandler(crud.delete));

      this.router
        .route(`/${this.basePath}/:id/duplicate`)
        .post(asyncHandler(crud.duplicate));
    }

    if (config) {
      this.router
        .route(`/settings/${this.basePath}`)
        .get(asyncHandler(config.getSettings))
        .post(asyncHandler(config.setSettings));
    }
  }

  /**
   * Регистрирует новый маршрут.
   *
   * @param method HTTP-метод (например, 'get', 'post', 'put', и т.д.)
   * @param path Путь для маршрута
   * @param handlers Один или несколько обработчиков запроса
   * @returns Экземпляр RouteFactory для возможности цепочки вызовов.
   */
  public addRoute(
    method: HTTPMethod,
    path: string,
    ...handlers: RequestHandler[]
  ): this {
    // Оборачиваем каждый обработчик в asyncHandler для единообразной обработки ошибок.
    const wrappedHandlers = handlers.map((handler) => asyncHandler(handler));
    this.router[method](path, ...wrappedHandlers);
    return this;
  }

  // Удобные методы для конкретных HTTP-методов

  public get(path: string, ...handlers: RequestHandler[]): this {
    return this.addRoute("get", path, ...handlers);
  }

  public post(path: string, ...handlers: RequestHandler[]): this {
    return this.addRoute("post", path, ...handlers);
  }

  public put(path: string, ...handlers: RequestHandler[]): this {
    return this.addRoute("put", path, ...handlers);
  }

  public delete(path: string, ...handlers: RequestHandler[]): this {
    return this.addRoute("delete", path, ...handlers);
  }

  public patch(path: string, ...handlers: RequestHandler[]): this {
    return this.addRoute("patch", path, ...handlers);
  }

  /**
   * Возвращает настроенный роутер.
   */
  public getRouter(): Router {
    return this.router;
  }
}
