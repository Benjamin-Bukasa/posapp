const express = require("express");
const authController = require("../controllers/authController");
const auth = require("../middlewares/auth");

const router = express.Router();

router.post("/register", authController.register);
router.post("/login", authController.login);
router.post("/refresh", authController.refresh);
router.post("/logout", authController.logout);
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);
router.post("/first-login/change-password", authController.firstLoginChangePassword);

router.post("/change-password", auth, authController.changePassword);
router.post("/2fa/setup", auth, authController.setup2fa);
router.post("/2fa/verify", auth, authController.verify2fa);
router.post("/2fa/disable", auth, authController.disable2fa);
router.post("/google", authController.googleLogin);

module.exports = router;
