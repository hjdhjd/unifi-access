/* Copyright(C) 2019-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * credentials.ts: Discovery, validation, and normalization of the ufa.json credentials the CLI connects with.
 */
import { CliError } from "./shared.ts";
import type { ConnectIdentity } from "../../index.ts";
import { homedir } from "node:os";
import path from "node:path";
import { readFile } from "node:fs/promises";

/**
 * The normalized credentials the CLI connects with. `host` is the bare address `AccessClient.connect` expects (no scheme, port preserved) - we accept the documented
 * `controller` form in the file, which may carry an `https://` scheme, and normalize it here, so the connect path never has to think about schemes. `identity` is the
 * library's own {@link ConnectIdentity} union, composed at the loader from whatever the file supplies - a credential pair, a token, or both - so the identity is typed
 * end-to-end and the connect path spreads it without a cast. `verifyTls` is the file's strict-TLS opt-in, carried through to the connect options under the name the
 * library gives it.
 *
 * @category CLI
 */
export interface UfaCredentials {

  host: string;
  identity: ConnectIdentity;
  verifyTls?: boolean;
}

/**
 * Options for {@link loadCredentials}. The defaults read the real working directory and home directory; tests override them to point at a temporary fixture without
 * touching the operator's real `~/.ufa.json`.
 *
 * @category CLI
 */
export interface LoadCredentialsOptions {

  cwd?: string;
  home?: string;
}

/* The credentials file's on-disk shape. `controller` is the documented field name (a hostname, ip, or full URL); we translate it to the normalized `host` on load.
 * `tokens` is keyed by the UniFi application a token was issued for, so a sibling application's token sits beside the Access one without the file's shape changing,
 * and the loader hands the `access` entry to the library as the bare token its identity union expects - the qualification is the file's business, not the API's.
 * The identities are individually optional in the file - a credential pair, a token, or both - and the loader is where that any-of rule is enforced.
 */
interface CredentialsFile {

  controller: string;
  password?: string;
  tokens?: { access?: string };
  username?: string;
  verifyTls?: boolean;
}

// The file's string-valued fields, which are the ones requireField answers for. Derived from the shape rather than restated, so a field joins the set by its own
// type, and the map-valued and boolean fields - each of which has its own reader below - cannot be asked for here.
type CredentialsStringField = { [K in keyof CredentialsFile]-?: NonNullable<CredentialsFile[K]> extends string ? K : never }[keyof CredentialsFile];

