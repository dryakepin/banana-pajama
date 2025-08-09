# AWS Deployment Setup Guide

This guide will help you deploy the Banana Pajama Zombie Shooter game to AWS using ECS Fargate, RDS PostgreSQL, and Application Load Balancer.

## Overview

The AWS infrastructure consists of:

- **ECS Fargate**: Serverless container hosting
- **Application Load Balancer**: Traffic distribution and SSL termination
- **RDS PostgreSQL**: Managed database service
- **ECR**: Container registry for Docker images
- **CloudWatch**: Logging and monitoring
- **Certificate Manager**: Free SSL certificates
- **Secrets Manager**: Secure credential storage

## Prerequisites

1. **AWS Account**: Free tier eligible account
2. **AWS CLI v2**: [Installation guide](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)
3. **Docker**: For building container images
4. **Domain Name**: For SSL certificate (optional, can use ALB DNS directly)

## Quick Start (New AWS Account)

### 1. Account Setup

```bash
# Run the automated AWS account setup
./scripts/aws-account-setup.sh

# Or with custom settings
./scripts/aws-account-setup.sh --region us-west-2 --profile myprofile
```

This script will:
- Verify AWS CLI installation and credentials
- Check service availability and limits
- Validate deployment permissions
- Create default VPC if needed

### 2. Deploy Infrastructure

```bash
# Deploy to AWS (interactive - will prompt for passwords)
./scripts/deploy-aws.sh

# Or with custom settings
./scripts/deploy-aws.sh --environment production --region us-east-1
```

The deployment process:
1. Creates ECR repositories
2. Builds and pushes Docker images
3. Deploys CloudFormation stacks:
   - VPC and networking
   - Security groups
   - RDS database
   - ECS Fargate cluster and services

### 3. Configure DNS (Optional)

After deployment, you'll receive an ALB DNS name like:
```
banana-pajama-production-alb-123456789.us-east-1.elb.amazonaws.com
```

To use a custom domain:
1. Create a CNAME record pointing your domain to the ALB DNS
2. Complete SSL certificate validation via DNS

## Architecture Details

### Network Architecture

```
Internet Gateway
    │
    ├─── Public Subnet 1 (us-east-1a)
    │    └── NAT Gateway 1
    │
    └─── Public Subnet 2 (us-east-1b)
         └── NAT Gateway 2

Application Load Balancer (Public)
    │
    ├─── Private Subnet 1 (us-east-1a)
    │    └── ECS Tasks
    │
    └─── Private Subnet 2 (us-east-1b)
         └── ECS Tasks, RDS Database
```

### Container Architecture

```
Application Load Balancer
    │
    ├── HTTPS:443 ──────┐
    └── HTTP:80 ────────┼── (redirect to HTTPS)
                        │
                   ECS Fargate Task
                        │
                   ┌────┴────┐
                   │  Nginx  │ (Reverse Proxy)
                   │  :80    │
                   └────┬────┘
                        │
                   ┌────┴────────────────┐
                   │                     │
              ┌────▼────┐           ┌────▼────┐
              │ Client  │           │ Server  │
              │ :80     │           │ :3000   │
              │(Phaser) │           │(Node.js)│
              └─────────┘           └────┬────┘
                                         │
                                    ┌────▼────┐
                                    │   RDS   │
                                    │Postgres │
                                    │ :5432   │
                                    └─────────┘
```

## CloudFormation Stacks

### 1. VPC and Networking (`vpc-networking.yml`)
- VPC with public and private subnets
- Internet Gateway and NAT Gateways
- Route tables for public and private traffic

### 2. Security Groups (`security-groups.yml`)
- ALB Security Group (HTTP/HTTPS from internet)
- ECS Security Group (traffic from ALB only)
- RDS Security Group (PostgreSQL from ECS only)

### 3. RDS Database (`rds-database.yml`)
- PostgreSQL 15 instance
- Multi-AZ for production
- Encrypted storage
- Automated backups
- Performance insights

### 4. ECS Fargate (`ecs-fargate.yml`)
- ECS cluster with Fargate
- Task definition with 3 containers
- Application Load Balancer
- SSL certificate management
- Auto-scaling configuration

## Environment Variables

The deployment uses AWS Secrets Manager for sensitive data:

