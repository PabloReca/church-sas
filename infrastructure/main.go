package main

import (
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"
	"github.com/pulumiverse/pulumi-vercel/sdk/go/vercel"
)

func main() {
	pulumi.Run(func(ctx *pulumi.Context) error {
		repo := "PabloReca/church-sas"

		// API Preprod
		apiPreprod, _ := vercel.NewProject(ctx, "church-sas-api-preprod", &vercel.ProjectArgs{
			Name:          pulumi.String("church-sas-api-preprod"),
			Framework:     pulumi.String("hono"),
			RootDirectory: pulumi.String("apps/api"),
			GitRepository: &vercel.ProjectGitRepositoryArgs{
				Type:             pulumi.String("github"),
				Repo:             pulumi.String(repo),
				ProductionBranch: pulumi.String("main"),
			},
		})

		// API Prod
		apiProd, _ := vercel.NewProject(ctx, "church-sas-api-prod", &vercel.ProjectArgs{
			Name:          pulumi.String("church-sas-api-prod"),
			Framework:     pulumi.String("hono"),
			RootDirectory: pulumi.String("apps/api"),
			GitRepository: &vercel.ProjectGitRepositoryArgs{
				Type:             pulumi.String("github"),
				Repo:             pulumi.String(repo),
				ProductionBranch: pulumi.String("release"),
			},
		})

		// Web Preprod
		webPreprod, _ := vercel.NewProject(ctx, "church-sas-web-preprod", &vercel.ProjectArgs{
			Name:          pulumi.String("church-sas-web-preprod"),
			Framework:     pulumi.String("vite"),
			RootDirectory: pulumi.String("apps/web"),
			GitRepository: &vercel.ProjectGitRepositoryArgs{
				Type:             pulumi.String("github"),
				Repo:             pulumi.String(repo),
				ProductionBranch: pulumi.String("main"),
			},
		})

		// Web Prod
		webProd, _ := vercel.NewProject(ctx, "church-sas-web-prod", &vercel.ProjectArgs{
			Name:          pulumi.String("church-sas-web-prod"),
			Framework:     pulumi.String("vite"),
			RootDirectory: pulumi.String("apps/web"),
			GitRepository: &vercel.ProjectGitRepositoryArgs{
				Type:             pulumi.String("github"),
				Repo:             pulumi.String(repo),
				ProductionBranch: pulumi.String("release"),
			},
		})

		ctx.Export("apiPreprodUrl", apiPreprod.Name.ApplyT(func(name string) string {
			return "https://" + name + ".vercel.app"
		}))
		ctx.Export("apiProdUrl", apiProd.Name.ApplyT(func(name string) string {
			return "https://" + name + ".vercel.app"
		}))
		ctx.Export("webPreprodUrl", webPreprod.Name.ApplyT(func(name string) string {
			return "https://" + name + ".vercel.app"
		}))
		ctx.Export("webProdUrl", webProd.Name.ApplyT(func(name string) string {
			return "https://" + name + ".vercel.app"
		}))

		return nil
	})
}
