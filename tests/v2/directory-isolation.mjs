import { register } from "node:module";
register(new URL("./directory-isolation-loader.mjs", import.meta.url), {
  data: {
    mode: process.env.COPILOT_ISOLATION_MODE,
    log: process.env.COPILOT_ISOLATION_LOG,
  },
});
