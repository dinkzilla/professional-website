# Infrastructure

S3 + CloudFront hosting for the site, plus an IAM role that GitHub Actions
assumes via OIDC to deploy. Every resource is named and tagged `professional-website`.

The site is prerendered to one HTML file per page, so a CloudFront Function
(`rewrite.js`) maps clean URLs like `/blog` onto `blog.html`, and unknown
paths get `404.html`.

## One-time bootstrap

Terraform state lives in S3, and Terraform can't manage the bucket that holds
its own state, so that bucket has to be created by hand first:

```sh
aws s3api create-bucket --bucket professional-website-tfstate --region us-east-1
aws s3api put-bucket-versioning --bucket professional-website-tfstate --versioning-configuration Status=Enabled
aws s3api put-public-access-block --bucket professional-website-tfstate --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
aws s3api put-bucket-tagging --bucket professional-website-tfstate \
  --tagging 'TagSet=[{Key=Name,Value=professional-website},{Key=Project,Value=professional-website}]'
```

## Deploying the infrastructure

```sh
cd infra
terraform init
terraform apply
```

Then set the `AWS_ROLE_ARN` output as a GitHub Actions secret of the same
name. That is the only secret the workflow needs: the bucket name is fixed
by convention and the distribution is looked up by its `professional-website` comment.
