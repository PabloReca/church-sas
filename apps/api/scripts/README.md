# Scripts

## Create Master Admin

Creates the first global administrator. Only works on empty admin table (safety check).

### Development

```bash
# Set environment variable
export MASTER_ADMIN_EMAIL="admin@company.com"

# Run script
bun run create-master-admin
```

### Production / Kubernetes

Use as init container:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: api
spec:
  initContainers:
    - name: init-admin
      image: your-api:latest
      command: ["bun", "run", "scripts/create-master-admin.ts"]
      env:
        - name: MASTER_ADMIN_EMAIL
          value: "admin@company.com"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: url
  containers:
    - name: api
      image: your-api:latest
      # ... rest of config
```

### Notes

- Script exits with code 0 if admins already exist (safe for multiple runs)
- Master admin can sign in via Google OAuth
- Additional admins must be added through the admin panel
