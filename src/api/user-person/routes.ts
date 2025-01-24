import express, { Request, Response } from "express";
import { asyncHandler } from "../common/middleware/async-handler";
import * as controllers from "./controllers";

const router = express.Router();

router
  .route("/user-persons")
  .get(asyncHandler(controllers.getUserPersonList))
  .post(asyncHandler(controllers.createUserPerson));

router
  .route("/user-persons/:userPersonId")
  .get(asyncHandler(controllers.getUserPerson))
  .put(asyncHandler(controllers.updateUserPerson))
  .delete(asyncHandler(controllers.deleteUserPerson));

router
  .route("/user-persons/:userPersonId/duplicate")
  .post(asyncHandler(controllers.duplicateUserPerson));

router
  .route("/user-persons/settings")
  .get(asyncHandler(controllers.getUserPersonSettings))
  .post(asyncHandler(controllers.setUserPersonSettings));

export default router;
