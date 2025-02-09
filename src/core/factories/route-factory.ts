import { Router, RequestHandler } from "express";
import { asyncHandler } from "@core/middleware/async-handler";
import { ControllerFactory } from "./controller-factory";
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
    private controllerFactory: ControllerFactory<T, S>,
    private basePath: string
  ) {
    // Инициализируем роутер и стандартные маршруты
    this.router = Router();
    this.createDefaultRoutes();
  }

  // Метод для создания стандартных маршрутов
  private createDefaultRoutes(): void {
    this.router
      .route(`/${this.basePath}`)
      .get(asyncHandler(this.controllerFactory.getList))
      .post(asyncHandler(this.controllerFactory.create));

    this.router
      .route(`/${this.basePath}/:id`)
      .get(asyncHandler(this.controllerFactory.getById))
      .put(asyncHandler(this.controllerFactory.update))
      .delete(asyncHandler(this.controllerFactory.delete));

    this.router
      .route(`/settings/${this.basePath}`)
      .get(asyncHandler(this.controllerFactory.getSettings))
      .post(asyncHandler(this.controllerFactory.setSettings));
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
