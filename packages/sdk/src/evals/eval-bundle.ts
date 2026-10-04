import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Effect } from "effect";
import { build, type Loader, type Plugin } from "esbuild";
import { EvalDefinitionInvalid } from "./definition-errors";
import { sourceFiles } from "./source-files";

const authoringExports = [
  "export const suite = (definition) => definition;",
  `export { command } from "./command";`,
  `export { empty, files, repo } from "./source";`,
  `export { named } from "./named";`,
].join("\n");

const authoringDir = dirname(fileURLToPath(import.meta.url));

const SPHYNX_MODULE = /^sphynx-sh$/;
const ANY_MODULE = /.*/;
const localModules = [
  {
    built: "api.mjs",
    filter: /^sphynx-sh\/api$/,
    namespace: "sphynx-api-authoring",
    source: "../mock-api/index.ts",
  },
  {
    built: "api-runtime.mjs",
    filter: /^sphynx-sh\/api\/runtime$/,
    namespace: "sphynx-api-runtime",
    source: "../mock-api/runtime.ts",
  },
  {
    built: "api-context.mjs",
    filter: /^sphynx-sh\/api\/context$/,
    namespace: "sphynx-api-context",
    source: "../mock-api/context.ts",
  },
  {
    built: "validator-runtime.mjs",
    filter: /^sphynx-sh\/validators\/runtime$/,
    namespace: "sphynx-validator-runtime",
    source: "validator-runtime.ts",
  },
  {
    built: "validators.mjs",
    filter: /^sphynx-sh\/validators$/,
    namespace: "sphynx-validators",
    source: "../validators.ts",
  },
  {
    built: "cli.mjs",
    filter: /^sphynx-sh\/cli$/,
    namespace: "sphynx-cli-authoring",
    source: "../mock-cli/index.ts",
  },
  {
    built: "cli-runtime.mjs",
    filter: /^sphynx-sh\/cli\/runtime$/,
    namespace: "sphynx-cli-runtime",
    source: "../mock-cli/runtime.ts",
  },
  {
    built: "mcp.mjs",
    filter: /^sphynx-sh\/mcp$/,
    namespace: "sphynx-mcp-authoring",
    source: "../mcp/index.ts",
  },
  {
    built: "mcp-runtime.mjs",
    filter: /^sphynx-sh\/mcp\/runtime$/,
    namespace: "sphynx-mcp-runtime",
    source: "../mcp/runtime.ts",
  },
] as const;

const authoringModule: Plugin = {
  name: "sphynx-authoring",
  setup: (compiler) => {
    compiler.onResolve({ filter: SPHYNX_MODULE }, () => ({
      namespace: "sphynx-authoring",
      path: "sphynx-sh",
    }));
    for (const module of localModules) {
      compiler.onResolve({ filter: module.filter }, ({ path }) => ({
        namespace: module.namespace,
        path,
      }));
      compiler.onLoad(
        { filter: ANY_MODULE, namespace: module.namespace },
        () => {
          const source = resolve(authoringDir, module.source);
          const resolved = existsSync(source)
            ? source
            : resolve(authoringDir, module.built);
          return {
            contents: `export * from ${JSON.stringify(resolved)};`,
            loader: "js",
            resolveDir: authoringDir,
          };
        }
      );
    }
    compiler.onLoad(
      { filter: ANY_MODULE, namespace: "sphynx-authoring" },
      () => ({
        contents: authoringExports,
        loader: "js",
        resolveDir: authoringDir,
      })
    );
  },
};

const SOURCE_FILE = /\.[cm]?[jt]sx?$/;
const MODULE_LOCATION = /\bimport\.meta\.(url|dirname|filename)\b/g;

const loaders: Readonly<Record<string, Loader>> = {
  ".cjs": "js",
  ".cts": "ts",
  ".js": "js",
  ".jsx": "jsx",
  ".mjs": "js",
  ".mts": "ts",
  ".ts": "ts",
  ".tsx": "tsx",
};

const locationOf = (path: string, field: string) => {
  if (field === "url") {
    return JSON.stringify(pathToFileURL(path).href);
  }
  return JSON.stringify(field === "dirname" ? dirname(path) : path);
};

const sourceLocations: Plugin = {
  name: "sphynx-source-locations",
  setup: (compiler) => {
    compiler.onLoad(
      { filter: SOURCE_FILE, namespace: "file" },
      async ({ path }) => {
        const contents = await readFile(path, "utf8");
        if (!contents.includes("import.meta")) {
          return;
        }
        return {
          contents: contents.replace(MODULE_LOCATION, (_, field: string) =>
            locationOf(path, field)
          ),
          loader: loaders[extname(path)],
          resolveDir: dirname(path),
        };
      }
    );
  },
};

const requireFrom = (url: string) =>
  `import { createRequire as sphynxCreateRequire } from "node:module"; const require = sphynxCreateRequire(${url});`;

export const bundle = (
  contents: string,
  entry: string,
  options: {
    readonly captureSource?: boolean;
    readonly minify?: boolean;
    readonly atSource?: boolean;
  } = {}
) =>
  Effect.tryPromise({
    try: () =>
      build({
        absWorkingDir: process.cwd(),
        bundle: true,
        banner: {
          js: requireFrom(
            options.atSource
              ? JSON.stringify(pathToFileURL(entry).href)
              : "import.meta.url"
          ),
        },
        format: "esm",
        metafile: true,
        minify: options.minify,
        outfile: resolve(dirname(entry), "sphynx-bundle.mjs"),
        sourcemap: options.captureSource ? "external" : false,
        platform: "node",
        resolveExtensions: [".ts", ".mjs", ".js", ".cjs", ".json"],
        plugins: options.atSource
          ? [authoringModule, sourceLocations]
          : [authoringModule],
        stdin: {
          contents,
          resolveDir: process.cwd(),
          sourcefile: "sphynx-eval-entry.ts",
        },
        target: "node18",
        treeShaking: true,
        write: false,
      }).then((result) => ({
        inputs: Object.keys(result.metafile?.inputs ?? {}).map((path) =>
          resolve(path)
        ),
        source:
          result.outputFiles.find((file) => file.path.endsWith(".mjs"))?.text ??
          "",
        ...(options.captureSource
          ? {
              sourceFiles: sourceFiles(
                result.outputFiles.find((file) => file.path.endsWith(".map"))
                  ?.text ?? "",
                entry
              ),
            }
          : {}),
      })),
    catch: (cause) =>
      new EvalDefinitionInvalid({
        cause,
        reason: `Could not compile ${entry}`,
      }),
  });
