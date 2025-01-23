import express, { Request, Response } from "express";
import userPersonService from "../services/user-person-service";
import { UserPerson } from "../types";

const router = express.Router();

router.get(
  "/user-persons",
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const userPersons = await userPersonService.getUserPersonList();
      res.json(userPersons);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }
);

router.get(
  "/user-persons/:id",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const userPerson = await userPersonService.getUserPerson(req.params.id);
      if (userPerson) {
        res.json(userPerson);
      } else {
        res.status(404).json({ message: "User person not found" });
      }
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }
);

router.post(
  "/user-persons",
  async (req: Request, res: Response): Promise<void> => {
    try {
      await userPersonService.saveUserPerson(req.body as UserPerson);
      res.status(201).json({ message: "User person created successfully" });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }
);

router.put(
  "/user-persons/:id",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const updatedUserPerson = {
        ...req.body,
        id: req.params.id,
      } as UserPerson;
      await userPersonService.saveUserPerson(updatedUserPerson);
      res.json({ message: "User person updated successfully" });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }
);

router.delete(
  "/user-persons/:id",
  async (req: Request, res: Response): Promise<void> => {
    try {
      await userPersonService.deleteUserPerson(req.params.id);
      res.json({ message: "User person deleted successfully" });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }
);

export default router;
