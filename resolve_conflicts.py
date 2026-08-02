import re

def resolve_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()
    
    # We will use a regex to find conflict blocks and replace them.
    # For openApiContract.test.ts, we want to always take 'theirs' (the bottom part)
    if 'test.ts' in filepath:
        # Pattern to match conflict blocks
        pattern = re.compile(r'<<<<<<< HEAD\n(.*?)=======\n(.*?)>>>>>>> [^\n]+\n', re.DOTALL)
        resolved = pattern.sub(r'\2', content)
        with open(filepath, 'w') as f:
            f.write(resolved)
    else:
        # For openApiContract.ts, we need custom resolution
        # Let's just output the file as is for manual inspection if needed, or we can write specific replacement logic
        pass

resolve_file("artifacts/api-server/src/routes/openApiContract.test.ts")
