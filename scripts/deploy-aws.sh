#!/bin/bash

# AWS Game Deployment Script for Banana Pajama Zombie Shooter
# This script deploys the game application to existing AWS infrastructure
# 
# Prerequisites:
# 1. Run ./scripts/setup-aws-infrastructure.sh first to create AWS resources
# 2. Docker must be running for image builds
# 3. AWS CLI configured with deployment permissions

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

# Function to verify ECR repositories exist
verify_ecr_repositories() {
    log_info "Verifying ECR repositories exist..."
    
    local missing_repos=()
    for service in client server nginx; do
        local repo_name="${PROJECT_NAME}-${service}"
        if ! aws ecr describe-repositories --repository-names "$repo_name" --region $REGION --profile $PROFILE >/dev/null 2>&1; then
            missing_repos+=("$repo_name")
        else
            log_success "✓ ECR repository ready: $repo_name"
        fi
    done
    
    if [ ${#missing_repos[@]} -gt 0 ]; then
        log_error "Missing ECR repositories: ${missing_repos[*]}"
        log_error ""
        log_error "🚨 REQUIRED: Run infrastructure setup first:"
        log_error "   ./scripts/setup-aws-infrastructure.sh"
        log_error ""
        exit 1
    fi
    
    log_success "All required ECR repositories are ready"
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

# Function to verify infrastructure exists
verify_infrastructure() {
    log_info "Verifying AWS infrastructure exists..."
    
    local required_stacks=(
        "${PROJECT_NAME}-${ENVIRONMENT}-vpc"
        "${PROJECT_NAME}-${ENVIRONMENT}-security"  
        "${PROJECT_NAME}-${ENVIRONMENT}-rds"
        "${PROJECT_NAME}-${ENVIRONMENT}-assets"
    )
    
    local missing_stacks=()
    for stack in "${required_stacks[@]}"; do
        if aws cloudformation describe-stacks --stack-name "$stack" --region $REGION --profile $PROFILE >/dev/null 2>&1; then
            local status=$(aws cloudformation describe-stacks --stack-name "$stack" --query 'Stacks[0].StackStatus' --output text --region $REGION --profile $PROFILE)
            if [[ "$status" == *"COMPLETE"* ]]; then
                log_success "✓ Infrastructure stack ready: $stack"
            else
                log_warning "⚠ Infrastructure stack in transition: $stack ($status)"
            fi
        else
            missing_stacks+=("$stack")
        fi
    done
    
    if [ ${#missing_stacks[@]} -gt 0 ]; then
        log_error "Missing infrastructure stacks: ${missing_stacks[*]}"
        log_error ""
        log_error "🚨 REQUIRED: Run infrastructure setup first:"
        log_error "   ./scripts/setup-aws-infrastructure.sh"
        log_error ""
        exit 1
    fi
    
    log_success "All required infrastructure stacks are ready"
}

# Function to deploy ECS application stack
deploy_ecs_application() {
    log_info "Deploying ECS application stack..."
    
    local stack_name="${PROJECT_NAME}-${ENVIRONMENT}-ecs"
    local template_file="./infrastructure/cloudformation/ecs-minimal.yml"
    
    # Check if we have the required parameters
    if [ -z "$SESSION_SECRET" ]; then
        log_info "Generating session secret..."
        SESSION_SECRET=$(openssl rand -base64 32 2>/dev/null || date | md5sum | head -c 32)
    fi
    
    # Get database password from Secrets Manager
    log_info "Retrieving database password from Secrets Manager..."
    local db_secret_name="${PROJECT_NAME}-${ENVIRONMENT}-database-secret"
    local db_password=$(aws secretsmanager get-secret-value \
        --secret-id "$db_secret_name" \
        --query 'SecretString' \
        --output text \
        --region $REGION \
        --profile $PROFILE | jq -r '.password')
    
    if [ -z "$db_password" ] || [ "$db_password" = "null" ]; then
        log_error "Could not retrieve database password from Secrets Manager"
        exit 1
    fi
    
    log_info "Deploying ECS stack: $stack_name"
    aws cloudformation deploy \
        --template-file "$template_file" \
        --stack-name "$stack_name" \
        --parameter-overrides \
            "ProjectName=${PROJECT_NAME}" \
            "Environment=${ENVIRONMENT}" \
            "SessionSecret=${SESSION_SECRET}" \
            "DatabasePassword=${db_password}" \
        --capabilities CAPABILITY_IAM CAPABILITY_NAMED_IAM \
        --region $REGION \
        --profile $PROFILE
        
    if [ $? -eq 0 ]; then
        log_success "ECS application stack deployed: $stack_name"
    else
        log_error "Failed to deploy ECS application stack: $stack_name"
        exit 1
    fi
}

# Function to prompt for deployment parameters (optional)
prompt_for_parameters() {
    log_info "Optional: Provide session secret (will be generated if not provided)"
    
    read -s -p "Session Secret (32+ characters, or press Enter to generate): " SESSION_SECRET
    echo
    
    # Validate if provided
    if [ -n "$SESSION_SECRET" ] && [ ${#SESSION_SECRET} -lt 32 ]; then
        log_error "Session secret must be at least 32 characters"
        exit 1
    fi
    
    # Generate if not provided
    if [ -z "$SESSION_SECRET" ]; then
        log_info "Generating session secret..."
        SESSION_SECRET=$(openssl rand -base64 32 2>/dev/null || date | md5sum | head -c 32)
        log_success "Session secret generated"
    fi
}

# Function to show deployment status
show_deployment_status() {
    log_success "🎮 Game deployment completed!"
    log_info "Deployment Status:"
    
    # Get ALB DNS name
    local alb_dns=$(aws cloudformation describe-stacks \
        --stack-name "${PROJECT_NAME}-${ENVIRONMENT}-ecs" \
        --query 'Stacks[0].Outputs[?OutputKey==`LoadBalancerDNS`].OutputValue' \
        --output text \
        --region $REGION \
        --profile $PROFILE 2>/dev/null)
    
    # Get ECS service status
    local service_status=$(aws ecs describe-services \
        --cluster "${PROJECT_NAME}-${ENVIRONMENT}" \
        --services "${PROJECT_NAME}-${ENVIRONMENT}" \
        --query 'services[0].status' \
        --output text \
        --region $REGION \
        --profile $PROFILE 2>/dev/null || echo "Unknown")
    
    # Get running task count
    local running_tasks=$(aws ecs describe-services \
        --cluster "${PROJECT_NAME}-${ENVIRONMENT}" \
        --services "${PROJECT_NAME}-${ENVIRONMENT}" \
        --query 'services[0].runningCount' \
        --output text \
        --region $REGION \
        --profile $PROFILE 2>/dev/null || echo "0")
    
    echo
    log_info "🎯 Application Access:"
    if [ -n "$alb_dns" ] && [ "$alb_dns" != "None" ]; then
        log_success "Game URL: http://$alb_dns"
        log_info "API Health: http://$alb_dns/api/health"
        log_info "High Scores: http://$alb_dns/api/highscores"
    else
        log_warning "Load balancer DNS not yet available (deployment may still be in progress)"
    fi
    
    echo
    log_info "📊 Service Status:"
    log_info "• ECS Service Status: $service_status"
    log_info "• Running Tasks: $running_tasks"
    
    echo
    if [ "$service_status" = "ACTIVE" ] && [ "$running_tasks" -gt 0 ]; then
        log_success "🎉 Game is running and ready to play!"
    else
        log_warning "⏳ Deployment in progress - check ECS console for details"
    fi
}

# Main deployment function
main() {
    log_info "🎮 Starting game deployment for Banana Pajama Zombie Shooter"
    
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
            --skip-build)
                SKIP_BUILD=true
                shift
                ;;
            --help)
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "🎮 Deploys the Banana Pajama Zombie Shooter game to existing AWS infrastructure"
                echo ""
                echo "This script ONLY handles game deployment - it does NOT create infrastructure."
                echo ""
                echo "Options:"
                echo "  --environment ENV    Deployment environment (default: production)"
                echo "  --region REGION      AWS region (default: us-east-1)"
                echo "  --profile PROFILE    AWS profile (default: default)"
                echo "  --skip-build         Skip Docker image build/push (use existing images)"
                echo ""
                echo "📋 Two-Step Process:"
                echo "  1. First time:  ./scripts/setup-aws-infrastructure.sh  (creates AWS resources)"
                echo "  2. Deploy game: ./scripts/deploy-aws.sh               (deploys application)"
                echo ""
                echo "🔄 For subsequent deployments, only run step 2"
                echo ""
                echo "Prerequisites:"
                echo "• AWS infrastructure must exist (VPC, RDS, ECR repositories, etc.)"
                echo "• Docker must be running for image builds"
                echo "• AWS CLI configured with deployment permissions"
                exit 0
                ;;
            *)
                log_error "Unknown parameter: $1"
                exit 1
                ;;
        esac
    done
    
    log_info "Configuration:"
    log_info "• Environment: $ENVIRONMENT"
    log_info "• Region: $REGION"
    log_info "• Profile: $PROFILE"
    log_info "• Skip Build: ${SKIP_BUILD:-false}"
    echo
    
    # Get AWS Account ID
    AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text --profile $PROFILE)
    
    # Check prerequisites
    check_prerequisites
    
    # Verify infrastructure exists
    verify_infrastructure
    
    # Verify ECR repositories exist
    verify_ecr_repositories
    
    # Build and push images (unless skipped)
    if [ "$SKIP_BUILD" != "true" ]; then
        # Prompt for parameters (session secret)
        prompt_for_parameters
        
        # Build and push images
        build_and_push_images
    else
        log_info "Skipping Docker image build (--skip-build flag used)"
        # Still need session secret for deployment
        prompt_for_parameters
    fi
    
    # Deploy ECS application
    deploy_ecs_application
    
    # Show deployment status
    echo
    show_deployment_status
    
    echo
    log_success "🎉 Game deployment completed successfully!"
    echo
    log_info "📋 Next steps:"
    log_info "• Game should be accessible via the URL above"
    log_info "• Check ECS console if deployment is still in progress"
    log_info "• Monitor CloudWatch logs for any issues"
    echo
    log_info "🔄 For future deployments:"
    log_info "• Code changes: Just run ./scripts/deploy-aws.sh again"
    log_info "• Quick updates: Use ./scripts/deploy-aws.sh --skip-build"
    echo
    log_info "🧹 When finished:"
    log_info "• Use ./scripts/teardown-aws.sh to clean up AWS resources"
}

# Run main function
main "$@"