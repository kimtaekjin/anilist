const REQUIRED_ENV_VARS = ["MONGO_URI", "JWT_SECRET", "CLIENT_URL"];

export function validateEnvironment(env = process.env) {
  const missing = REQUIRED_ENV_VARS.filter((name) => !env[name]?.trim());
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  if (env.JWT_SECRET.length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters long.");
  }
}
