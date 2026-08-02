import re
import os

files = [
    "menu.ts", "menuAssets.ts", "menuEngineering.ts", "analytics.ts",
    "corporateLeads.ts", "partnerLeads.ts", "supportTickets.ts",
    "rdPartners.ts", "payments.ts"
]

for file in files:
    with open(f"/usr/local/google/home/chandansinghr/Wellness-Foods/artifacts/api-server/src/routes/{file}", "r") as f:
        content = f.read()
    
    # Find all routes that call requireOps or requireCatalog
    routes_to_test = []
    
    # We can match `router.METHOD("path", ...` and see if the block contains `requireCatalog` or `requireOps`
    # This regex is a bit complex, but we can do it by finding `router.[a-z]+\("([^"]+)"`
    # and then checking if the next few lines contain the gate.
    
    # Actually, let's just write a generic test that asserts 401/403 for specific paths.
    # To do this safely, we can just extract the path and method for every route that contains `requireCatalog` or `requireOps`.
    blocks = re.split(r'router\.(get|post|put|delete|patch)\(', content)
    
    for i in range(1, len(blocks), 2):
        method = blocks[i]
        block = blocks[i+1]
        
        path_match = re.match(r'^"([^"]+)"', block)
        if not path_match:
            continue
        path = path_match.group(1)
        
        # We need to find the body of this route. We can approximate by looking up to the next `router.`
        # Or just look at the first 500 chars.
        body = block[:1000]
        if "requireOps" in body or "requireCatalog" in body or "requireRole" in body:
            routes_to_test.append((method, path))
            
    if not routes_to_test:
        continue
        
    test_content = f"""import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type {{ AddressInfo }} from "node:net";
import router from "./{file.replace('.ts', '')}";

test("{file} gated endpoints return 403 when unauthenticated", async () => {{
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {{
    req.isAuthenticated = (() => false) as any;
    req.log = {{ info() {{}}, warn() {{}}, error() {{}} }} as any;
    next();
  }});
  app.use(router);
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((r) => server.once("listening", () => r()));
  const {{ port }} = server.address() as AddressInfo;
  const base = `http://127.0.0.1:${{port}}`;

  try {{
"""
    for method, path in routes_to_test:
        test_path = re.sub(r':[^/]+', '123', path)
        test_path = test_path.replace('*', 'test')
        test_content += f"""    {{
      const res = await fetch(`${{base}}{test_path}`, {{ method: "{method.upper()}" }});
      assert.equal(res.status, 403, "{method.upper()} {path} should be gated");
    }}
"""
    test_content += """  } finally {
    server.close();
  }
});
"""
    with open(f"/usr/local/google/home/chandansinghr/Wellness-Foods/artifacts/api-server/src/routes/{file.replace('.ts', '.gate.test.ts')}", "w") as f:
        f.write(test_content)
        
print("Tests generated.")
