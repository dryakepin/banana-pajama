#!/bin/bash

# AWS Account Setup Script for Banana Pajama Zombie Shooter
# This script sets up a fresh AWS account with required services and configurations

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REGION="us-east-1"
PROFILE="default"

# Function to print colored output
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    if ! command_exists aws; then
        log_error "AWS CLI is not installed. Please install it first:"
        log_info "https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
        exit 1
    fi
    
    # Check AWS CLI version (v2 required)
    AWS_VERSION=$(aws --version 2>&1 | cut -d/ -f2 | cut -d. -f1)
    if [ "$AWS_VERSION" != "2" ]; then
        log_warning "AWS CLI v2 is recommended. You have version: $(aws --version)"
    fi
    
    log_success "Prerequisites check passed"
}

# Function to configure AWS credentials
configure_aws_credentials() {
    log_info "Configuring AWS credentials..."
    
    # Check if credentials are already configured
    if aws sts get-caller-identity --profile $PROFILE >/dev/null 2>&1; then
        log_success "AWS credentials are already configured"
        return
    fi
    
    log_info "AWS credentials not found. Please configure them:"
    aws configure --profile $PROFILE
    
    # Verify configuration
    if aws sts get-caller-identity --profile $PROFILE >/dev/null 2>&1; then
        log_success "AWS credentials configured successfully"
    else
        log_error "Failed to configure AWS credentials"
        exit 1
    fi
}

# Function to enable required AWS services
enable_aws_services() {
    log_info "Enabling required AWS services..."
    
    # Services that might need to be enabled in some regions
    local services=(
        "ecs"
        "ecr"
        "rds"
        "cloudformation"
        "logs"
        "secretsmanager"
        "certificatemanager"
        "elasticloadbalancing"
    )
    
    for service in "${services[@]}"; do
        # Most services are enabled by default, but we'll verify access
        case $service in
            "ecs")
                aws ecs list-clusters --region $REGION --profile $PROFILE >/dev/null 2>&1 && \
                log_success "ECS service is available" || \
                log_warning "ECS service check failed"
                ;;
            "ecr")
                aws ecr describe-repositories --region $REGION --profile $PROFILE >/dev/null 2>&1 && \
                log_success "ECR service is available" || \
                log_success "ECR service is available (no repositories yet)"
                ;;
            "rds")
                aws rds describe-db-instances --region $REGION --profile $PROFILE >/dev/null 2>&1 && \
                log_success "RDS service is available" || \
                log_success "RDS service is available (no instances yet)"
                ;;
        esac
    done
}

# Function to create default VPC if it doesn't exist
create_default_vpc() {
    log_info "Checking default VPC..."
    
    # Check if default VPC exists
    DEFAULT_VPC=$(aws ec2 describe-vpcs --filters "Name=is-default,Values=true" \
        --query 'Vpcs[0].VpcId' --output text --region $REGION --profile $PROFILE 2>/dev/null)
    
    if [ "$DEFAULT_VPC" = "None" ] || [ -z "$DEFAULT_VPC" ]; then
        log_warning "No default VPC found. Creating one..."
        aws ec2 create-default-vpc --region $REGION --profile $PROFILE >/dev/null
        log_success "Default VPC created"
    else
        log_success "Default VPC exists: $DEFAULT_VPC"
    fi
}

# Function to check service limits
check_service_limits() {
    log_info "Checking AWS service limits..."
    
    # Get current limits for key services
    local account_id=$(aws sts get-caller-identity --query Account --output text --profile $PROFILE)
    
    log_info "Account ID: $account_id"
    log_info "Region: $REGION"
    
    # Check VPC limits
    local vpc_limit=$(aws service-quotas get-service-quota --service-code ec2 --quota-code L-F678F1CE \
        --query 'Quota.Value' --output text --region $REGION --profile $PROFILE 2>/dev/null || echo "5")
    local vpc_count=$(aws ec2 describe-vpcs --query 'length(Vpcs)' --output text --region $REGION --profile $PROFILE)
    
    log_info "VPCs: $vpc_count/$vpc_limit"
    
    # Check ECS cluster limits
    local cluster_limit=$(aws service-quotas get-service-quota --service-code ecs --quota-code L-21C621EB \
        --query 'Quota.Value' --output text --region $REGION --profile $PROFILE 2>/dev/null || echo "10000")
    local cluster_count=$(aws ecs list-clusters --query 'length(clusterArns)' --output text --region $REGION --profile $PROFILE)
    
    log_info "ECS Clusters: $cluster_count/$cluster_limit"
    
    # Warning about free tier limits
    log_warning "Free Tier Limits to keep in mind:"
    log_info "• ECS Fargate: 400 vCPU hours/month"
    log_info "• RDS db.t3.micro: 750 hours/month"
    log_info "• S3: 5GB storage, 20,000 GET requests/month"
    log_info "• CloudFront: 50GB data transfer/month"
    log_info "• Application Load Balancer: 750 hours/month"
}

