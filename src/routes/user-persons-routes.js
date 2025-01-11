const express = require("express");
const router = express.Router();
const userPersonService = require("../services/user-person-service");

// Получение списка персон пользователей
router.get("/user-persons", async (req, res) => {
  try {
    const userPersons = await userPersonService.getUserPersonList();
    res.json(userPersons);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Получение конкретной персоны пользователя
router.get("/user-persons/:id", async (req, res) => {
  try {
    const userPerson = await userPersonService.getUserPerson(req.params.id);
    if (userPerson) {
      res.json(userPerson);
    } else {
      res.status(404).json({ message: "User person not found" });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Создание новой персоны пользователя
router.post("/user-persons", async (req, res) => {
  try {
    await userPersonService.saveUserPerson(req.body);
    res.status(201).json({ message: "User person created successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Обновление существующей персоны пользователя (предполагаем, что ID передается в теле)
router.put("/user-persons/:id", async (req, res) => {
  try {
    const updatedUserPerson = { ...req.body, id: req.params.id }; // Ensure ID is present
    await userPersonService.saveUserPerson(updatedUserPerson);
    res.json({ message: "User person updated successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Удаление персоны пользователя
router.delete("/user-persons/:id", async (req, res) => {
  try {
    await userPersonService.deleteUserPerson(req.params.id);
    res.json({ message: "User person deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Получение настроек пользователя
router.get("/user-persons/settings", async (req, res) => {
  try {
    const settings = await userPersonService.getUserPersonSettings();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Обновление настроек пользователя
router.put("/user-persons/settings", async (req, res) => {
  try {
    await userPersonService.saveUserPersonSettings(req.body);
    res.json({ message: "User person settings updated successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
