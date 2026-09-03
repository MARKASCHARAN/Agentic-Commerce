import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export const env = {
  nodeEnv: optional("NODE_ENV", "development"),

  server: {
    port: Number(optional("PORT", "3000")),
    host: optional("HOST", "0.0.0.0"),
  },

  models: {
    primaryProvider: optional("PRIMARY_MODEL_PROVIDER", "groq"),
    fallbackProvider: optional("FALLBACK_MODEL_PROVIDER", "openai"),
  },

  database: {
    url: process.env.DATABASE_URL,
  },

  redis: {
    url: process.env.REDIS_URL,
  },

  providers: {
    groqApiKey: process.env.GROQ_API_KEY,
    openaiApiKey: process.env.OPENAI_API_KEY,
    razorpayKeyId: process.env.RAZORPAY_KEY_ID,
    razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET,
    razorpayWebhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
    resendApiKey: optional("RESEND_API_KEY", ""),
  },
} as const;