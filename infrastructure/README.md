# Infrastructure

Creates Vercel projects for Church SaaS.

## Setup
```bash
pulumi config set vercel:apiToken YOUR_TOKEN --secret
pulumi stack init church-sas
```

## Deploy
```bash
pulumi up
```

## Projects

- church-sas-api-preprod
- church-sas-api-prod
- church-sas-web-preprod
- church-sas-web-prod

GitHub Actions handles deployments.