const baseUrl = process.env.SMOKE_BASE_URL ?? process.env.APP_BASE_URL ?? "http://127.0.0.1:6001";

const checks = [
  { name: "home", path: "/", expectedStatus: 200, text: "COSTAATT Admissions Letters" },
  { name: "login", path: "/login", expectedStatus: 200, text: "COSTAATT Admissions Letters" },
  { name: "health", path: "/api/health", expectedStatus: 200, json: true }
];

let failed = false;

async function assertStaticJavaScriptChunks(checkName, html) {
  const chunkPaths = [
    ...html.matchAll(/(?:src|href)="(?<path>\/_next\/static\/chunks\/[^"]+\.js)"/g)
  ]
    .map((match) => match.groups?.path)
    .filter(Boolean)
    .filter((path, index, paths) => paths.indexOf(path) === index);

  if (chunkPaths.length === 0) {
    failed = true;
    console.error(`${checkName}: no Next.js JavaScript chunks found in HTML`);
    return;
  }

  for (const path of chunkPaths) {
    const response = await fetch(new URL(path, baseUrl));
    if (!response.ok) {
      failed = true;
      console.error(`${checkName}: static JavaScript chunk ${path} returned ${response.status}`);
    }
  }
}

for (const check of checks) {
  const url = new URL(check.path, baseUrl);
  const response = await fetch(url);
  const bodyText = await response.text();

  if (response.status !== check.expectedStatus) {
    failed = true;
    console.error(`${check.name}: expected ${check.expectedStatus}, got ${response.status}`);
    console.error(bodyText.slice(0, 1000));
    continue;
  }

  let body = bodyText;
  if (check.json) {
    try {
      body = JSON.parse(bodyText);
    } catch {
      failed = true;
      console.error(`${check.name}: expected JSON response`);
      console.error(bodyText.slice(0, 1000));
      continue;
    }
  }

  if (check.text && typeof body === "string" && !body.includes(check.text)) {
    failed = true;
    console.error(`${check.name}: missing expected text "${check.text}"`);
    continue;
  }

  if (check.json && !body.ok) {
    failed = true;
    console.error(`${check.name}: health check is not ok`, JSON.stringify(body));
    if (body.checks) {
      console.error(JSON.stringify(body.checks, null, 2));
    }
    continue;
  }

  if (!check.json && typeof body === "string") {
    await assertStaticJavaScriptChunks(check.name, body);
  }

  console.log(`${check.name}: ok`);
}

if (failed) process.exit(1);
