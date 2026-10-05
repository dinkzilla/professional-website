variable "aws_region" {
  description = "Region for the S3 bucket. CloudFront and IAM are global."
  type        = string
  default     = "us-east-1"
}

variable "name" {
  description = "Name (and Name/Project tag value) applied to every resource. The site bucket is named `<name>-site` (bucket names are global; the bare name was taken)."
  type        = string
  default     = "professional-website"
}

variable "github_repo" {
  description = "GitHub repository allowed to assume the deploy role (owner/name)."
  type        = string
  default     = "dinkzilla/professional-website"
}

variable "github_branch" {
  description = "Branch whose workflow runs may deploy."
  type        = string
  default     = "master"
}

variable "domain_names" {
  description = "Custom domains the site is served on. The first is the certificate's primary name."
  type        = list(string)
  default     = ["mdinkel.com", "www.mdinkel.com"]
}
