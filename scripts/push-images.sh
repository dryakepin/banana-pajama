#!/bin/bash

# Push Docker Images to ECR Script for Banana Pajama Zombie Shooter
# This script pushes built Docker images to Amazon ECR

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
        log_error "Docker is not installed. Please install Docker Desktop first."
        exit 1
    fi
    
    # Check AWS credentials
    if ! aws sts get-caller-identity --profile $PROFILE >/dev/null 2>&1; then
        log_error "AWS credentials not configured for profile: $PROFILE"
        exit 1
    fi
    
    # Check if Docker is running
    if ! docker info >/dev/null 2>&1; then
        log_error "Docker is not running. Please start Docker Desktop."
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Function to get AWS account ID
get_account_id() {
    AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text --profile $PROFILE)
    if [ -z "$AWS_ACCOUNT_ID" ]; then
        log_error "Failed to get AWS Account ID"
        exit 1
    fi
    log_info "AWS Account ID: $AWS_ACCOUNT_ID"
}

# Function to login to ECR
ecr_login() {
    log_info "Logging into Amazon ECR..."
    
    aws ecr get-login-password --region $REGION --profile $PROFILE | \
    docker login --username AWS --password-stdin "${AWS_ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"
    
    if [ $? -eq 0 ]; then
        log_success "Successfully logged into ECR"
    else
        log_error "Failed to login to ECR"
        exit 1
    fi
}

# Function to check if image exists locally
check_local_image() {
    local image_name=$1
    if docker image inspect "${image_name}:latest" >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Function to push image to ECR
push_image() {
    local service_name=$1
    local local_image="${PROJECT_NAME}-${service_name}:latest"
    local ecr_image="${AWS_ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${PROJECT_NAME}-${service_name}:latest"
    
    log_info "Processing ${service_name} image..."
    
    # Check if local image exists
    if ! check_local_image "${PROJECT_NAME}-${service_name}"; then
        log_error "Local image ${local_image} not found. Please run ./scripts/build-images.sh first."
        exit 1
    fi
    
    # Tag image for ECR
    log_info "Tagging ${local_image} as ${ecr_image}"
    docker tag "${local_image}" "${ecr_image}"
    
    # Push image to ECR
    log_info "Pushing ${service_name} image to ECR..."
    docker push "${ecr_image}"
    
    if [ $? -eq 0 ]; then
        log_success "Successfully pushed ${service_name} image"
    else
        log_error "Failed to push ${service_name} image"
        exit 1
    fi
}

# Function to verify ECR repositories exist
verify_ecr_repositories() {
    log_info "Verifying ECR repositories exist..."
    
    local services=("client" "server" "nginx")
    
    for service in "${services[@]}"; do
        local repo_name="${PROJECT_NAME}-${service}"
        
        if aws ecr describe-repositories --repository-names "$repo_name" \
           --region $REGION --profile $PROFILE >/dev/null 2>&1; then
            log_success "ECR repository exists: $repo_name"
        else
            log_warning "ECR repository not found: $repo_name"
            log_info "Creating ECR repository: $repo_name"
            
            aws ecr create-repository --repository-name "$repo_name" \
                --region $REGION --profile $PROFILE >/dev/null
            
            if [ $? -eq 0 ]; then
                log_success "Created ECR repository: $repo_name"
            else
                log_error "Failed to create ECR repository: $repo_name"
                exit 1
            fi
        fi
    done
}

# Function to show image information
show_image_info() {
    log_info "Pushed images:"
    
    local services=("client" "server" "nginx")
    
    for service in "${services[@]}"; do
        local repo_name="${PROJECT_NAME}-${service}"
        local image_uri="${AWS_ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${repo_name}:latest"
        
        echo "  ${service}: ${image_uri}"
    done
}

# Main function
main() {
    log_info "🍌 Pushing Docker images to Amazon ECR"
    
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
                echo "Pushes Docker images to Amazon ECR"
                echo ""
                echo "Options:"
                echo "  --region: AWS region (default: us-east-1)"
                echo "  --profile: AWS profile (default: default)"
                echo ""
                echo "Prerequisites:"
                echo "  - Docker images must be built (run ./scripts/build-images.sh first)"
                echo "  - AWS credentials configured"
                echo "  - ECR repositories exist (will be created if missing)"
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
    get_account_id
    verify_ecr_repositories
    ecr_login
    
    # Push all images
    push_image "client"
    push_image "server"
    push_image "nginx"
    
    # Show results
    show_image_info
    
    log_success "🎉 All Docker images pushed to ECR successfully!"
    log_info "Next step: Update ECS task definition to use these images"
}

# Run main function
main "$@"