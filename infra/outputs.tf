# The only GitHub Actions secret .github/workflows/deploy.yml needs.
output "AWS_ROLE_ARN" {
  value = aws_iam_role.deploy.arn
}

output "S3_BUCKET" {
  value = aws_s3_bucket.site.bucket
}

output "CLOUDFRONT_DISTRIBUTION_ID" {
  value = aws_cloudfront_distribution.site.id
}

output "site_url" {
  value = "https://${aws_cloudfront_distribution.site.domain_name}"
}

# DNS records that prove ownership of the domain so the certificate can be issued.
output "certificate_validation_records" {
  value = {
    for o in aws_acm_certificate.site.domain_validation_options : o.domain_name => {
      type  = o.resource_record_type
      name  = o.resource_record_name
      value = o.resource_record_value
    }
  }
}

# What the domain's own DNS records should point at.
output "cloudfront_domain_name" {
  value = aws_cloudfront_distribution.site.domain_name
}
