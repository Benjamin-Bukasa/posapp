const express = require("express");
const multer = require("multer");
const auth = require("../middlewares/auth");
const requirePermission = require("../middlewares/requirePermission");
const controller = require("../controllers/productCollectionController");

const upload = multer({ storage: multer.memoryStorage() });
const router = express.Router();

router.get("/", auth, requirePermission("settings.read"), controller.listProductCollections);
router.get(
  "/template",
  auth,
  requirePermission("settings.create"),
  controller.downloadCollectionsTemplate,
);
router.post(
  "/import",
  auth,
  requirePermission("settings.create"),
  upload.single("file"),
  controller.importCollections,
);
router.post("/", auth, requirePermission("settings.create"), controller.createProductCollection);
router.patch("/:id", auth, requirePermission("settings.update"), controller.updateProductCollection);
router.delete("/:id", auth, requirePermission("settings.delete"), controller.deleteProductCollection);

module.exports = router;
