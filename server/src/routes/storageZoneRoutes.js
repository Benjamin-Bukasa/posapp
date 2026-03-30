const express = require("express");
const auth = require("../middlewares/auth");
const requirePermission = require("../middlewares/requirePermission");
const storageZoneController = require("../controllers/storageZoneController");

const router = express.Router();

router.get("/", auth, requirePermission("settings.read"), storageZoneController.listStorageZones);
router.post(
  "/",
  auth,
  requirePermission("settings.create"),
  storageZoneController.createStorageZone
);
router.patch(
  "/:id",
  auth,
  requirePermission("settings.update"),
  storageZoneController.updateStorageZone
);
router.delete(
  "/:id",
  auth,
  requirePermission("settings.delete"),
  storageZoneController.deleteStorageZone
);

module.exports = router;
