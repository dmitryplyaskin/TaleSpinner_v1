import { AsyncRequestHandler } from "@core/middleware/async-handler";
import { BaseService } from "@core/services/base-service";
import { ConfigService } from "@core/services/config-service";
import { BaseEntity, BaseConfig } from "@core/types/common";

export class ControllerFactory<T extends BaseEntity, S extends BaseConfig> {
  constructor(
    private service: BaseService<T>,
    private settingsService: ConfigService<S>
  ) {}

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
    const item = await this.service.update(req.params.id, req.body);
    return { data: item };
  };

  delete: AsyncRequestHandler = async (req) => {
    await this.service.delete(req.params.id);
    return { data: { id: req.params.id } };
  };

  getSettings: AsyncRequestHandler = async () => {
    const settings = await this.settingsService.getConfig();
    return { data: settings };
  };

  setSettings: AsyncRequestHandler = async (req) => {
    const settings = await this.settingsService.saveConfig(req.body);
    return { data: settings };
  };
}
