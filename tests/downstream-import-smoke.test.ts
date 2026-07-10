import { expect, test } from "bun:test";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = resolve(import.meta.dir, "..");

const run = (command: string, args: string[], cwd: string) => {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.status !== 0) {
    throw new Error(
      [
        `${command} ${args.join(" ")} failed with exit code ${result.status}`,
        result.stdout,
        result.stderr,
      ].join("\n"),
    );
  }

  return result;
};

const createLinkedConsumer = () => {
  const consumerRoot = mkdtempSync(join(tmpdir(), "check-shorts-consumer-"));
  const scopedNodeModules = join(consumerRoot, "node_modules", "@tscircuit");
  mkdirSync(scopedNodeModules, { recursive: true });
  symlinkSync(repoRoot, join(scopedNodeModules, "check-shorts"), "dir");

  writeFileSync(
    join(consumerRoot, "package.json"),
    JSON.stringify(
      {
        type: "module",
        dependencies: {
          "@tscircuit/check-shorts":
            "file:./node_modules/@tscircuit/check-shorts",
        },
        devDependencies: {
          typescript: "^5.9.2",
        },
      },
      null,
      2,
    ),
  );

  return consumerRoot;
};

test("downstream TypeScript consumers can statically import package exports", () => {
  run("bun", ["run", "build"], repoRoot);

  const consumerRoot = createLinkedConsumer();

  writeFileSync(
    join(consumerRoot, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          lib: ["ES2022", "DOM"],
          module: "ESNext",
          moduleResolution: "Bundler",
          strict: true,
          noEmit: true,
          skipLibCheck: false,
        },
        include: ["index.ts"],
      },
      null,
      2,
    ),
  );

  writeFileSync(
    join(consumerRoot, "index.ts"),
    [
      'import { createShortDebugSvg, renderBitmapShortDebug } from "@tscircuit/check-shorts";',
      'import type { BitmapShort, BitmapShortDebugRender, FindBitmapShortsOptions } from "@tscircuit/check-shorts";',
      "",
      "const shorts: BitmapShort[] = [];",
      'const options: FindBitmapShortsOptions = { mode: "pcb" };',
      "const render: BitmapShortDebugRender | null = null;",
      "const svg = createShortDebugSvg([], shorts);",
      "const renderDebug: typeof renderBitmapShortDebug = renderBitmapShortDebug;",
      "void options;",
      "void render;",
      "void svg;",
      "void renderDebug;",
    ].join("\n"),
  );

  const tscBin = join(repoRoot, "node_modules", ".bin", "tsc");
  run(tscBin, ["--noEmit"], consumerRoot);

  const packageJson = JSON.parse(
    readFileSync(join(repoRoot, "package.json"), "utf8"),
  );
  expect(packageJson.exports["."].types).toBe("./dist/index.d.ts");
  expect(packageJson.exports["."].import).toBe("./dist/index.js");
}, 30_000);

test("bundled CLI workflow can load package exports from consumer node_modules", () => {
  run("bun", ["run", "build"], repoRoot);

  const consumerRoot = createLinkedConsumer();
  const cliDistRoot = join(
    consumerRoot,
    "node_modules",
    "@tscircuit",
    "cli",
    "dist",
    "cli",
  );
  mkdirSync(cliDistRoot, { recursive: true });

  writeFileSync(
    join(cliDistRoot, "main.js"),
    [
      'const checkShortsPackageName = ["@tscircuit", "check-shorts"].join("/");',
      "const loadCheckShorts = async () => await import(checkShortsPackageName);",
      "const {",
      "  appendBitmapLegend,",
      "  createShortDebugSvg,",
      "  encodeRgbaPng,",
      "  renderBitmapShortDebug,",
      "} = await loadCheckShorts();",
      "if (typeof appendBitmapLegend !== 'function') throw new Error('missing appendBitmapLegend');",
      "if (typeof createShortDebugSvg !== 'function') throw new Error('missing createShortDebugSvg');",
      "if (typeof encodeRgbaPng !== 'function') throw new Error('missing encodeRgbaPng');",
      "if (typeof renderBitmapShortDebug !== 'function') throw new Error('missing renderBitmapShortDebug');",
      "const svg = createShortDebugSvg([], []);",
      "if (!svg.includes('<svg')) throw new Error('expected SVG debug output');",
      "const png = encodeRgbaPng({ width: 1, height: 1, rgba: new Uint8Array([0, 0, 0, 255]) });",
      "if (!(png instanceof Uint8Array) || png.length === 0) throw new Error('expected PNG bytes');",
      "console.log('check-shorts cli workflow loaded');",
    ].join("\n"),
  );

  const result = run("bun", [join(cliDistRoot, "main.js")], consumerRoot);
  expect(result.stdout).toContain("check-shorts cli workflow loaded");
}, 30_000);

test("static CLI import can be bundled and executed", () => {
  run("bun", ["run", "build"], repoRoot);

  const consumerRoot = createLinkedConsumer();
  const bundleOutdir = join(consumerRoot, "bundle");

  writeFileSync(
    join(consumerRoot, "static-cli-import.ts"),
    [
      "import {",
      "  appendBitmapLegend,",
      "  createShortDebugSvg,",
      "  encodeRgbaPng,",
      "  renderBitmapShortDebug,",
      '} from "@tscircuit/check-shorts";',
      "",
      "if (typeof appendBitmapLegend !== 'function') throw new Error('missing appendBitmapLegend');",
      "if (typeof createShortDebugSvg !== 'function') throw new Error('missing createShortDebugSvg');",
      "if (typeof encodeRgbaPng !== 'function') throw new Error('missing encodeRgbaPng');",
      "if (typeof renderBitmapShortDebug !== 'function') throw new Error('missing renderBitmapShortDebug');",
      "const svg = createShortDebugSvg([], []);",
      "if (!svg.includes('<svg')) throw new Error('expected SVG debug output');",
      "const png = encodeRgbaPng({ width: 1, height: 1, rgba: new Uint8Array([0, 0, 0, 255]) });",
      "if (!(png instanceof Uint8Array) || png.length === 0) throw new Error('expected PNG bytes');",
      "console.log('check-shorts static bundle loaded');",
    ].join("\n"),
  );

  run(
    "bun",
    [
      "build",
      "static-cli-import.ts",
      "--target=node",
      "--format=esm",
      "--outdir",
      bundleOutdir,
    ],
    consumerRoot,
  );

  const result = run(
    "bun",
    [join(bundleOutdir, "static-cli-import.js")],
    consumerRoot,
  );
  expect(result.stdout).toContain("check-shorts static bundle loaded");
}, 30_000);
