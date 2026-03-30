const express = require("express");
const multer = require("multer");
const auth = require("../middlewares/auth");
const requirePermission = require("../middlewares/requirePermission");
const productController = require("../controllers/productController");

const upload = multer({ storage: multer.memoryStorage() });
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

const router = express.Router();

router.get("/", auth, productController.listProducts);
router.get(
  "/template",
  auth,
  requirePermission("settings.create"),
  productController.downloadProductTemplate
);
router.get(
  "/technical-sheets/template",
  auth,
  requirePermission("settings.create"),
  productController.downloadTechnicalSheetTemplate
);
router.post(
  "/technical-sheets/import",
  auth,
  requirePermission("settings.create"),
  upload.single("file"),
  productController.importTechnicalSheets
);
router.post(
  "/upload-image",
  auth,
  requirePermission("settings.create", "settings.update"),
  imageUpload.single("file"),
  productController.uploadProductImage
);
router.get("/:id", auth, productController.getProduct);
router.post(
  "/",
  auth,
  requirePermission("settings.create"),
  productController.createProduct
);
router.patch(
  "/:id",
  auth,
  requirePermission("settings.update"),
  productController.updateProduct
);
router.delete(
  "/:id",
  auth,
  requirePermission("settings.delete"),
  productController.deleteProduct
);
router.delete(
  "/:id/hard",
  auth,
  requirePermission("settings.delete"),
  productController.hardDeleteProduct
);

router.post(
  "/import",
  auth,
  requirePermission("settings.create"),
  upload.single("file"),
  productController.importProducts
);

router.post(
  "/:id/components",
  auth,
  requirePermission("settings.update"),
  productController.addProductComponents
);
router.put(
  "/:id/components",
  auth,
  requirePermission("settings.update"),
  productController.replaceProductComponents
);
router.get("/:id/components", auth, requirePermission("settings.read"), productController.listProductComponents);
router.patch(
  "/:id/components/:componentId",
  auth,
  requirePermission("settings.update"),
  productController.updateProductComponent
);
router.delete(
  "/:id/components",
  auth,
  requirePermission("settings.delete"),
  productController.deleteAllProductComponents
);
router.delete(
  "/:id/components/:componentId",
  auth,
  requirePermission("settings.delete"),
  productController.deleteProductComponent
);

router.post(
  "/:id/conversions",
  auth,
  requirePermission("settings.update"),
  productController.addProductConversions
);
router.get("/:id/conversions", auth, requirePermission("settings.read"), productController.listProductConversions);
router.patch(
  "/:id/conversions/:conversionId",
  auth,
  requirePermission("settings.update"),
  productController.updateProductConversion
);
router.delete(
  "/:id/conversions/:conversionId",
  auth,
  requirePermission("settings.delete"),
  productController.deleteProductConversion
);

module.exports = router;
