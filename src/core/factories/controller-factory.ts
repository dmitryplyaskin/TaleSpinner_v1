import { AsyncRequestHandler } from "@core/middleware/async-handler";
import { BaseService } from "@core/services/base-service";
import { ConfigService } from "@core/services/config-service";
import { BaseEntity, BaseConfig } from "@core/types/common";

export class CrudController<T extends BaseEntity> {
  constructor(private service: BaseService<T>) {}

  getList: AsyncRequestHandler = async () => {
    const items = await this.service.getAll();
    return { data: items };
  };

  getById: AsyncRequestHandler = async (req) => {
    const item = await this.service.getById(req.params.id);
    return { data: item };
  };

  create: AsyncRequestHandler = async (req) => {
    const item = await this.service.create(req.body);
    return { data: item };
  };

  update: AsyncRequestHandler = async (req) => {
    const item = await this.service.update(req.body);
    return { data: item };
  };

  delete: AsyncRequestHandler = async (req) => {
    await this.service.delete(req.params.id);
    return { data: { id: req.params.id } };
  };

  duplicate: AsyncRequestHandler = async (req) => {
    const item = await this.service.duplicate(req.body);
    return { data: item };
  };
}

export class ConfigController<S extends BaseConfig> {
  constructor(private settingsService: ConfigService<S>) {}

  getSettings: AsyncRequestHandler = async () => {
    const settings = await this.settingsService.getConfig();
    return { data: settings };
  };

  setSettings: AsyncRequestHandler = async (req) => {
    const settings = await this.settingsService.saveConfig(req.body);
    return { data: settings };
  };
}

export class GeneralController<T extends BaseEntity, S extends BaseConfig> {
  private crud: CrudController<T>;
  private config: ConfigController<S>;

  public getList: AsyncRequestHandler;
  public getById: AsyncRequestHandler;
  public create: AsyncRequestHandler;
  public update: AsyncRequestHandler;
  public delete: AsyncRequestHandler;
  public duplicate: AsyncRequestHandler;
  public getSettings: AsyncRequestHandler;
  public setSettings: AsyncRequestHandler;

  constructor(service: BaseService<T>, settingsService: ConfigService<S>) {
    this.crud = new CrudController<T>(service);
    this.config = new ConfigController<S>(settingsService);

    // Присваиваем методы после инициализации зависимостей
    this.getList = this.crud.getList;
    this.getById = this.crud.getById;
    this.create = this.crud.create;
    this.update = this.crud.update;
    this.delete = this.crud.delete;
    this.duplicate = this.crud.duplicate;

    this.getSettings = this.config.getSettings;
    this.setSettings = this.config.setSettings;
  }
}