### Database Secrets
- `DB_HOST`: RDS endpoint
- `DB_PORT`: 5432
- `DB_NAME`: banana_pajama
- `DB_USER`: postgres
- `DB_PASSWORD`: (user provided)

### Application Secrets
- `SESSION_SECRET`: JWT signing key
- `CORS_ORIGIN`: Allowed origins for API

## Cost Optimization

### Free Tier Usage
- **ECS Fargate**: 400 vCPU hours/month
- **RDS db.t3.micro**: 750 hours/month (1 instance)
- **Application Load Balancer**: 750 hours/month
- **CloudWatch Logs**: 5GB ingestion/month
- **Data Transfer**: 1GB/month

### Estimated Costs After Free Tier
- **ECS Fargate**: ~$5-10/month (2 tasks)
- **RDS db.t3.micro**: ~$12/month
- **Load Balancer**: ~$16/month
- **Data Transfer**: ~$2-5/month
- **Total**: ~$35-43/month

### Cost Savings Tips
1. Use Fargate Spot for non-production environments
2. Enable CloudWatch Container Insights selectively
3. Set up billing alerts
4. Use RDS reserved instances for long-term deployments
5. Implement auto-scaling to scale down during low usage

## Monitoring and Logging

### CloudWatch Logs
- `/ecs/banana-pajama-production-client`
- `/ecs/banana-pajama-production-server`
- `/ecs/banana-pajama-production-nginx`

### CloudWatch Metrics
- ECS service CPU/Memory utilization
- ALB request count and latency
- RDS CPU, connections, and storage metrics

### Alarms
- Database CPU > 80%
- Database connections > 80
- ECS service unhealthy tasks

## Security Features

### Network Security
- Private subnets for application containers
- Security groups with least privilege access
- No direct internet access to containers

### Data Security
- RDS encryption at rest
- Secrets Manager for credentials
- SSL/TLS encryption in transit
- Security headers in Nginx

### Container Security
- Non-root container users
- Minimal base images (Alpine Linux)
- Read-only root filesystems where possible

## Scaling and High Availability

### Auto Scaling
- ECS service auto-scaling based on CPU/Memory
- Target tracking scaling policies
- Scale out for high load, scale in during low usage

### High Availability
- Multi-AZ deployment across 2 availability zones
- RDS Multi-AZ for database failover
- Load balancer health checks
- Container health checks

## Troubleshooting

### Common Issues

1. **ECS Tasks Not Starting**
   - Check CloudWatch logs for container errors
   - Verify ECR image permissions
   - Check security group connectivity

2. **Database Connection Errors**
   - Verify RDS security group rules
   - Check database credentials in Secrets Manager
   - Ensure RDS instance is in available state

3. **SSL Certificate Issues**
   - Complete DNS validation for ACM certificate
   - Verify domain ownership
   - Check Certificate Manager status

4. **High Costs**
   - Review CloudWatch billing metrics
   - Check for unused resources
   - Optimize container resource allocation

### Useful Commands

```bash
# View ECS service status
aws ecs describe-services --cluster banana-pajama-production-cluster \
  --services banana-pajama-production-service

# Check RDS instance status
aws rds describe-db-instances --db-instance-identifier banana-pajama-production-db

# View CloudWatch logs
aws logs tail /ecs/banana-pajama-production-server --follow

# Update ECS service
aws ecs update-service --cluster banana-pajama-production-cluster \
  --service banana-pajama-production-service --force-new-deployment
```

## Cleanup

To avoid charges, delete resources when no longer needed:

```bash
# Delete CloudFormation stacks (in reverse order)
aws cloudformation delete-stack --stack-name banana-pajama-production-ecs
aws cloudformation delete-stack --stack-name banana-pajama-production-rds
aws cloudformation delete-stack --stack-name banana-pajama-production-security
aws cloudformation delete-stack --stack-name banana-pajama-production-vpc

# Delete ECR repositories
aws ecr delete-repository --repository-name banana-pajama-client --force
aws ecr delete-repository --repository-name banana-pajama-server --force
aws ecr delete-repository --repository-name banana-pajama-nginx --force
```

## Support

For issues with AWS infrastructure:
1. Check CloudWatch logs and metrics
2. Review CloudFormation events
3. Consult AWS documentation
4. Contact AWS Support (if you have a support plan)

---

**Security Note**: Always rotate passwords and secrets regularly, monitor access patterns, and follow AWS security best practices.