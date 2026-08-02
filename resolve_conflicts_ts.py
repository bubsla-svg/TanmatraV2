import re

with open("artifacts/api-server/src/routes/openApiContract.ts", 'r') as f:
    content = f.read()

# Replace Conflict 1: version
content = re.sub(r'<<<<<<< HEAD\n\s*version: "1\.2\.0",\n=======\n\s*version: "1\.3\.0",\n>>>>>>> [^\n]+\n', '    version: "1.3.0",\n', content)

# Replace Conflict 2: paths
head_paths = """      get: {
        summary: "Get menu catalog SKUs and committed plans",
        responses: {
          "200": { description: "Verified SKU catalog list with committed weekly rates" },
        },
      },
    },
    "/auth/refresh": {
      post: {
        summary: "Silent background session refresh and single-use token rotation",
        responses: {
          "200": { description: "Token refreshed and rotated successfully" },
          "401": { description: "Session expired or token reuse compromise detected" },
        },
      },
    },
    ...OPS_PATHS,
    ...ADMIN_PATHS,"""
content = re.sub(r'<<<<<<< HEAD\n.*?=======\n.*?\.\.\.ADMIN_PATHS,\n>>>>>>> [^\n]+\n', head_paths + '\n', content, flags=re.DOTALL)

# Replace Conflict 3: functions
content = re.sub(r'<<<<<<< HEAD\n\s*\* Step 1: GET /api/v1/openapi\.json\n=======\n(.*?)>>>>>>> [^\n]+\n', r'\1', content, flags=re.DOTALL)

# Replace Conflict 4: GET /v1/changelog
content = re.sub(r'<<<<<<< HEAD\n\s*\* Step 3: GET /api/v1/changelog\n=======\n(.*?)>>>>>>> [^\n]+\n', r'\1', content, flags=re.DOTALL)

# Replace Conflict 5: currentVersion
content = re.sub(r'<<<<<<< HEAD\n\s*currentVersion: "1\.2\.0",\n=======\n\s*currentVersion: "1\.3\.0",\n>>>>>>> [^\n]+\n', '    currentVersion: "v1.3.0",\n', content)

# Replace Conflict 6: Deprecation Guard
content = re.sub(r'<<<<<<< HEAD\n\s*\* Step 2 & 3: Deprecation Guard Middleware\n\s*\* Injects Deprecation and Sunset headers for sunsetting API versions\.\n=======\n(.*?)>>>>>>> [^\n]+\n', r'\1', content, flags=re.DOTALL)

with open("artifacts/api-server/src/routes/openApiContract.ts", 'w') as f:
    f.write(content)
