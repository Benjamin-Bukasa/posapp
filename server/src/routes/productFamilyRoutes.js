const express = require("express");
const multer = require("multer");
const auth = require("../middlewares/auth");
const requirePermission = require("../middlewares/requirePermission");
const controller = require("../controllers/productFamilyController");

const upload = multer({ storage: multer.memoryStorage() });
const router = express.Router();

router.get("/", auth, requirePermission("settings.read"), controller.listFamilies);
router.get("/template", auth, requirePermission("settings.create"), controller.downloadFamiliesTemplate);
router.post(
  "/import",
  auth,
  requirePermission("settings.create"),
  upload.single("file"),
  controller.importFamilies
);
router.post("/", auth, requirePermission("settings.create"), controller.createFamily);
router.patch("/:id", auth, requirePermission("settings.update"), controller.updateFamily);
router.delete("/:id", auth, requirePermission("settings.delete"), controller.deleteFamily);

module.exports = router;
