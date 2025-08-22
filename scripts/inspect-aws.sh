#!/bin/bash

# AWS Inspection Script for Banana Pajama Zombie Shooter
# This script lists all AWS resources without deleting them

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

log_found() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_section() {
    echo -e "${PURPLE}🔍 $1${NC}"
}

# Function to check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    if ! command -v aws >/dev/null 2>&1; then
        echo "❌ AWS CLI is not installed. Please install it first."
        exit 1
    fi
    
    # Check AWS credentials
    if ! aws sts get-caller-identity --profile $PROFILE >/dev/null 2>&1; then
        echo "❌ AWS credentials not configured for profile: $PROFILE"
        exit 1
    fi
    
    AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text --profile $PROFILE)
    log_info "AWS Account ID: $AWS_ACCOUNT_ID"
    log_info "AWS Region: $REGION"
    log_info "AWS Profile: $PROFILE"
}

# Function to inspect ECS resources
inspect_ecs() {
    log_section "ECS Clusters and Services"
    
    local clusters=$(aws ecs list-clusters --query 'clusterArns' --output text --region $REGION --profile $PROFILE 2>/dev/null)
    
    if [ -n "$clusters" ] && [ "$clusters" != "None" ]; then
        for cluster_arn in $clusters; do
            local cluster_name=$(echo $cluster_arn | awk -F'/' '{print $NF}')
            log_found "Cluster: $cluster_name"
            
            # List services in cluster
            local services=$(aws ecs list-services --cluster $cluster_name --query 'serviceArns' --output text --region $REGION --profile $PROFILE 2>/dev/null)
            
            if [ -n "$services" ] && [ "$services" != "None" ]; then
                for service_arn in $services; do
                    local service_name=$(echo $service_arn | awk -F'/' '{print $NF}')
                    local desired_count=$(aws ecs describe-services --cluster $cluster_name --services $service_name --query 'services[0].desiredCount' --output text --region $REGION --profile $PROFILE 2>/dev/null)
                    local running_count=$(aws ecs describe-services --cluster $cluster_name --services $service_name --query 'services[0].runningCount' --output text --region $REGION --profile $PROFILE 2>/dev/null)
                    log_found "  Service: $service_name (desired: $desired_count, running: $running_count)"
                done
            else
                log_info "  No services in this cluster"
            fi
            
            # List tasks
            local tasks=$(aws ecs list-tasks --cluster $cluster_name --query 'taskArns' --output text --region $REGION --profile $PROFILE 2>/dev/null)
            if [ -n "$tasks" ] && [ "$tasks" != "None" ]; then
                local task_count=$(echo $tasks | wc -w)
                log_found "  Running tasks: $task_count"
            fi
        done
    else
        log_info "No ECS clusters found"
    fi
    echo
}

# Function to inspect ECR repositories
inspect_ecr() {
    log_section "ECR Repositories"
    
    local services=("client" "server" "nginx")
    
    for service in "${services[@]}"; do
        local repo_name="${PROJECT_NAME}-${service}"
        
        if aws ecr describe-repositories --repository-names "$repo_name" --region $REGION --profile $PROFILE >/dev/null 2>&1; then
            local image_count=$(aws ecr list-images --repository-name "$repo_name" --query 'length(imageIds)' --output text --region $REGION --profile $PROFILE 2>/dev/null)
            local repo_size=$(aws ecr describe-repositories --repository-names "$repo_name" --query 'repositories[0].repositorySizeInBytes' --output text --region $REGION --profile $PROFILE 2>/dev/null)
            log_found "Repository: $repo_name ($image_count images, $(($repo_size / 1024 / 1024)) MB)"
        else
            log_info "Repository not found: $repo_name"
        fi
    done
    echo
}

# Function to inspect CloudFormation stacks
inspect_cloudformation() {
    log_section "CloudFormation Stacks"
    
    local stacks=$(aws cloudformation list-stacks \
        --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE CREATE_FAILED UPDATE_FAILED ROLLBACK_COMPLETE ROLLBACK_FAILED CREATE_IN_PROGRESS UPDATE_IN_PROGRESS \
        --query 'StackSummaries[].[StackName,StackStatus]' \
        --output text \
        --region $REGION \
        --profile $PROFILE 2>/dev/null)
    
    if [ -n "$stacks" ]; then
        while IFS=$'\t' read -r stack_name stack_status; do
            if [[ "$stack_name" == *"$PROJECT_NAME"* ]] || [[ "$stack_name" == *"banana"* ]]; then
                log_found "Stack: $stack_name ($stack_status)"
            fi
        done <<< "$stacks"
    else
        log_info "No CloudFormation stacks found"
    fi
    echo
}

