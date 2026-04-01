const express = require("express");
const auth = require("../middlewares/auth");
const requireRole = require("../middlewares/requireRole");
const deliveryNoteController = require("../controllers/deliveryNoteController");

const router = express.Router();

router.get("/", auth, deliveryNoteController.listDeliveryNotes);
router.get("/:id", auth, deliveryNoteController.getDeliveryNote);
router.post(
  "/",
  auth,
  requireRole("SUPERADMIN", "ADMIN"),
  deliveryNoteController.createDeliveryNote
);
router.post(
  "/:id/receive",
  auth,
  requireRole("SUPERADMIN", "ADMIN"),
  deliveryNoteController.receiveDeliveryNote
);

module.exports = router;
