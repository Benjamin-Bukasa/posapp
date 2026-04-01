const { OAuth2Client } = require("google-auth-library");

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const client = googleClientId ? new OAuth2Client(googleClientId) : null;

const verifyGoogleIdToken = async (idToken) => {
  if (!client) {
    throw new Error("GOOGLE_CLIENT_ID not configured.");
  }

  const ticket = await client.verifyIdToken({
    idToken,
    audience: googleClientId,
  });

  const payload = ticket.getPayload();
  return {
    sub: payload.sub,
    email: payload.email,
    name: payload.name,
    givenName: payload.given_name,
    familyName: payload.family_name,
  };
};

module.exports = {
  verifyGoogleIdToken,
};
