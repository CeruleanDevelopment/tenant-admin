import { rm } from "fs/promises";

const targets = [".next"];

for (const target of targets) {
  try {
    await rm(target, { recursive: true, force: true });
    console.log(`[clean-next] removed ${target}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[clean-next] could not remove ${target}: ${message}`);
  }
}