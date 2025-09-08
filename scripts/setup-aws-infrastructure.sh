#!/bin/bash

# AWS Infrastructure Setup Script for Banana Pajama Zombie Shooter
# This script sets up the required AWS infrastructure without deploying the application

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
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

log_action() {
    echo -e "${PURPLE}🔧 $1${NC}"
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
    
    # Check AWS credentials
    if ! aws sts get-caller-identity --profile $PROFILE >/dev/null 2>&1; then
        log_error "AWS credentials not configured for profile: $PROFILE"
        exit 1
    fi
    
    # Check for CloudFormation templates
    if [ ! -d "./infrastructure/cloudformation" ]; then
        log_error "CloudFormation templates not found in ./infrastructure/cloudformation"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Function to validate CloudFormation templates
validate_templates() {
    log_action "Validating CloudFormation templates..."
    
    local templates=(
        "./infrastructure/cloudformation/vpc-networking.yml"
        "./infrastructure/cloudformation/security-groups.yml"
        "./infrastructure/cloudformation/rds-database.yml"
        "./infrastructure/cloudformation/s3-cloudfront.yml"
    )
    
    for template in "${templates[@]}"; do
        if [ -f "$template" ]; then
            log_info "Validating $(basename "$template")..."
            aws cloudformation validate-template \
                --template-body file://"$template" \
                --region $REGION \
                --profile $PROFILE >/dev/null
            log_success "$(basename "$template") is valid"
        else
            log_warning "Template not found: $template"
        fi
    done
}

# Function to deploy CloudFormation stack
deploy_cloudformation() {
    local stack_name="$1"
    local template_file="$2"
    local parameters="$3"
    
    log_action "Deploying CloudFormation stack: $stack_name"
    
    if [ ! -f "$template_file" ]; then
        log_error "Template file not found: $template_file"
        exit 1
    fi
    
    aws cloudformation deploy \
        --template-file "$template_file" \
        --stack-name "$stack_name" \
        --parameter-overrides $parameters \
        --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
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
    log_info "Please provide the following parameters for infrastructure setup:"
    
    read -s -p "Database Password (8-41 characters): " DB_PASSWORD
    echo
    
    read -p "Domain Name (e.g., example.com, or 'none' to skip): " DOMAIN_NAME
    
    # Validate inputs
    if [ ${#DB_PASSWORD} -lt 8 ] || [ ${#DB_PASSWORD} -gt 41 ]; then
        log_error "Database password must be between 8-41 characters"
        exit 1
    fi
    
    if [ "$DOMAIN_NAME" = "none" ] || [ -z "$DOMAIN_NAME" ]; then
        DOMAIN_NAME="example.com"  # Placeholder for CloudFormation
        log_info "Using placeholder domain name for infrastructure setup"
    fi
}

# Function to create ECR repositories
create_ecr_repositories() {
    log_action "Creating ECR repositories..."
    
    local services=("client" "server" "nginx")
    
    for service in "${services[@]}"; do
        local repo_name="${PROJECT_NAME}-${service}"
        
        if aws ecr describe-repositories --repository-names "$repo_name" --region $REGION --profile $PROFILE >/dev/null 2>&1; then
            log_info "ECR repository already exists: $repo_name"
        else
            log_info "Creating ECR repository: $repo_name"
            aws ecr create-repository \
                --repository-name "$repo_name" \
                --region $REGION \
                --profile $PROFILE >/dev/null
            log_success "ECR repository created: $repo_name"
        fi
    done
}

# Function to create secrets
create_secrets() {
    log_action "Creating secrets in AWS Secrets Manager..."
    
    # Database secrets
    local db_secret_name="${PROJECT_NAME}-${ENVIRONMENT}-database-secret"
    local db_secret_value=$(cat <<EOF
{
    "username": "postgres",
    "password": "$DB_PASSWORD",
    "host": "placeholder-will-be-updated-after-rds-creation",
    "port": "5432",
    "dbname": "banana_pajama_db"
}
EOF
)
    
    if aws secretsmanager describe-secret --secret-id "$db_secret_name" --region $REGION --profile $PROFILE >/dev/null 2>&1; then
        log_info "Updating existing database secret: $db_secret_name"
        aws secretsmanager update-secret \
            --secret-id "$db_secret_name" \
            --secret-string "$db_secret_value" \
            --region $REGION \
            --profile $PROFILE >/dev/null
    else
        log_info "Creating database secret: $db_secret_name"
        aws secretsmanager create-secret \
            --name "$db_secret_name" \
            --description "Database credentials for Banana Pajama game" \
            --secret-string "$db_secret_value" \
            --region $REGION \
            --profile $PROFILE >/dev/null
    fi
    log_success "Database secret configured: $db_secret_name"
    
    # Application secrets
    local app_secret_name="${PROJECT_NAME}-${ENVIRONMENT}-app-secrets"
    local session_secret=$(openssl rand -base64 32 2>/dev/null || date | md5sum | head -c 32)
    local app_secret_value=$(cat <<EOF
{
    "session_secret": "$session_secret",
    "cors_origin": "https://$DOMAIN_NAME"
}
EOF
)
    
    if aws secretsmanager describe-secret --secret-id "$app_secret_name" --region $REGION --profile $PROFILE >/dev/null 2>&1; then
        log_info "Updating existing application secret: $app_secret_name"
        aws secretsmanager update-secret \
            --secret-id "$app_secret_name" \
            --secret-string "$app_secret_value" \
            --region $REGION \
            --profile $PROFILE >/dev/null
    else
        log_info "Creating application secret: $app_secret_name"
        aws secretsmanager create-secret \
            --name "$app_secret_name" \
            --description "Application secrets for Banana Pajama game" \
            --secret-string "$app_secret_value" \
            --region $REGION \
            --profile $PROFILE >/dev/null
    fi
    log_success "Application secret configured: $app_secret_name"
}

# Function to update database secret with RDS endpoint
update_database_secret_with_endpoint() {
    log_action "Updating database secret with RDS endpoint..."
    
    # Get RDS endpoint
    local db_endpoint=$(aws rds describe-db-instances \
        --db-instance-identifier "${PROJECT_NAME}-${ENVIRONMENT}-db" \
        --query 'DBInstances[0].Endpoint.Address' \
        --output text \
        --region $REGION \
        --profile $PROFILE)
    
    if [ -n "$db_endpoint" ] && [ "$db_endpoint" != "None" ]; then
        local db_secret_name="${PROJECT_NAME}-${ENVIRONMENT}-database-secret"
        local updated_secret_value=$(cat <<EOF
{
    "username": "postgres",
    "password": "$DB_PASSWORD",
    "host": "$db_endpoint",
    "port": "5432",
    "dbname": "banana_pajama_db"
}
EOF
)
        
        aws secretsmanager update-secret \
            --secret-id "$db_secret_name" \
            --secret-string "$updated_secret_value" \
            --region $REGION \
            --profile $PROFILE >/dev/null
            
        log_success "Database secret updated with RDS endpoint: $db_endpoint"
    else
        log_warning "Could not retrieve RDS endpoint for secret update"
    fi
}

# Function to show deployment status
show_infrastructure_summary() {
    log_success "🏗️  Infrastructure setup completed!"
    log_info "Infrastructure Summary:"
    
    local account_id=$(aws sts get-caller-identity --query Account --output text --profile $PROFILE)
    
    # Get VPC info
    local vpc_id=$(aws cloudformation describe-stacks \
        --stack-name "${PROJECT_NAME}-${ENVIRONMENT}-vpc" \
        --query 'Stacks[0].Outputs[?OutputKey==`VPCId`].OutputValue' \
        --output text \
        --region $REGION \
        --profile $PROFILE 2>/dev/null || echo "N/A")
    
    # Get RDS endpoint
    local db_endpoint=$(aws rds describe-db-instances \
        --db-instance-identifier "${PROJECT_NAME}-${ENVIRONMENT}-db" \
        --query 'DBInstances[0].Endpoint.Address' \
        --output text \
        --region $REGION \
        --profile $PROFILE 2>/dev/null || echo "N/A")
    
    # Get S3 bucket
    local s3_bucket=$(aws cloudformation describe-stacks \
        --stack-name "${PROJECT_NAME}-${ENVIRONMENT}-assets" \
        --query 'Stacks[0].Outputs[?OutputKey==`S3BucketName`].OutputValue' \
        --output text \
        --region $REGION \
        --profile $PROFILE 2>/dev/null || echo "N/A")
    
    echo
    log_info "AWS Account: $account_id"
    log_info "Region: $REGION"
    log_info "Environment: $ENVIRONMENT"
    echo
    log_info "📦 Resources Created:"
    log_info "• VPC ID: $vpc_id"
    log_info "• RDS Endpoint: $db_endpoint"
    log_info "• S3 Bucket: $s3_bucket"
    log_info "• ECR Repositories: ${PROJECT_NAME}-client, ${PROJECT_NAME}-server, ${PROJECT_NAME}-nginx"
    log_info "• Secrets: Database and application secrets in Secrets Manager"
    echo
    log_info "📋 CloudFormation Stacks:"
    log_info "• ${PROJECT_NAME}-${ENVIRONMENT}-vpc (Networking)"
    log_info "• ${PROJECT_NAME}-${ENVIRONMENT}-security (Security Groups)"
    log_info "• ${PROJECT_NAME}-${ENVIRONMENT}-rds (Database)"
    log_info "• ${PROJECT_NAME}-${ENVIRONMENT}-assets (S3 + CloudFront)"
    echo
    log_success "Infrastructure is ready for application deployment!"
    echo
    log_info "Next Steps:"
    log_info "1. Run ./scripts/build-images.sh to build Docker images"
    log_info "2. Run ./scripts/push-images.sh to push images to ECR"
    log_info "3. Run ./scripts/deploy-aws.sh to deploy the application"
    echo
    log_warning "Monthly Cost Estimate: $15-25 (after free tier)"
}

# Main setup function
main() {
    log_info "🏗️  Setting up AWS infrastructure for Banana Pajama Zombie Shooter"
    
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
            --project-name)
                PROJECT_NAME="$2"
                shift 2
                ;;
            --help)
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "Sets up AWS infrastructure for Banana Pajama Zombie Shooter"
                echo ""
                echo "Options:"
                echo "  --environment ENV    Deployment environment (default: production)"
                echo "  --region REGION      AWS region (default: us-east-1)"
                echo "  --profile PROFILE    AWS profile (default: default)"
                echo "  --project-name NAME  Project name (default: banana-pajama)"
                echo ""
                echo "This script will create:"
                echo "• VPC with public/private subnets"
                echo "• Security groups"
                echo "• RDS PostgreSQL database"
                echo "• S3 bucket and CloudFront distribution"
                echo "• ECR repositories"
                echo "• Secrets in AWS Secrets Manager"
                exit 0
                ;;
            *)
                log_error "Unknown parameter: $1"
                exit 1
                ;;
        esac
    done
    
    log_info "Configuration:"
    log_info "• Project: $PROJECT_NAME"
    log_info "• Environment: $ENVIRONMENT" 
    log_info "• Region: $REGION"
    log_info "• Profile: $PROFILE"
    echo
    
    # Run setup steps
    check_prerequisites
    validate_templates
    prompt_for_parameters
    
    # Create AWS resources
    log_info "Creating AWS infrastructure resources..."
    echo
    
    # 1. Create ECR repositories first (needed for ECS later)
    create_ecr_repositories
    
    # 2. Create secrets (needed by RDS and ECS)
    create_secrets
    
    # 3. Deploy infrastructure stacks in dependency order
    deploy_cloudformation \
        "${PROJECT_NAME}-${ENVIRONMENT}-vpc" \
        "./infrastructure/cloudformation/vpc-networking.yml" \
        "ProjectName=${PROJECT_NAME} Environment=${ENVIRONMENT}"
    
    deploy_cloudformation \
        "${PROJECT_NAME}-${ENVIRONMENT}-security" \
        "./infrastructure/cloudformation/security-groups.yml" \
        "ProjectName=${PROJECT_NAME} Environment=${ENVIRONMENT}"
    
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
    log_success "RDS instance is available"
    
    # Update database secret with actual endpoint
    update_database_secret_with_endpoint
    
    deploy_cloudformation \
        "${PROJECT_NAME}-${ENVIRONMENT}-assets" \
        "./infrastructure/cloudformation/s3-cloudfront.yml" \
        "ProjectName=${PROJECT_NAME} Environment=${ENVIRONMENT} DomainName=${DOMAIN_NAME}"
    
    # Show summary
    echo
    show_infrastructure_summary
    
    log_success "🎉 Infrastructure setup completed successfully!"
}

# Run main function
main "$@"