# Function to inspect RDS instances
inspect_rds() {
    log_section "RDS Database Instances"
    
    local db_instances=$(aws rds describe-db-instances \
        --query 'DBInstances[].[DBInstanceIdentifier,DBInstanceStatus,Engine,DBInstanceClass]' \
        --output text \
        --region $REGION \
        --profile $PROFILE 2>/dev/null)
    
    if [ -n "$db_instances" ]; then
        while IFS=$'\t' read -r db_id db_status engine class; do
            if [[ "$db_id" == *"$PROJECT_NAME"* ]] || [[ "$db_id" == *"banana"* ]]; then
                log_found "Database: $db_id ($engine, $class, $db_status)"
            fi
        done <<< "$db_instances"
    else
        log_info "No RDS instances found"
    fi
    echo
}

# Function to inspect Secrets Manager
inspect_secrets() {
    log_section "Secrets Manager"
    
    local secrets=$(aws secretsmanager list-secrets \
        --query 'SecretList[].[Name,Description]' \
        --output text \
        --region $REGION \
        --profile $PROFILE 2>/dev/null)
    
    if [ -n "$secrets" ]; then
        while IFS=$'\t' read -r secret_name description; do
            if [[ "$secret_name" == *"$PROJECT_NAME"* ]] || [[ "$secret_name" == *"banana"* ]]; then
                log_found "Secret: $secret_name"
                [ -n "$description" ] && log_info "  Description: $description"
            fi
        done <<< "$secrets"
    else
        log_info "No secrets found"
    fi
    echo
}

# Function to inspect Load Balancers
inspect_load_balancers() {
    log_section "Load Balancers"
    
    local lbs=$(aws elbv2 describe-load-balancers \
        --query 'LoadBalancers[].[LoadBalancerName,DNSName,State.Code,Type]' \
        --output text \
        --region $REGION \
        --profile $PROFILE 2>/dev/null)
    
    if [ -n "$lbs" ]; then
        while IFS=$'\t' read -r lb_name dns_name state lb_type; do
            if [[ "$lb_name" == *"$PROJECT_NAME"* ]] || [[ "$lb_name" == *"banana"* ]] || [[ "$dns_name" == *"banana"* ]]; then
                log_found "Load Balancer: $lb_name ($lb_type, $state)"
                log_info "  DNS: $dns_name"
            fi
        done <<< "$lbs"
    else
        log_info "No Load Balancers found"
    fi
    echo
}

# Function to inspect local Docker images
inspect_local_docker() {
    log_section "Local Docker Images"
    
    if command -v docker >/dev/null 2>&1; then
        local images=$(docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}" | grep "${PROJECT_NAME}" 2>/dev/null || true)
        
        if [ -n "$images" ]; then
            echo "$images"
        else
            log_info "No local Docker images found for project"
        fi
    else
        log_info "Docker not found"
    fi
    echo
}

# Function to check current deployment
check_current_deployment() {
    log_section "Current Deployment Status"
    
    # Test the known URL
    local test_url="http://banana-pajama-production-alb-1569928464.us-east-1.elb.amazonaws.com/"
    log_info "Testing known deployment URL: $test_url"
    
    if curl -s --connect-timeout 5 "$test_url" >/dev/null 2>&1; then
        log_found "✅ Current deployment is ACTIVE and responding"
        
        # Check if it has our enhanced fullscreen (new meta tags)
        local has_enhanced=$(curl -s "$test_url" | grep -c "viewport-fit=cover" || echo "0")
        if [ "$has_enhanced" -gt 0 ]; then
            log_found "✅ Enhanced fullscreen implementation detected"
        else
            log_warning "⚠️  Old implementation detected (missing enhanced fullscreen)"
        fi
    else
        log_warning "❌ Current deployment is not responding"
    fi
    echo
}

# Main function
main() {
    log_info "🔍 Inspecting AWS resources for Banana Pajama Zombie Shooter"
    echo
    
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
                echo "Inspects all AWS resources for Banana Pajama project without making changes"
                echo ""
                echo "Options:"
                echo "  --region: AWS region (default: us-east-1)"
                echo "  --profile: AWS profile (default: default)"
                exit 0
                ;;
            *)
                echo "Unknown parameter: $1"
                exit 1
                ;;
        esac
    done
    
    # Check prerequisites
    check_prerequisites
    echo
    
    # Check current deployment first
    check_current_deployment
    
    # Inspect all resources
    inspect_ecs
    inspect_ecr
    inspect_cloudformation
    inspect_rds
    inspect_secrets
    inspect_load_balancers
    inspect_local_docker
    
    log_info "🎯 Inspection complete!"
    echo
    log_info "Next steps:"
    log_info "  - To clean up everything: ./scripts/teardown-aws.sh"
    log_info "  - To deploy fresh: ./scripts/deploy-aws.sh"
}

# Run main function
main "$@"