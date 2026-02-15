terraform {
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
  }
}

# ── Variables ────────────────────────────────────────────────────────────────

variable "cloudflare_api_token" {
  type      = string
  sensitive = true
}

variable "cloudflare_account_id" {
  type      = string
  sensitive = true
}

variable "domain" {
  type    = string
  default = "oru.sh"
}

variable "github_owner" {
  type    = string
  default = "tchayen"
}

variable "github_repo" {
  type    = string
  default = "oru"
}

variable "project_name" {
  type    = string
  default = "oru"
}

# ── Provider ─────────────────────────────────────────────────────────────────

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

# ── Data sources ─────────────────────────────────────────────────────────────

data "cloudflare_zone" "site" {
  name = var.domain
}

# ── Pages project ────────────────────────────────────────────────────────────

resource "cloudflare_pages_project" "site" {
  account_id        = var.cloudflare_account_id
  name              = var.project_name
  production_branch = "main"

  source {
    type = "github"
    config {
      owner                         = var.github_owner
      repo_name                     = var.github_repo
      production_branch             = "main"
      deployments_enabled           = true
      production_deployment_enabled = true
      preview_deployment_setting    = "all"
    }
  }

  build_config {
    build_command   = "pnpm run build"
    destination_dir = "dist"
    root_dir        = "site"
  }

  deployment_configs {
    production {
      fail_open = true
      environment_variables = {
        NODE_VERSION = "25"
      }
    }
    preview {
      fail_open = true
      environment_variables = {
        NODE_VERSION = "25"
      }
    }
  }
}

# ── Custom domain ────────────────────────────────────────────────────────────

resource "cloudflare_pages_domain" "apex" {
  account_id   = var.cloudflare_account_id
  project_name = cloudflare_pages_project.site.name
  domain       = var.domain
}

# ── DNS ──────────────────────────────────────────────────────────────────────

resource "cloudflare_record" "apex" {
  zone_id = data.cloudflare_zone.site.id
  name    = "@"
  content = "${var.project_name}.pages.dev"
  type    = "CNAME"
  proxied = true
}

# ── Outputs ──────────────────────────────────────────────────────────────────

output "pages_url" {
  value = "https://${var.project_name}.pages.dev"
}

output "custom_domain" {
  value = "https://${var.domain}"
}
