#!/bin/bash

# AWS Deployment Script for Banana Pajama Zombie Shooter
# This script deploys the application to AWS using CloudFormation and ECS

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="banana-pajama"
REGION="us-east-1"
PROFILE="default"
ENVIRONMENT="production"

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
        log_error "AWS CLI is not installed. Please install it first."
        exit 1
    fi
    
    if ! command_exists docker; then
        log_error "Docker is not installed. Please install it first."
        exit 1
    fi
    
    # Check AWS credentials
    if ! aws sts get-caller-identity --profile $PROFILE >/dev/null 2>&1; then
        log_error "AWS credentials not configured for profile: $PROFILE"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Function to create ECR repositories
create_ecr_repositories() {
    log_info "Creating ECR repositories..."
    
    for service in client server nginx; do
        aws ecr describe-repositories --repository-names "${PROJECT_NAME}-${service}" --region $REGION --profile $PROFILE >/dev/null 2>&1 || \
        aws ecr create-repository --repository-name "${PROJECT_NAME}-${service}" --region $REGION --profile $PROFILE >/dev/null
        
        log_success "ECR repository created: ${PROJECT_NAME}-${service}"
    done
}

# Function to build and push Docker images
build_and_push_images() {
    log_info "Building and pushing Docker images..."
    
    # Get ECR login token
    aws ecr get-login-password --region $REGION --profile $PROFILE | docker login --username AWS --password-stdin "${AWS_ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"
    
    # Build and push client
    log_info "Building client image..."
    docker build -t "${PROJECT_NAME}-client" ./client
    docker tag "${PROJECT_NAME}-client:latest" "${AWS_ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${PROJECT_NAME}-client:latest"
    docker push "${AWS_ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${PROJECT_NAME}-client:latest"
    log_success "Client image pushed"
    
    # Build and push server
    log_info "Building server image..."
    docker build -t "${PROJECT_NAME}-server" ./server
    docker tag "${PROJECT_NAME}-server:latest" "${AWS_ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${PROJECT_NAME}-server:latest"
    docker push "${AWS_ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${PROJECT_NAME}-server:latest"
    log_success "Server image pushed"
    
    # Build and push nginx
    log_info "Building nginx image..."
    docker build -t "${PROJECT_NAME}-nginx" ./nginx
    docker tag "${PROJECT_NAME}-nginx:latest" "${AWS_ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${PROJECT_NAME}-nginx:latest"
    docker push "${AWS_ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${PROJECT_NAME}-nginx:latest"
    log_success "Nginx image pushed"
}

# Function to deploy CloudFormation stacks
deploy_cloudformation() {
    log_info "Deploying CloudFormation stacks..."
    
    local stack_name="$1"
    local template_file="$2"
    local parameters="$3"
    
    aws cloudformation deploy \
        --template-file "$template_file" \
        --stack-name "$stack_name" \
        --parameter-overrides $parameters \
        --capabilities CAPABILITY_IAM \
        --region $REGION \
        --profile $PROFILE
        
    if [ $? -eq 0 ]; then
        log_success "Stack deployed: $stack_name"
    else
        log_error "Failed to deploy stack: $stack_name"
        exit 1
    fi
}

