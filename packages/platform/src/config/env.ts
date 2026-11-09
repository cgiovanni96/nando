import { config } from "dotenv";

/**
 * Carica `.env` dalla cwd o dalla radice del repository.
 * In produzione le variabili arrivano dal processo: dotenv non sovrascrive.
 */
export function loadEnv(): void {
  config({ path: [".env", "../../.env"], quiet: true });
}
