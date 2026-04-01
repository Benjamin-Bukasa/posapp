const express = require("express");
const multer = require("multer");
const auth = require("../middlewares/auth");
const requirePermission = require("../middlewares/requirePermission");
const controller = require("../controllers/productSubFamilyController");

const upload = multer({ storage: multer.memoryStorage() });
const router = express.Router();

router.get("/", auth, requirePermission("settings.read"), controller.listSubFamilies);
router.get(
  "/template",
  auth,
  requirePermission("settings.create"),
  controller.downloadSubFamiliesTemplate,
);
router.post(
  "/import",
  auth,
  requirePermission("settings.create"),
  upload.single("file"),
  controller.importSubFamilies,
);
router.post("/", auth, requirePermission("settings.create"), controller.createSubFamily);
router.patch(
  "/:id",
  auth,
  requirePermission("settings.update"),
  controller.updateSubFamily,
);
router.delete(
  "/:id",
  auth,
  requirePermission("settings.delete"),
  controller.deleteSubFamily,
);

module.exports = router;
