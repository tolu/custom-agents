import { appendFileSync, existsSync, truncateSync, writeFileSync } from "node:fs";

if (existsSync("reasoning.log")) {
  truncateSync("reasoning.log");
} else {
  writeFileSync("reasoning.log", "");
}

export const log = (entry: Record<string, any>) => {
  try {
    const logEntry = JSON.stringify({ timestamp: new Date().toISOString(), ...entry });
    appendFileSync("reasoning.log", logEntry + "\n");
  } catch (err) {
    console.error("Failed to write reasoning log:", err);
  }
};