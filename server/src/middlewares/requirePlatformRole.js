const requirePlatformRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const platformRole = req.user.actualRole || req.user.role;
    if (!roles.includes(platformRole)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    return next();
  };
};

module.exports = requirePlatformRole;
