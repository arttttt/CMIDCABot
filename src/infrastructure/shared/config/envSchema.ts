import { z } from "zod";

/**
 * MED-004: Environment variables that are forbidden in production mode.
 * These variables are for development only and may contain sensitive data
 * or change bot behavior in ways that are unsafe for production.
 */
const FORBIDDEN_IN_PRODUCTION: string[] = [];

// Base schema for environment variables
const envSchema = z
  .object({
    // Environment
    NODE_ENV: z.enum(["development", "production"]).default("development"),

    // Telegram
    TELEGRAM_BOT_TOKEN: z.string().min(1, "TELEGRAM_BOT_TOKEN is required"),
    OWNER_TELEGRAM_ID: z.coerce.number().int().positive(),

    // Encryption
    MASTER_ENCRYPTION_KEY: z
      .string()
      .regex(/^[A-Za-z0-9+/=]{43,44}$/, "Must be base64-encoded 32 bytes"),

    // Solana
    SOLANA_RPC_URL: z.string().url().default("https://api.mainnet-beta.solana.com"),

    // Database
    DATABASE_PATH: z.string().default("./data/bot.db"),
    AUTH_DATABASE_PATH: z.string().default("./data/auth.db"),

    // HTTP
    HTTP_PORT: z.coerce.number().int().min(1).max(65535).default(8000),
    HTTP_HOST: z.string().default("127.0.0.1"),
    PUBLIC_URL: z.string().url(),

    // Transport
    BOT_TRANSPORT: z.enum(["polling", "webhook"]).default("polling"),
    WEBHOOK_URL: z.string().url().optional(),
    WEBHOOK_SECRET: z.string().optional(),

    // Price
    JUPITER_API_KEY: z.string().min(1, "JUPITER_API_KEY is required"),

    // Rate limiting
    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
    RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(30),

    // Market monitor
    MARKET_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(300000),
    MARKET_BACKFILL: z.enum(["binance", "off"]).default("binance"),
    MARKET_DIGEST_HOUR_UTC: z.coerce.number().int().min(0).max(23).default(9),

  })
  .superRefine((data, ctx) => {
    const isDev = data.NODE_ENV !== "production";

    // WEBHOOK_URL required and must be HTTPS when BOT_TRANSPORT=webhook
    if (data.BOT_TRANSPORT === "webhook") {
      if (!data.WEBHOOK_URL) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "WEBHOOK_URL is required when BOT_TRANSPORT is 'webhook'",
          path: ["WEBHOOK_URL"],
        });
      } else if (!data.WEBHOOK_URL.startsWith("https://")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "WEBHOOK_URL must use HTTPS",
          path: ["WEBHOOK_URL"],
        });
      }
    }

    // SOLANA_RPC_URL must use HTTPS in production
    if (!isDev && !data.SOLANA_RPC_URL.startsWith("https://")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "SOLANA_RPC_URL must use HTTPS in production",
        path: ["SOLANA_RPC_URL"],
      });
    }
  });

// Infer the validated env type
type ValidatedEnv = z.infer<typeof envSchema>;

/**
 * Config types - structured application configuration.
 *
 * Note: These interfaces describe the TRANSFORMED config structure (nested),
 * not the flat env schema. envSchema validates process.env (flat: TELEGRAM_BOT_TOKEN),
 * while Config groups related settings (nested: telegram.botToken).
 * The transformation happens in envToConfig().
 */
export type TransportMode = "polling" | "webhook";

export interface TelegramConfig {
  botToken: string;
}

export interface TransportConfig {
  mode: TransportMode;
  webhookUrl?: string;
  webhookSecret?: string;
}

export interface SolanaConfig {
  rpcUrl: string;
}

export interface DatabaseConfig {
  path: string;
}

export interface HttpConfig {
  port: number;
  host: string;
  publicUrl: string;
}

export interface EncryptionConfig {
  masterKey: string;
}

export interface AuthConfig {
  ownerTelegramId: number;
  dbPath: string;
}

