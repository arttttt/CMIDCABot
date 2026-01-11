import { z } from "zod";
import { MAX_USDC_AMOUNT } from "../../../domain/constants.js";

/**
 * MED-004: Environment variables that are forbidden in production mode.
 * These variables are for development only and may contain sensitive data
 * or change bot behavior in ways that are unsafe for production.
 */
const FORBIDDEN_IN_PRODUCTION = [
  "DEV_WALLET_PRIVATE_KEY", // Development wallet private key - security risk
];

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
    SOLANA_RPC_URL: z.string().url().default("https://api.devnet.solana.com"),

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

    // DCA
    DCA_AMOUNT_USDC: z.coerce.number().positive().min(1).max(MAX_USDC_AMOUNT).default(6),
    DCA_INTERVAL_MS: z.coerce.number().int().positive().default(86400000),

    // Price
    PRICE_SOURCE: z.enum(["jupiter", "mock"]).default("jupiter"),
    JUPITER_API_KEY: z.string().optional(),

    // Rate limiting
    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
    RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(30),

    // Development only
    DEV_WALLET_PRIVATE_KEY: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const isDev = data.NODE_ENV !== "production";

    // JUPITER_API_KEY required when PRICE_SOURCE=jupiter
    if (data.PRICE_SOURCE === "jupiter" && !data.JUPITER_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "JUPITER_API_KEY is required when PRICE_SOURCE is 'jupiter'",
        path: ["JUPITER_API_KEY"],
      });
    }

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
export type PriceSource = "jupiter" | "mock";

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

export interface DcaConfig {
  amountUsdc: number;
  intervalMs: number;
}

export interface DcaWalletConfig {
  devPrivateKey?: string;
}

export interface EncryptionConfig {
  masterKey: string;
}

export interface AuthConfig {
  ownerTelegramId: number;
  dbPath: string;
}

export interface PriceConfig {
  source: PriceSource;
  jupiterApiKey?: string;
}

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

export interface Config {
  telegram: TelegramConfig;
  solana: SolanaConfig;
  database: DatabaseConfig;
  dca: DcaConfig;
  dcaWallet: DcaWalletConfig;
  encryption: EncryptionConfig;
  price: PriceConfig;
  auth: AuthConfig;
  http: HttpConfig;
  transport: TransportConfig;
  rateLimit: RateLimitConfig;
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
    dca: {
      amountUsdc: env.DCA_AMOUNT_USDC,
      intervalMs: env.DCA_INTERVAL_MS,
    },
    dcaWallet: {
      devPrivateKey: isDev ? env.DEV_WALLET_PRIVATE_KEY : undefined,
    },
    encryption: {
      masterKey: env.MASTER_ENCRYPTION_KEY,
    },
    price: {
      source: env.PRICE_SOURCE,
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
