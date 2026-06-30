const baseUrl = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3000";

const checks = [
  { name: "home", path: "/", expectedStatus: 200, text: "COSTAATT Admissions Letters" },
  { name: "login", path: "/login", expectedStatus: 200, text: "COSTAATT Admissions Letters" },
  { name: "health", path: "/api/health", expectedStatus: 200, json: true }
];

let failed = false;

for (const check of checks) {
  const url = new URL(check.path, baseUrl);
  const response = await fetch(url);
  const body = check.json ? await response.json() : await response.text();

  if (response.status !== check.expectedStatus) {
    failed = true;
    console.error(`${check.name}: expected ${check.expectedStatus}, got ${response.status}`);
    continue;
  }

  if (check.text && typeof body === "string" && !body.includes(check.text)) {
    failed = true;
    console.error(`${check.name}: missing expected text "${check.text}"`);
    continue;
  }

  if (check.json && !body.ok) {
    failed = true;
    console.error(`${check.name}: health check is not ok`, JSON.stringify(body));
    continue;
  }

  console.log(`${check.name}: ok`);
}

if (failed) process.exit(1);