export interface PriceConfig {
  jupiterApiKey: string;
}

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

export type MarketBackfillSource = "binance" | "off";

export interface MarketConfig {
  pollIntervalMs: number;
  backfill: MarketBackfillSource;
  /** UTC hour (0-23) after which the daily digest is sent */
  digestHourUtc: number;
}

export interface Config {
  telegram: TelegramConfig;
  solana: SolanaConfig;
  database: DatabaseConfig;
  encryption: EncryptionConfig;
  price: PriceConfig;
  auth: AuthConfig;
  http: HttpConfig;
  transport: TransportConfig;
  rateLimit: RateLimitConfig;
  market: MarketConfig;
  isDev: boolean;
}

// Transform validated env to Config structure
function envToConfig(env: ValidatedEnv): Config {
  const isDev = env.NODE_ENV !== "production";

  return {
    telegram: {
      botToken: env.TELEGRAM_BOT_TOKEN ?? "",
    },
    solana: {
      rpcUrl: env.SOLANA_RPC_URL,
    },
    database: {
      path: env.DATABASE_PATH,
    },
    encryption: {
      masterKey: env.MASTER_ENCRYPTION_KEY,
    },
    price: {
      jupiterApiKey: env.JUPITER_API_KEY,
    },
    auth: {
      ownerTelegramId: env.OWNER_TELEGRAM_ID,
      dbPath: env.AUTH_DATABASE_PATH,
    },
    http: {
      port: env.HTTP_PORT,
      host: env.HTTP_HOST,
      publicUrl: env.PUBLIC_URL,
    },
    transport: {
      mode: env.BOT_TRANSPORT,
      webhookUrl: env.WEBHOOK_URL,
      webhookSecret: env.WEBHOOK_SECRET,
    },
    rateLimit: {
      windowMs: env.RATE_LIMIT_WINDOW_MS,
      maxRequests: env.RATE_LIMIT_MAX_REQUESTS,
    },
    market: {
      pollIntervalMs: env.MARKET_POLL_INTERVAL_MS,
      backfill: env.MARKET_BACKFILL,
      digestHourUtc: env.MARKET_DIGEST_HOUR_UTC,
    },
    isDev,
  };
}

// Format zod errors for readable output
function formatZodErrors(error: z.ZodError): string {
  const lines: string[] = [];

  for (const issue of error.issues) {
    const path = issue.path.join(".");
    lines.push(`  - ${path}: ${issue.message}`);
  }

  return lines.join("\n");
}

// Parse and validate environment, return Config or exit with errors
export function parseEnv(env: NodeJS.ProcessEnv): Config {
  const nodeEnv = env.NODE_ENV ?? "development";
  const isDev = nodeEnv !== "production";

  // MED-004: Block dangerous env vars in production (before schema validation)
  if (!isDev) {
    const foundForbidden: string[] = [];

    for (const envVar of FORBIDDEN_IN_PRODUCTION) {
      if (env[envVar]) {
        foundForbidden.push(envVar);
      }
    }

    if (foundForbidden.length > 0) {
      console.error("─".repeat(50));
      console.error("FATAL: Forbidden environment variables detected in production!");
      console.error("─".repeat(50));
      console.error("The following variables must NOT be set in production:");
      for (const v of foundForbidden) {
        console.error(`  - ${v}`);
      }
      console.error("");
      console.error("These variables are for development only and pose security risks.");
      console.error("Remove them from your environment and restart.");
      console.error("─".repeat(50));
      process.exit(1);
    }
  }

  const result = envSchema.safeParse(env);

  if (!result.success) {
    console.error("─".repeat(50));
    console.error("FATAL: Invalid environment configuration!");
    console.error("─".repeat(50));
    console.error("The following errors were found:\n");
    console.error(formatZodErrors(result.error));
    console.error("");
    console.error("Please fix these issues and restart.");
    console.error("─".repeat(50));
    process.exit(1);
  }

  return envToConfig(result.data);
}

export { envSchema };