// Normalize the configured controller address to the bare host[:port] the connect path wants. A value carrying a scheme is parsed as a URL and reduced to its host
// (scheme and path dropped, port kept); a bare value has any trailing path stripped. This is what lets ufa.json carry either "https://10.0.0.1" or "10.0.0.1" and
// behave identically.
function normalizeHost(controller: string): string {

  const trimmed = controller.trim();

  if(/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {

    try {

      return new URL(trimmed).host;
    } catch(error) {

      throw new CliError("The controller address in the ufa.json configuration is not a valid URL.", { cause: error });
    }
  }

  return trimmed.replace(/\/.*$/, "");
}

// Read a candidate file, returning its text or null when the file simply is not there (the expected "try the next location" case). Any other read failure is a real
// problem - a permission error, a directory where a file was expected - and surfaces as a CliError rather than being silently skipped.
async function readIfPresent(file: string): Promise<string | null> {

  try {

    return await readFile(file, "utf8");
  } catch(error) {

    if((error as NodeJS.ErrnoException).code === "ENOENT") {

      return null;
    }

    throw new CliError("Unable to read the ufa.json configuration at " + file + ".", { cause: error });
  }
}

// Pull a required, non-empty string field out of the parsed file, or fail with a message that names both the field and where the file came from. Centralized so every
// required field is validated identically.
function requireField(record: Record<string, unknown>, key: CredentialsStringField, source: string): string {

  const value = record[key];

  if((typeof value !== "string") || (value.length === 0)) {

    throw new CliError("The ufa.json configuration at " + source + " is missing the required \"" + key + "\" field.");
  }

  return value;
}

/* Pull the Access application's token out of the file's `tokens` map. A map that is present must be an object, and an entry that is present must be a non-empty
 * string; both are named as the operator wrote them, because a mistake read as "no token at all" would surface later as a puzzling refusal to run an official
 * command rather than here as the typo it is. An absent map and a map with no `access` entry are the same answer - this file supplies no token.
 */
function readAccessToken(record: Record<string, unknown>, source: string): string | undefined {

  const tokens = record["tokens"];

  if(tokens === undefined) {

    return undefined;
  }

  if((typeof tokens !== "object") || (tokens === null) || Array.isArray(tokens)) {

    throw new CliError("The ufa.json configuration at " + source + " must express its \"tokens\" field as an object keyed by UniFi application.");
  }

  if(!("access" in tokens)) {

    return undefined;
  }

  const access = tokens.access;

  if((typeof access !== "string") || (access.length === 0)) {

    throw new CliError("The ufa.json configuration at " + source + " is missing the required \"tokens.access\" field.");
  }

  return access;
}

// Read the strict-TLS opt-in. A value that is present must be a boolean rather than anything that could be coerced into one: coercion would read the string "false"
// as an opt-in, which is the one misreading that silently changes how the connection is trusted.
function readVerifyTls(record: Record<string, unknown>, source: string): boolean | undefined {

  const value = record["verifyTls"];

  if(value === undefined) {

    return undefined;
  }

  if(typeof value !== "boolean") {

    throw new CliError("The ufa.json configuration at " + source + " must express its \"verifyTls\" field as a boolean.");
  }

  return value;
}

/* Compose the library's own identity union from what the file supplies. The rules mirror the union's shape: a credential pair must be complete - a username with no
 * password (or the reverse) describes no way of authenticating, so the missing half is named rather than the pair silently dropped - a token entry that is present
 * must be non-empty, and at least one identity must exist. Composing here, at the loader, is what makes the identity typed end-to-end: three independent optionals
 * could never satisfy the union's `never` members, and the loader is where the file's shape becomes the library's shape.
 */
function composeIdentity(record: Record<string, unknown>, source: string): ConnectIdentity {

  const hasUsername = record["username"] !== undefined;
  const hasPassword = record["password"] !== undefined;
  const token = readAccessToken(record, source);

  // A half-supplied pair is a mistake to name, never a fall-through to token-only behavior the operator did not ask for.
  if(hasUsername !== hasPassword) {

    throw new CliError("The ufa.json configuration at " + source + " is missing the required \"" + (hasUsername ? "password" : "username") +
      "\" field to complete its credential pair.");
  }

  if(!hasUsername && (token === undefined)) {

    throw new CliError("The ufa.json configuration at " + source + " must carry an identity: a \"username\" and \"password\" pair, a \"tokens.access\" entry, or " +
      "both.");
  }

  if(hasUsername && (token !== undefined)) {

    return { password: requireField(record, "password", source), token, username: requireField(record, "username", source) };
  }

  if(token !== undefined) {

    return { token };
  }

  return { password: requireField(record, "password", source), username: requireField(record, "username", source) };
}

/**
 * Locate, parse, validate, and normalize the CLI credentials. The discovery order is `./ufa.json` in the working directory first, then `~/.ufa.json` in the home
 * directory. The first file that exists wins; a malformed or incomplete file is a hard error rather than a fall-through to the next location, because a
 * present-but-broken file is a mistake the operator wants told about, not masked.
 *
 * @param opts - Optional working-directory and home-directory overrides (defaults to the real ones).
 *
 * @returns The normalized credentials.
 *
 * @throws {@link CliError} when no configuration is found, or when the one found is unreadable, malformed, missing a field, or carries no identity.
 *
 * @category CLI
 */
export async function loadCredentials(opts: LoadCredentialsOptions = {}): Promise<UfaCredentials> {

  const cwd = opts.cwd ?? process.cwd();
  const home = opts.home ?? homedir();
  const candidates = [ path.join(cwd, "ufa.json"), path.join(home, ".ufa.json") ];

  let raw: string | null = null;
  let source = "";

  for(const file of candidates) {

    // Sequential by intent: we probe the locations in priority order and stop at the first that exists, so reading them concurrently would be both wasteful and wrong.
    // eslint-disable-next-line no-await-in-loop
    raw = await readIfPresent(file);

    if(raw !== null) {

      source = file;

      break;
    }
  }

  if(raw === null) {

    throw new CliError("No ufa.json configuration was found. Create ./ufa.json or ~/.ufa.json with a \"controller\" field and an identity: a \"username\" and " +
      "\"password\" pair, a \"tokens.access\" entry, or both.");
  }

  let parsed: unknown;

  try {

    parsed = JSON.parse(raw);
  } catch(error) {

    throw new CliError("The ufa.json configuration at " + source + " is not valid JSON.", { cause: error });
  }

  if((typeof parsed !== "object") || (parsed === null)) {

    throw new CliError("The ufa.json configuration at " + source + " must be a JSON object.");
  }

  const record = parsed as Record<string, unknown>;
  const verifyTls = readVerifyTls(record, source);

  return { host: normalizeHost(requireField(record, "controller", source)), identity: composeIdentity(record, source),
    ...((verifyTls !== undefined) && { verifyTls }) };
}
