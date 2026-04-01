const express = require("express");
const multer = require("multer");
const auth = require("../middlewares/auth");
const requirePermission = require("../middlewares/requirePermission");
const unitController = require("../controllers/unitController");

const upload = multer({ storage: multer.memoryStorage() });
const router = express.Router();

router.get("/", auth, requirePermission("settings.read"), unitController.listUnits);
router.get("/template", auth, requirePermission("settings.create"), unitController.downloadUnitsTemplate);
router.post(
  "/import",
  auth,
  requirePermission("settings.create"),
  upload.single("file"),
  unitController.importUnits
);
router.post(
  "/",
  auth,
  requirePermission("settings.create"),
  unitController.createUnit
);
router.patch(
  "/:id",
  auth,
  requirePermission("settings.update"),
  unitController.updateUnit
);
router.delete(
  "/:id",
  auth,
  requirePermission("settings.delete"),
  unitController.deleteUnit
);

module.exports = router;
