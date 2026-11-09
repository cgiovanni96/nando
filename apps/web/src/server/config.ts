import { config } from "dotenv";
import { z } from "zod";

const webConfigSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    API_URL: z.url(),
    INTERNAL_TOKEN: z.string().min(16),
    PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  })
  .strict();

export type WebConfig = z.infer<typeof webConfigSchema>;

let cached: WebConfig | null = null;

export function getWebConfig(): WebConfig {
  if (cached) return cached;

  config({ path: [".env", "../../.env"], quiet: true });

  const result = webConfigSchema.safeParse({
    NODE_ENV: process.env.NODE_ENV,
    API_URL: process.env.API_URL,
    INTERNAL_TOKEN: process.env.INTERNAL_TOKEN,
    PORT: process.env.PORT,
  });

  if (!result.success) {
    throw new Error(`Configurazione web non valida:\n${z.prettifyError(result.error)}`);
  }

  cached = result.data;
  return cached;
}
