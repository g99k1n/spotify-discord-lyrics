import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const source = resolve(scriptDirectory, "../src/scripts/stream-media.ps1");
const destination = resolve(scriptDirectory, "../dist/scripts/stream-media.ps1");

await mkdir(dirname(destination), { recursive: true });
await copyFile(source, destination);
