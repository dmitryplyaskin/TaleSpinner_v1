import { AsyncRequestHandler } from "../common/middleware/async-handler";
import {
  UserPersonService,
  UserPersonSettingsService,
} from "@services/user-person";

export const getUserPersonList: AsyncRequestHandler = async (req) => {
  const userPersons = await UserPersonService.getAll();
  return { data: userPersons };
};

export const getUserPerson: AsyncRequestHandler = async (req) => {
  const userPerson = await UserPersonService.getById(req.params.userPersonId);
  return { data: userPerson };
};

export const createUserPerson: AsyncRequestHandler = async (req) => {
  const userPerson = await UserPersonService.create(req.body);
  return { data: userPerson };
};

export const updateUserPerson: AsyncRequestHandler = async (req) => {
  const userPerson = await UserPersonService.update(
    req.params.userPersonId,
    req.body
  );
  return { data: userPerson };
};

export const deleteUserPerson: AsyncRequestHandler = async (req) => {
  await UserPersonService.delete(req.params.userPersonId);
  return { data: {} };
};

export const duplicateUserPerson: AsyncRequestHandler = async (req) => {
  const duplicatedUserPerson = await UserPersonService.duplicate(
    req.params.userPersonId
  );
  return { data: duplicatedUserPerson };
};

export const getUserPersonSettings: AsyncRequestHandler = async (req) => {
  const userPersonSettings = await UserPersonSettingsService.getConfig();
  return { data: userPersonSettings };
};

export const setUserPersonSettings: AsyncRequestHandler = async (req) => {
  const userPersonSettings = await UserPersonSettingsService.saveConfig(
    req.body
  );
  return { data: userPersonSettings };
};