# Function to prompt for parameters
prompt_for_parameters() {
    log_info "Please provide the following parameters:"
    
    read -s -p "Database Password (8-41 characters): " DB_PASSWORD
    echo
    
    read -s -p "Session Secret (32+ characters): " SESSION_SECRET
    echo
    
    read -p "Domain Name (e.g., example.com): " DOMAIN_NAME
    
    # Validate inputs
    if [ ${#DB_PASSWORD} -lt 8 ] || [ ${#DB_PASSWORD} -gt 41 ]; then
        log_error "Database password must be between 8-41 characters"
        exit 1
    fi
    
    if [ ${#SESSION_SECRET} -lt 32 ]; then
        log_error "Session secret must be at least 32 characters"
        exit 1
    fi
}

# Function to show deployment status
show_deployment_status() {
    log_info "Deployment Status:"
    
    # Get ALB DNS name
    ALB_DNS=$(aws cloudformation describe-stacks \
        --stack-name "${PROJECT_NAME}-${ENVIRONMENT}-ecs" \
        --query 'Stacks[0].Outputs[?OutputKey==`LoadBalancerDNS`].OutputValue' \
        --output text \
        --region $REGION \
        --profile $PROFILE)
    
    if [ ! -z "$ALB_DNS" ]; then
        log_success "Application deployed successfully!"
        log_info "Load Balancer DNS: $ALB_DNS"
        log_info "Application URL: https://$ALB_DNS"
        log_warning "Note: You need to configure DNS to point $DOMAIN_NAME to $ALB_DNS"
    else
        log_error "Could not retrieve load balancer information"
    fi
}

# Main deployment function
main() {
    log_info "🍌 Starting AWS deployment for Banana Pajama Zombie Shooter"
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --environment)
                ENVIRONMENT="$2"
                shift 2
                ;;
            --region)
                REGION="$2"
                shift 2
                ;;
            --profile)
                PROFILE="$2"
                shift 2
                ;;
            --help)
                echo "Usage: $0 [--environment ENV] [--region REGION] [--profile PROFILE]"
                echo "  --environment: deployment environment (default: production)"
                echo "  --region: AWS region (default: us-east-1)"
                echo "  --profile: AWS profile (default: default)"
                exit 0
                ;;
            *)
                log_error "Unknown parameter: $1"
                exit 1
                ;;
        esac
    done
    
    # Get AWS Account ID
    AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text --profile $PROFILE)
    
    # Check prerequisites
    check_prerequisites
    
    # Prompt for sensitive parameters
    prompt_for_parameters
    
    # Create ECR repositories
    create_ecr_repositories
    
    # Build and push images
    build_and_push_images
    
    # Deploy infrastructure stacks
    log_info "Deploying infrastructure stacks..."
    
    # 1. VPC and Networking
    deploy_cloudformation \
        "${PROJECT_NAME}-${ENVIRONMENT}-vpc" \
        "./infrastructure/cloudformation/vpc-networking.yml" \
        "ProjectName=${PROJECT_NAME} Environment=${ENVIRONMENT}"
    
    # 2. Security Groups
    deploy_cloudformation \
        "${PROJECT_NAME}-${ENVIRONMENT}-security" \
        "./infrastructure/cloudformation/security-groups.yml" \
        "ProjectName=${PROJECT_NAME} Environment=${ENVIRONMENT}"
    
    # 3. RDS Database
    deploy_cloudformation \
        "${PROJECT_NAME}-${ENVIRONMENT}-rds" \
        "./infrastructure/cloudformation/rds-database.yml" \
        "ProjectName=${PROJECT_NAME} Environment=${ENVIRONMENT} DatabasePassword=${DB_PASSWORD}"
    
    # Wait for RDS to be available
    log_info "Waiting for RDS instance to be available..."
    aws rds wait db-instance-available \
        --db-instance-identifier "${PROJECT_NAME}-${ENVIRONMENT}-db" \
        --region $REGION \
        --profile $PROFILE
    
    # Get database endpoint
    DATABASE_ENDPOINT=$(aws rds describe-db-instances \
        --db-instance-identifier "${PROJECT_NAME}-${ENVIRONMENT}-db" \
        --query 'DBInstances[0].Endpoint.Address' \
        --output text \
        --region $REGION \
        --profile $PROFILE)
    
    # 4. S3 and CloudFront (optional)
    deploy_cloudformation \
        "${PROJECT_NAME}-${ENVIRONMENT}-assets" \
        "./infrastructure/cloudformation/s3-cloudfront.yml" \
        "ProjectName=${PROJECT_NAME} Environment=${ENVIRONMENT} DomainName=${DOMAIN_NAME}"
    
    # 5. ECS Fargate
    deploy_cloudformation \
        "${PROJECT_NAME}-${ENVIRONMENT}-ecs" \
        "./infrastructure/cloudformation/ecs-fargate.yml" \
        "ProjectName=${PROJECT_NAME} Environment=${ENVIRONMENT} DatabasePassword=${DB_PASSWORD} SessionSecret=${SESSION_SECRET} DomainName=${DOMAIN_NAME}"
    
    # Show deployment status
    show_deployment_status
    
    log_success "🎉 Deployment completed successfully!"
    log_info "Next steps:"
    log_info "1. Configure your DNS to point ${DOMAIN_NAME} to the load balancer"
    log_info "2. Complete SSL certificate validation"
    log_info "3. Test your application"
}

# Run main function
main "$@"