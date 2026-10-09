/** Tests that the frontend runs on the Node.js major version we chose. Requirement: NFR-05 (the site keeps working).
 *
 * Node 20 reached end of life on 2026-04-30, so the frontend moved to Node 24, the Active LTS (checked against the
 * official release schedule on 2026-10-09). When we move to the next LTS, change EXPECTED_NODE_MAJOR here, the Dockerfile,
 * netlify.toml, the CI workflow and @types/node together: `bash scripts/check-node-version.sh` checks all four.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const EXPECTED_NODE_MAJOR = 24;

function readFrontendFile(relativePath: string): string {
  return readFileSync(new URL(`../../${relativePath}`, import.meta.url), "utf8");
}

describe("Node.js version", () => {
  it("is the version these tests run on", () => {
    const runningMajor = Number(process.versions.node.split(".")[0]);
    expect(runningMajor).toBe(EXPECTED_NODE_MAJOR);
  });

  it("is the version the Dockerfile builds the image from", () => {
    const dockerfile = readFrontendFile("Dockerfile");
    expect(dockerfile).toMatch(new RegExp(`^FROM node:${EXPECTED_NODE_MAJOR}-alpine`, "m"));
  });

  it("is the version of the Node type definitions", () => {
    const packageJson = JSON.parse(readFrontendFile("package.json")) as {
      devDependencies: Record<string, string>;
    };
    const typesVersion = packageJson.devDependencies["@types/node"];
    expect(typesVersion).toMatch(new RegExp(`^\\^${EXPECTED_NODE_MAJOR}\\.`));
  });

  it("is supported by the installed Next.js", () => {
    const nextPackage = JSON.parse(readFrontendFile("node_modules/next/package.json")) as {
      engines: { node: string };
    };
    // Next.js 15.5 accepts "^18.18.0 || ^19.8.0 || >= 20.0.0": any Node 20 or newer, so 24 is allowed.
    expect(nextPackage.engines.node).toContain(">= 20.0.0");
  });
});
