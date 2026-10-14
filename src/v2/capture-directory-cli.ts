import { captureDirectory } from "./capture-directory.js";
import { directoryCli } from "./directory-cli.js";
import { DEFAULT_FEED } from "./discovery.js";

await directoryCli("capture", (values) =>
  captureDirectory({
    ...values,
    feedUrl: values.feedUrl ?? DEFAULT_FEED,
    ...(process.env.COPILOT_CAPTURE_NOW
      ? { now: () => new Date(process.env.COPILOT_CAPTURE_NOW!) }
      : {}),
  }),
);
