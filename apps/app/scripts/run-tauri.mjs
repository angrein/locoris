import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(scriptDir, "..");
const tauriCommand = process.argv[2] ?? "dev";
const tauriArgs = process.argv.slice(3);

const env = {
  ...process.env,
  LOCORIS_DESKTOP_BUILD: "true"
};

const updaterKeyDirectories = [
  env.TAURI_UPDATER_KEY_DIR,
  path.join(os.homedir(), ".locoris-updater"),
  path.resolve(appDir, "../../..", ".locoris-updater")
].filter(Boolean);

const keyPath =
  env.TAURI_SIGNING_PRIVATE_KEY_PATH ||
  updaterKeyDirectories
    .map((directory) => path.join(directory, "locoris-updater.key"))
    .find((candidatePath) => existsSync(candidatePath));
const passwordPath =
  env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD_PATH ||
  updaterKeyDirectories
    .map((directory) => path.join(directory, "password.txt"))
    .find((candidatePath) => existsSync(candidatePath));

if (!env.TAURI_SIGNING_PRIVATE_KEY && existsSync(keyPath)) {
  env.TAURI_SIGNING_PRIVATE_KEY = readFileSync(keyPath, "utf8");
}

if (!env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD && existsSync(passwordPath)) {
  env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD = readFileSync(passwordPath, "utf8").trim();
}

const needsBuildConfigOverride =
  tauriCommand === "build" &&
  (!env.TAURI_SIGNING_PRIVATE_KEY || !env.TAURI_SIGNING_PRIVATE_KEY_PASSWORD);

if (needsBuildConfigOverride) {
  tauriArgs.push("--config", "src-tauri/tauri.local-build.conf.json");
  console.warn(
    "[locoris] Updater signing key was not found. Building desktop bundles without updater artifacts for this local run."
  );
}

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const child = spawn(
  npmCommand,
  ["exec", "tauri", "--", tauriCommand, ...tauriArgs],
  {
    cwd: appDir,
    env,
    stdio: "inherit"
  }
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
