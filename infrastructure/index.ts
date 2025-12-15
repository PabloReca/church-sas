import * as pulumi from "@pulumi/pulumi";
import * as vercel from "@pulumiverse/vercel";

const repo = "PabloReca/church-sas";

// API Preprod
const apiPreprod = new vercel.Project("church-sas-api-preprod", {
  name: "church-sas-api-preprod",
  framework: "other",
  rootDirectory: "apps/api",
  gitRepository: {
    type: "github",
    repo: repo,
    productionBranch: "main"
  },
});

// API Prod
const apiProd = new vercel.Project("church-sas-api-prod", {
  name: "church-sas-api-prod",
  framework: "other",
  rootDirectory: "apps/api",
  gitRepository: {
    type: "github",
    repo: repo,
    productionBranch: "release"
  },
});

// Web Preprod
const webPreprod = new vercel.Project("church-sas-web-preprod", {
  name: "church-sas-web-preprod",
  framework: "vite",
  rootDirectory: "apps/web",
  gitRepository: {
    type: "github",
    repo: repo,
    productionBranch: "main"
  },
});

// Web Prod
const webProd = new vercel.Project("church-sas-web-prod", {
  name: "church-sas-web-prod",
  framework: "vite",
  rootDirectory: "apps/web",
  gitRepository: {
    type: "github",
    repo: repo,
    productionBranch: "release"
  },
});

// Export URLs
export const apiPreprodUrl = pulumi.interpolate`https://${apiPreprod.name}.vercel.app`;
export const apiProdUrl = pulumi.interpolate`https://${apiProd.name}.vercel.app`;
export const webPreprodUrl = pulumi.interpolate`https://${webPreprod.name}.vercel.app`;
export const webProdUrl = pulumi.interpolate`https://${webProd.name}.vercel.app`;
