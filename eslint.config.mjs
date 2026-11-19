/* Copyright(C) 2017-2026, HJD (https://github.com/hjdhjd). All rights reserved.
 *
 * eslint.config.mjs: The library's lint configuration - homebridge-plugin-utils' shared preset, applied to this file and the TypeScript sources.
 */
import hbPluginUtils from "homebridge-plugin-utils/eslint";

export default hbPluginUtils({

  allowDefaultProject: ["eslint.config.mjs"],
  js: ["eslint.config.mjs"],
  ts: ["src/**/*.ts"]
});
