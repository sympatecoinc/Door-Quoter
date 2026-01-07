# Kill Dev Ports

Kill all processes running on ports 3000-3010.

## Execute

Run this command:

```bash
for port in {3000..3010}; do lsof -ti:$port 2>/dev/null | xargs -r kill -9; done
```

## Report

After running, verify ports are free:

```bash
ss -tlnp | grep -E ':30(0[0-9]|10)\s'
```

Report:
```
Dev ports 3000-3010 cleared.
```