# Function to create IAM role for deployment (if needed)
create_deployment_role() {
    log_info "Checking deployment permissions..."
    
    # Test if current user has sufficient permissions
    local permissions_ok=true
    
    # Test CloudFormation permissions
    aws cloudformation list-stacks --region $REGION --profile $PROFILE >/dev/null 2>&1 || permissions_ok=false
    
    # Test ECS permissions
    aws ecs list-clusters --region $REGION --profile $PROFILE >/dev/null 2>&1 || permissions_ok=false
    
    # Test RDS permissions
    aws rds describe-db-instances --region $REGION --profile $PROFILE >/dev/null 2>&1 || permissions_ok=false
    
    if [ "$permissions_ok" = true ]; then
        log_success "Deployment permissions verified"
    else
        log_error "Insufficient permissions for deployment"
        log_info "Required permissions:"
        log_info "• CloudFormation (create, update, delete stacks)"
        log_info "• ECS (create clusters, services, task definitions)"
        log_info "• ECR (create repositories, push images)"
        log_info "• RDS (create instances, subnet groups)"
        log_info "• VPC (create subnets, security groups, load balancers)"
        log_info "• IAM (create roles for services)"
        exit 1
    fi
}

# Function to display setup summary
display_setup_summary() {
    log_success "🎉 AWS account setup completed!"
    log_info "Setup Summary:"
    
    local account_id=$(aws sts get-caller-identity --query Account --output text --profile $PROFILE)
    local user_name=$(aws sts get-caller-identity --query Arn --output text --profile $PROFILE | cut -d'/' -f2)
    
    log_info "• Account ID: $account_id"
    log_info "• Region: $REGION"
    log_info "• User/Role: $user_name"
    log_info "• Profile: $PROFILE"
    
    log_info ""
    log_info "Next Steps:"
    log_info "1. Run ./scripts/deploy-aws.sh to deploy the application"
    log_info "2. Have your domain ready for SSL certificate validation"
    log_info "3. Monitor costs in AWS Billing Dashboard"
    
    log_warning "Cost Reminders:"
    log_info "• Most services used are free tier eligible"
    log_info "• Estimated cost after free tier: \$15-25/month"
    log_info "• Set up billing alerts to monitor spending"
    log_info "• Review and delete resources when no longer needed"
}

# Main setup function
main() {
    log_info "🍌 Setting up AWS account for Banana Pajama Zombie Shooter"
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --region)
                REGION="$2"
                shift 2
                ;;
            --profile)
                PROFILE="$2"
                shift 2
                ;;
            --help)
                echo "Usage: $0 [--region REGION] [--profile PROFILE]"
                echo "  --region: AWS region (default: us-east-1)"
                echo "  --profile: AWS profile (default: default)"
                echo ""
                echo "This script will:"
                echo "1. Check AWS CLI installation and configuration"
                echo "2. Verify AWS credentials"
                echo "3. Check service availability and limits"
                echo "4. Validate deployment permissions"
                exit 0
                ;;
            *)
                log_error "Unknown parameter: $1"
                exit 1
                ;;
        esac
    done
    
    log_info "Using AWS region: $REGION"
    log_info "Using AWS profile: $PROFILE"
    
    # Run setup steps
    check_prerequisites
    configure_aws_credentials
    enable_aws_services
    create_default_vpc
    check_service_limits
    create_deployment_role
    
    # Display summary
    display_setup_summary
}

# Run main function
main "$@"