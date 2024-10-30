import fs from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import mimeType from "@burmajs/mime";
import store from "store";
/**
 * @exports
 * @module burma-static
 */
// --------------------------------------------------------------------------------------------
export interface GenerateRoutes {
  rootPath?: string;
  staticDir?: string;
  fileExt?: string[];
  warning?: boolean;
  ignore?: string[];
}
interface RouteObject {
  file: string;
  url: string;
  mime: string;
  typeofMime: string;
  base: string;
}
export interface StaticOptions extends GenerateRoutes {}

// ----------------------------------------------------------------------------------------------
/** @private */
const html404 = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>404</title>
    <style>
      main {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        color: #888;
        text-align: center;
      }
      a {
        text-decoration: none;
        padding: 7px;
        border: 1px solid #888;
        color: #888;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>404 Not Found</h1>
      <br />
      <a href="/">Home</a>
    </main>
  </body>
</html>

`;
// ==== //
/**
 * Retrieves a list of file paths matching the specified pattern.
 *
 * @param pattern - A glob pattern string to match file paths.
 * @param warning - A boolean indicating whether to suppress warning listeners.
 * @returns An array of strings representing the file paths that match the pattern.
 */
const _getFiles = (pattern: string, warning = false) => {
  const files = fs.globSync(pattern);
  if (!warning) process.removeAllListeners("warning");
  return files;
};
// -------------------------------------------
const isFile = (path: string) => fs.statSync(path).isFile();

/**
 * Creates a glob pattern string from the given directory path and optional
 * file extensions. When no extensions are given, the pattern will match all
 * files in the given directory and all its subdirectories.
 *
 * @param dirtpath - A string representing the directory path.
 * @param ext - An optional string array of file extensions.
 * @returns A string representing the glob pattern.
 */
const createPattern = (dirtpath: string, ext?: string[]) => {
  let pattern = "";
  if (!ext) {
    pattern = `${dirtpath}/**/*`;
  } else if (ext.length === 1) {
    const ex = ext.join();
    pattern = `${dirtpath}/**/*.${ex}`;
  } else {
    const ex = `{${ext.join(",")}}`;
    pattern = `${dirtpath}/**/*.${ex}`;
  }
  return pattern;
};
/**
 * Creates an array of ignored paths from the given array and a set of
 * default ignored paths.
 *
 * @param ignore - An optional string array of paths to ignore.
 * @returns An array of strings representing the ignored paths without
 * duplicates.
 */
const createIgnores = (ignore?: string[]) => {
  let igns: string[] = [];
  const ign = [
    "node_modules",
    "tsconfig.json",
    "README.md",
    "package.json",
    "package-lock.json",
    "LICENSE",
  ];
  if (ignore) {
    igns = [...ignore, ...ign];
  } else {
    igns = ign;
  }
  return [...new Set(igns)];
};
/**
 * Filters out files that are located in directories specified in the ignore set.
 *
 * @param files - An array of file paths as strings to filter.
 * @param ignsSet - A set of directory names or file paths to ignore.
 * @returns An array of file paths that are not in ignored directories and are valid files.
 */
const filterFiles = (files: string[], ignsSet: Set<string>) => {
  const fls = files.filter((file) => {
    const sgs = file.split(path.sep);
    return !sgs.some((sg) => ignsSet.has(sg));
  });
  return fls.filter(isFile);
};
/**
 * Retrieves a list of file paths in the given directory and subdirectories that
 * match the given file extensions and are not in directories to ignore.
 *
 * @param staticDir - A string representing the directory path to search for files.
 * @param fileExt - An optional string array of file extensions to match.
 * @param warning - A boolean indicating whether to suppress warning listeners.
 * @param ignore - An optional string array of directory names or file paths to ignore.
 * @returns An array of strings representing the file paths that match the pattern.
 */
const getFiles = (
  staticDir = ".",
  fileExt?: string[],
  warning = false,
  ignore?: string[],
) => {
  const cwd = process.cwd();
  const dirPath = path.join(cwd, staticDir);
  const pattern = createPattern(dirPath, fileExt);
  const _fls = _getFiles(pattern, warning);
  const ignsSet = new Set(createIgnores(ignore));
  return filterFiles(_fls, ignsSet);
};
/**
 * @memberof burma-static
 *
 * Generates an array of route objects from the given options.
 *
 * @param options - An object containing configuration options for the route
 *                  generator.
 * @param options.staticDir - The directory to search for files.
 * @param options.rootPath - The root path to serve files under.
 * @param options.warning - Whether to suppress warning listeners.
 * @param options.ignore - An array of directory names or file paths to ignore.
 * @param options.fileExt - An array of file extensions to match.
 * @returns An array of route objects with the following properties:
 *          - `file`: The absolute path to the file.
 *          - `mime`: The mime type of the file.
 *          - `typeofMime`: The type of mime as a string.
 *          - `url`: The URL path to serve the file under.
 *          - `base`: The original file name.
 */
function generateRoutes(options?: GenerateRoutes) {
  const warn = options?.warning ?? false;
  const rootpath = options?.rootPath ? `${options.rootPath}` : "/";
  const files = getFiles(
    options?.staticDir,
    options?.fileExt,
    warn,
    options?.ignore,
  );
  const mimeCache = {} as Record<
    string,
    { type: string | undefined; typeOf: string | undefined }
  >;
  const static_dir = options?.staticDir ?? ".";
  return files.reduce(
    (acc: { routes: RouteObject[] }, file) => {
      const relative = path.relative(process.cwd(), file);
      const parsed = path.parse(relative);
      const name: string = parsed.name;
      const ext = parsed.ext;
      const base = parsed.base;
      const _dir = parsed.dir;
      const _dir_name = _dir.split("/").slice(1).join("/");
      //TODO login page first
      const isLogin = base === "login.html";
      // const isIndexHtml = _dir === options?.staticDir && base === "index.html";
      const mainIndex = _dir === static_dir && base === "index.html";
      const subIndex = _dir !== static_dir && base === "index.html";
      const mainHtmls = _dir === static_dir && ext === ".html";
      const subHtmls = _dir !== static_dir && ext === ".html";
      const mainFiles = _dir === static_dir && ext !== ".html";
      const subFiles = _dir !== static_dir && ext !== ".html";
      const _mimeType = (mimeCache[ext] ??= mimeType(ext));
      let url = "";
      if (mainIndex) {
        url = rootpath;
      } else if (subIndex) {
        url = path.join(rootpath, _dir_name);
      } else if (mainHtmls) {
        url = path.join(rootpath, name);
      } else if (subHtmls) {
        url = path.join(rootpath, _dir_name, name);
      } else if (mainFiles) {
        url = path.join(rootpath, base);
      } else if (subFiles) {
        url = path.join(rootpath, _dir_name, base);
      }
      const route: RouteObject = {
        file,
        mime: _mimeType.type ?? "",
        typeofMime: _mimeType.typeOf ?? "",
        url,
        base,
      };
      return {
        ...acc,
        routes: [...acc.routes, route],
      };
    },
    { routes: [] },
  );
}
/**
 * @memberof burma-static
 *
 * Send a file to the client.
 *
 * @param {string} file - File path, relative to current working directory.
 * @param {ServerResponse} res - The response to write to.
 *
 * @example
 * import { sendFile } from "./send.js";
 * import http from "node:http";
 * http.createServer((req, res) => {
 *   sendFile("index.html", res);
 * }).listen(3000);
 */
function sendFile(file: string, res: ServerResponse): void {
  res.statusCode = 200;
  const stream = fs.createReadStream(file);
  stream.pipe(res);
}
/**
 * @memberof burma-static
 *
 * Send a 404 response to the client.
 *
 * @param {string} html - The html string to send.
 * @param {ServerResponse} res - The response to write to.
 *
 * @example
 * import { send404 } from "./send.js";
 * import http from "node:http";
 * http.createServer((req, res) => {
 *   send404("<h1>404</h1>", res);
 * }).listen(3000);
 */
function send404(html: string, res: ServerResponse): void {
  res.statusCode = 404;
  res.end(html);
}

/**
 * @memberof burma-static
 *
 * Send content to the client.
 *
 * @param {string | Buffer} content - The content to send.
 * @param {ServerResponse} res - The response to write to.
 *
 * @example
 * import { sendContent } from "./send.js";
 * import http from "node:http";
 * http.createServer((req, res) => {
 *   sendContent("<h1>Hello World</h1>", res);
 * }).listen(3000);
 */
function sendContent(content: string | Buffer, res: ServerResponse): void {
  const cont = Buffer.from(content);
  res.statusCode = 200;
  res.end(cont);
}
/**
 * @memberof burma-static
 *
 *
 * Sets up a static file server using the specified options.
 *
 * @param options - An object containing configuration options for the server.
 * @param options.staticDir - The directory to serve static files from.
 * @param options.rootPath - The root URL path to serve files under.
 * @param options.warning - Whether to suppress warning listeners.
 * @param options.ignore - An array of directory names or file paths to ignore.
 * @param options.fileExt - An array of file extensions to match.
 * @returns An asynchronous function that handles HTTP requests, serving
 *          static files or a 404 page if the file is not found.
 */
function burmaStatic(options: StaticOptions) {
  const routeObj = generateRoutes({
    staticDir: options.staticDir,
    rootPath: options.rootPath,
    warning: options.warning,
    ignore: options.ignore,
    fileExt: options.fileExt,
  });
  return async (request: IncomingMessage, response: ServerResponse) => {
    const found = routeObj.routes.find((i) => i.url === request.url);
    if (!found) {
      send404(html404, response);
    } else {
      const cached = store.get(found.url);
      if (cached !== undefined) {
        sendContent(cached, response);
        console.log(
          `${request.method} ${request.url} ${response.statusCode} (from cache)`,
        );
      } else {
        const content = await fs.promises.readFile(found.file);
        store.set(found.url, content);
        sendFile(found.file, response);
        console.log(`${request.method} ${request.url} ${response.statusCode}`);
      }
    }
  };
}

export default burmaStatic;
