#!/usr/bin/env node
/* Copyright(C) 2019-2025, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * ufa.ts: UniFi Access API command line utility.
 */
import { existsSync, readFileSync } from "fs";
import { AccessApi } from "../index.js";
import { homedir } from "os";
import util from "util";

// Create a new Access API instance.
const ufa = new AccessApi();

// Log utilities.
const log = {

  /* eslint-disable no-console */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  debug: (message: string, ...parameters: unknown[]): void => { /* No debug logging by default. */ },
  error: (message: string, ...parameters: unknown[]): void => console.error(util.format(message, ...parameters)),
  info: (message: string, ...parameters: unknown[]): void => console.log(util.format(message, ...parameters)),
  warn: (message: string, ...parameters: unknown[]): void => console.log(util.format(message, ...parameters))
  /* eslint-enable no-console */
};

// Read our credentials.
let config;

try {

  // We look for credentials in the local directory as well as in the user's home directory.
  const configFile = [ "ufa.json", homedir() + "/.ufa.json" ].find(path => existsSync(path));

  if(!configFile) {

    throw new Error;
  }

  // Credentials must be in JSON form with properties for the controller, username, and password.
  config = JSON.parse(readFileSync(configFile, "utf8"));

  if(!config.controller || !config.username || !config.password) {

    throw new Error;
  }
} catch(e) {

  // Inform the user we don't know what to connect to.
  log.error("No credentials found in ./ufa.json or ~/.ufa.json. Credentials must be in JSON form with properties for controller, username, and password defined.");
  usage();
}

// Login to the Access controller.
if(!(await ufa.login(config.controller, config.username, config.password))) {

  log.error("Invalid login credentials.");
  process.exit(0);
};

// Bootstrap the controller.
if(!(await ufa.getBootstrap())) {

  log.error("Unable to bootstrap the Access controller.");
  process.exit(0);
}

// Command line processing.
switch(process.argv.length) {

  case 0:
  case 1:
  case 2:

    usage();

    break;

  default:

    switch(process.argv[2]?.toLowerCase()) {

      // Output the bootstrap.
      case "bootstrap":

        // Output the bootstrap JSON and we're done.
        process.stdout.write(util.inspect(ufa.bootstrap, { colors: true, depth: null, sorted: true }) + "\n", () => process.exit(0));

        break;

      // Output the controller endpoint.
      case "controller":

        // Output the controller JSON and we're done.
        process.stdout.write(util.inspect(ufa.controller, { colors: true, depth: null, sorted: true }) + "\n", () => process.exit(0));

        break;

      // Output the devices.
      case "devices":

        // Output the devices JSON and we're done.
        process.stdout.write(util.inspect(ufa.devices, { colors: true, depth: null, sorted: true }) + "\n", () => process.exit(0));

        break;

      // Output the doors.
      case "doors":

        // Output the doors JSON and we're done.
        process.stdout.write(util.inspect(ufa.doors, { colors: true, depth: null, sorted: true }) + "\n", () => process.exit(0));

        break;

      // Output realtime events.
      case "events":

        ufa.on("message", (packet: Record<string, string>) => {

          if(process.argv.length === 5) {

            if(!["event", "event_object_id"].includes(process.argv[3])) {

              return;
            }

            if(packet[process.argv[3]]?.toLowerCase() !== process.argv[4]?.toLowerCase()) {

              return;
            }
          }

          log.info(util.inspect(packet, { colors: true, depth: null, sorted: true }));
        });

        break;

      // Output the floors.
      case "floors":

        // Output the floors JSON and we're done.
        process.stdout.write(util.inspect(ufa.floors, { colors: true, depth: null, sorted: true }) + "\n", () => process.exit(0));

        break;

      // Restart devices.
      case "restart":

        if(process.argv[3] !== "devices") {

          usage();
        }

        // Restart every device.
        for(const device of ufa.devices?.filter(x => !x.is_rebooting && x.is_connected) ?? []) {

          //eslint-disable-next-line no-await-in-loop
          const response = await ufa.retrieve(ufa.getApiEndpoint("device") + "/" + device.unique_id + "/restart", { body: JSON.stringify({}), method: "PUT" });

          if(!response?.ok) {

            log.error("%s: unable to reboot: %s", ufa.getDeviceName(device), response);

            break;
          }

          log.info("%s: restarted.", ufa.getDeviceName(device));
        }

        process.exit(0);

        break;

      // Unknown command.
      default:

        usage();

        break;
    };

    break;
}

// Usage information.
function usage(): void {

  log.error("Usage: %s bootstrap", process.argv[1]);
  log.error("Usage: %s controller", process.argv[1]);
  log.error("Usage: %s devices", process.argv[1]);
  log.error("Usage: %s doors", process.argv[1]);
  log.error("Usage: %s events [event | event_object_id] [value] (all parameters are case-sensitive)", process.argv[1]);
  log.error("Usage: %s floors", process.argv[1]);
  log.error("Usage: %s restart devices", process.argv[1]);
  log.error("");

  // If we're bootstrapped, we also want to inform users what the various device identifiers are to make filtering events easier.
  if(ufa.bootstrap) {

    if(ufa.devices?.length) {

      log.error("Devices:");
      ufa.devices.map(x => log.error("  %s => %s", (x.alias || x.name) ?? x.display_model, x.unique_id));
    }
  }

  process.exit(1);
}
