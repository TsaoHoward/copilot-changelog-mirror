import { renderDirectory } from "./render-directory.js";
import { directoryCli } from "./directory-cli.js";

await directoryCli("render", (values) => renderDirectory(values));
