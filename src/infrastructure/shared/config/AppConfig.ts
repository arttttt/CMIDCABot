import { parseEnv, Config } from "./envSchema.js";

export function loadConfig(): Config {
  // Validate all environment variables using zod schema
  // (includes forbidden vars check for production)
  const config = parseEnv(process.env);

  return config;
}
