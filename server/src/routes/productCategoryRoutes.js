const express = require("express");
const multer = require("multer");
const auth = require("../middlewares/auth");
const requirePermission = require("../middlewares/requirePermission");
const controller = require("../controllers/productCategoryController");

const upload = multer({ storage: multer.memoryStorage() });
const router = express.Router();

router.get("/", auth, requirePermission("settings.read"), controller.listCategories);
router.get("/template", auth, requirePermission("settings.create"), controller.downloadCategoriesTemplate);
router.post(
  "/import",
  auth,
  requirePermission("settings.create"),
  upload.single("file"),
  controller.importCategories
);
router.post("/", auth, requirePermission("settings.create"), controller.createCategory);
router.patch("/:id", auth, requirePermission("settings.update"), controller.updateCategory);
router.delete("/:id", auth, requirePermission("settings.delete"), controller.deleteCategory);

module.exports = router;
