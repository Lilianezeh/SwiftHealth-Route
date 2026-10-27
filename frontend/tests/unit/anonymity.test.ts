/** The promises to a visitor stay true after accounts (accounts phase 9, NFR-07; requirements section 6, "Kept true"):
 * no cookie, no analytics or tracking script, no request that carries cookies, and the public pages work with no login.
 * These are checks of the source, because the promise is "the code never does this". The Privacy page says the same in words
 * (InfoPages.test.tsx); this test is what keeps the words true.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(process.cwd(), "src");

function sourceFiles(folder: string): string[] {
  return readdirSync(folder).flatMap((name) => {
    const path = join(folder, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

const FILES = sourceFiles(SRC);
const read = (path: string) => readFileSync(path, "utf8");
const relative = (path: string) => path.slice(SRC.length + 1);

/** Pages a visitor opens with no account. `list-your-facility` is public too but asks for an account on purpose (FR-51). */
const PUBLIC_PAGES = ["search", "emergency", "find", "listing", "blood", "report", "about", "how-we-verify", "privacy", "terms", "contact"];

describe("no cookie and no tracking", () => {
  it("has no file that reads or writes a cookie", () => {
    const offenders = FILES.filter((path) => /document\.cookie|js-cookie|cookies\(\)|from ["']next\/headers["']/.test(read(path)));
    expect(offenders.map(relative)).toEqual([]);
  });

  it("has no analytics or tracking script, library or address", () => {
    const tracking = /gtag\(|googletagmanager|google-analytics|\bga\(|plausible|posthog|mixpanel|hotjar|fbq\(|connect\.facebook|segment\.(com|io)|amplitude|clarity\.ms|matomo|next\/script/i;
    const offenders = FILES.filter((path) => tracking.test(read(path)));
    expect(offenders.map(relative)).toEqual([]);
  });

  it("lists no analytics package in package.json", () => {
    const manifest = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const names = Object.keys({ ...manifest.dependencies, ...manifest.devDependencies });
    const analytics = names.filter((name) => /analytics|gtag|posthog|mixpanel|hotjar|segment|amplitude|plausible|sentry|datadog|logrocket/i.test(name));
    expect(analytics).toEqual([]);
  });

  it("sends every request to the API without cookies (credentials omitted) and never includes them", () => {
    const request = read(join(SRC, "lib", "api", "request.ts"));
    expect(request).toMatch(/credentials: "omit"/);
    const offenders = FILES.filter((path) => /credentials:\s*["']include["']|credentials:\s*["']same-origin["']/.test(read(path)));
    expect(offenders.map(relative)).toEqual([]);
  });

  it("keeps the login in the tab (sessionStorage) and never in localStorage, a cookie or an address", () => {
    // the file's own comment names localStorage and cookies to say it does not use them: look at the code only
    const code = read(join(SRC, "lib", "staff", "session.ts")).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    expect(code).toMatch(/sessionStorage/);
    expect(code).not.toMatch(/localStorage|document\.cookie/);
  });
});

describe("the public pages need no account", () => {
  it.each(PUBLIC_PAGES)("the %s page and its folder do not import the staff gate or the staff session", (folder) => {
    const files = FILES.filter((path) => relative(path).startsWith(`app/(public)/${folder}/`));
    expect(files.length).toBeGreaterThan(0);
    for (const path of files) {
      expect(read(path), relative(path)).not.toMatch(/StaffGate|readStaffSession|@\/lib\/staff|@\/components\/admin|@\/components\/account/);
    }
  });

  it("the home page, the public layout and the root layout do not import the staff gate either", () => {
    const files = FILES.filter((path) => /^app\/(\(home\)\/|layout\.tsx|\(public\)\/layout\.tsx)/.test(relative(path)));
    expect(files.length).toBeGreaterThan(1);
    for (const path of files) expect(read(path), relative(path)).not.toMatch(/StaffGate|@\/components\/admin|@\/components\/account/);
  });

  it("the only public page that asks for an account is list-your-facility, on purpose (FR-51)", () => {
    const pages = FILES.filter((path) => /^app\/\(public\)\/[^/]+\/page\.tsx$/.test(relative(path)));
    const askingForAnAccount = pages.filter((path) => /ListYourFacility/.test(read(path))).map(relative);
    expect(askingForAnAccount).toEqual(["app/(public)/list-your-facility/page.tsx"]);
  });
});
