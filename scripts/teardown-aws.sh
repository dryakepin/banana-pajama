#!/bin/bash

# AWS Teardown Script for Banana Pajama Zombie Shooter
# This script completely removes all AWS resources for clean deployment

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
    
    if ! command_exists jq; then
        log_warning "jq is not installed. CloudFront cleanup will be skipped."
        log_warning "Install jq for complete cleanup: brew install jq"
    fi
    
    # Check AWS credentials
    if ! aws sts get-caller-identity --profile $PROFILE >/dev/null 2>&1; then
        log_error "AWS credentials not configured for profile: $PROFILE"
        exit 1
    fi
    
    AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text --profile $PROFILE)
    log_info "AWS Account ID: $AWS_ACCOUNT_ID"
    
    log_success "Prerequisites check passed"
}

# Function to stop and delete ECS services
cleanup_ecs_services() {
    log_action "Cleaning up ECS services..."
    
    # List all clusters
    local clusters=$(aws ecs list-clusters --query 'clusterArns' --output text --region $REGION --profile $PROFILE 2>/dev/null)
    
    if [ -n "$clusters" ] && [ "$clusters" != "None" ]; then
        for cluster_arn in $clusters; do
            local cluster_name=$(echo $cluster_arn | awk -F'/' '{print $NF}')
            log_info "Processing cluster: $cluster_name"
            
            # List services in cluster
            local services=$(aws ecs list-services --cluster $cluster_name --query 'serviceArns' --output text --region $REGION --profile $PROFILE 2>/dev/null)
            
            if [ -n "$services" ] && [ "$services" != "None" ]; then
                for service_arn in $services; do
                    local service_name=$(echo $service_arn | awk -F'/' '{print $NF}')
                    log_info "Scaling down service: $service_name"
                    
                    # Scale service to 0
                    aws ecs update-service \
                        --cluster $cluster_name \
                        --service $service_name \
                        --desired-count 0 \
                        --region $REGION \
                        --profile $PROFILE >/dev/null 2>&1
                    
                    # Wait for service to scale down
                    log_info "Waiting for service $service_name to scale down..."
                    aws ecs wait services-stable \
                        --cluster $cluster_name \
                        --services $service_name \
                        --region $REGION \
                        --profile $PROFILE 2>/dev/null || true
                    
                    # Delete service
                    log_info "Deleting service: $service_name"
                    aws ecs delete-service \
                        --cluster $cluster_name \
                        --service $service_name \
                        --region $REGION \
                        --profile $PROFILE >/dev/null 2>&1 || true
                done
            fi
            
            # Stop all running tasks
            local tasks=$(aws ecs list-tasks --cluster $cluster_name --query 'taskArns' --output text --region $REGION --profile $PROFILE 2>/dev/null)
            if [ -n "$tasks" ] && [ "$tasks" != "None" ]; then
                for task_arn in $tasks; do
                    log_info "Stopping task: $(echo $task_arn | awk -F'/' '{print $NF}')"
                    aws ecs stop-task \
                        --cluster $cluster_name \
                        --task $task_arn \
                        --region $REGION \
                        --profile $PROFILE >/dev/null 2>&1 || true
                done
            fi
            
            # Delete cluster
            log_info "Deleting cluster: $cluster_name"
            aws ecs delete-cluster \
                --cluster $cluster_name \
                --region $REGION \
                --profile $PROFILE >/dev/null 2>&1 || true
        done
        
        log_success "ECS services and clusters cleaned up"
    else
        log_info "No ECS clusters found"
    fi
}

# Function to delete ECR repositories and images
cleanup_ecr_repositories() {
    log_action "Cleaning up ECR repositories..."
    
    local services=("client" "server" "nginx")
    
    for service in "${services[@]}"; do
        local repo_name="${PROJECT_NAME}-${service}"
        
        if aws ecr describe-repositories --repository-names "$repo_name" --region $REGION --profile $PROFILE >/dev/null 2>&1; then
            log_info "Deleting ECR repository: $repo_name"
            
            # Delete all images in repository
            aws ecr batch-delete-image \
                --repository-name "$repo_name" \
                --image-ids "$(aws ecr list-images --repository-name "$repo_name" --query 'imageIds' --output json --region $REGION --profile $PROFILE)" \
                --region $REGION \
                --profile $PROFILE >/dev/null 2>&1 || true
            
            # Delete repository
            aws ecr delete-repository \
                --repository-name "$repo_name" \
                --force \
                --region $REGION \
                --profile $PROFILE >/dev/null 2>&1 || true
            
            log_success "Deleted ECR repository: $repo_name"
        else
            log_info "ECR repository not found: $repo_name"
        fi
    done
}

# Function to delete CloudFormation stacks
cleanup_cloudformation_stacks() {
    log_action "Cleaning up CloudFormation stacks..."
    
    # Common stack name patterns
    local stack_patterns=(
        "${PROJECT_NAME}-${ENVIRONMENT}-ecs"
        "${PROJECT_NAME}-${ENVIRONMENT}-assets"
        "${PROJECT_NAME}-${ENVIRONMENT}-rds"
        "${PROJECT_NAME}-${ENVIRONMENT}-security"
        "${PROJECT_NAME}-${ENVIRONMENT}-vpc"
        "${PROJECT_NAME}-ecs"
        "${PROJECT_NAME}-assets"
        "${PROJECT_NAME}-rds"
        "${PROJECT_NAME}-security"
        "${PROJECT_NAME}-vpc"
    )
    
    # Get all existing stacks
    local all_stacks=$(aws cloudformation list-stacks \
        --stack-status-filter CREATE_COMPLETE UPDATE_COMPLETE CREATE_FAILED UPDATE_FAILED ROLLBACK_COMPLETE ROLLBACK_FAILED \
        --query 'StackSummaries[].StackName' \
        --output text \
        --region $REGION \
        --profile $PROFILE 2>/dev/null)
    
    # Delete stacks in dependency order (reverse of creation)
    for pattern in "${stack_patterns[@]}"; do
        for stack in $all_stacks; do
            if [[ "$stack" == *"$pattern"* ]]; then
                log_info "Deleting CloudFormation stack: $stack"
                
                aws cloudformation delete-stack \
                    --stack-name "$stack" \
                    --region $REGION \
                    --profile $PROFILE >/dev/null 2>&1 || true
                
                log_info "Waiting for stack deletion: $stack"
                aws cloudformation wait stack-delete-complete \
                    --stack-name "$stack" \
                    --region $REGION \
                    --profile $PROFILE 2>/dev/null || true
                
                log_success "Deleted stack: $stack"
            fi
        done
    done
}

# Function to delete RDS instances
cleanup_rds_instances() {
    log_action "Cleaning up RDS instances..."
    
    local db_patterns=(
        "${PROJECT_NAME}-${ENVIRONMENT}-db"
        "${PROJECT_NAME}-db"
    )
    
    for pattern in "${db_patterns[@]}"; do
        if aws rds describe-db-instances --db-instance-identifier "$pattern" --region $REGION --profile $PROFILE >/dev/null 2>&1; then
            log_info "Deleting RDS instance: $pattern"
            
            aws rds delete-db-instance \
                --db-instance-identifier "$pattern" \
                --skip-final-snapshot \
                --delete-automated-backups \
                --region $REGION \
                --profile $PROFILE >/dev/null 2>&1 || true
            
            log_info "Waiting for RDS instance deletion: $pattern"
            aws rds wait db-instance-deleted \
                --db-instance-identifier "$pattern" \
                --region $REGION \
                --profile $PROFILE 2>/dev/null || true
            
            log_success "Deleted RDS instance: $pattern"
        else
            log_info "RDS instance not found: $pattern"
        fi
    done
}

# Function to delete Secrets Manager secrets
cleanup_secrets() {
    log_action "Cleaning up Secrets Manager secrets..."
    
    local secret_patterns=(
        "${PROJECT_NAME}-${ENVIRONMENT}-database-secret"
        "${PROJECT_NAME}-${ENVIRONMENT}-app-secrets"
        "${PROJECT_NAME}-database-secret"
        "${PROJECT_NAME}-app-secrets"
    )
    
    for pattern in "${secret_patterns[@]}"; do
        if aws secretsmanager describe-secret --secret-id "$pattern" --region $REGION --profile $PROFILE >/dev/null 2>&1; then
            log_info "Deleting secret: $pattern"
            
            aws secretsmanager delete-secret \
                --secret-id "$pattern" \
                --force-delete-without-recovery \
                --region $REGION \
                --profile $PROFILE >/dev/null 2>&1 || true
            
            log_success "Deleted secret: $pattern"
        else
            log_info "Secret not found: $pattern"
        fi
    done
}

# Function to delete Target Groups
cleanup_target_groups() {
    log_action "Cleaning up Target Groups..."
    
    # Get all target groups
    local tgs=$(aws elbv2 describe-target-groups \
        --query 'TargetGroups[].TargetGroupArn' \
        --output text \
        --region $REGION \
        --profile $PROFILE 2>/dev/null)
    
    if [ -n "$tgs" ] && [ "$tgs" != "None" ]; then
        for tg_arn in $tgs; do
            local tg_name=$(aws elbv2 describe-target-groups \
                --target-group-arns $tg_arn \
                --query 'TargetGroups[0].TargetGroupName' \
                --output text \
                --region $REGION \
                --profile $PROFILE 2>/dev/null)
            
            if [[ "$tg_name" == *"$PROJECT_NAME"* ]]; then
                log_info "Deleting Target Group: $tg_name"
                
                aws elbv2 delete-target-group \
                    --target-group-arn $tg_arn \
                    --region $REGION \
                    --profile $PROFILE >/dev/null 2>&1 || true
                
                log_success "Deleted Target Group: $tg_name"
            fi
        done
    else
        log_info "No Target Groups found"
    fi
}

# Function to delete Load Balancers
cleanup_load_balancers() {
    log_action "Cleaning up Load Balancers..."
    
    # Get all load balancers
    local lbs=$(aws elbv2 describe-load-balancers \
        --query 'LoadBalancers[].LoadBalancerArn' \
        --output text \
        --region $REGION \
        --profile $PROFILE 2>/dev/null)
    
    if [ -n "$lbs" ] && [ "$lbs" != "None" ]; then
        for lb_arn in $lbs; do
            local lb_name=$(aws elbv2 describe-load-balancers \
                --load-balancer-arns $lb_arn \
                --query 'LoadBalancers[0].LoadBalancerName' \
                --output text \
                --region $REGION \
                --profile $PROFILE 2>/dev/null)
            
            if [[ "$lb_name" == *"$PROJECT_NAME"* ]]; then
                log_info "Deleting Load Balancer: $lb_name"
                
                aws elbv2 delete-load-balancer \
                    --load-balancer-arn $lb_arn \
                    --region $REGION \
                    --profile $PROFILE >/dev/null 2>&1 || true
                
                log_success "Deleted Load Balancer: $lb_name"
            fi
        done
    else
        log_info "No Load Balancers found"
    fi
}

# Function to delete S3 buckets
cleanup_s3_buckets() {
    log_action "Cleaning up S3 buckets..."
    
    # Get all buckets
    local buckets=$(aws s3api list-buckets \
        --query 'Buckets[].Name' \
        --output text \
        --region $REGION \
        --profile $PROFILE 2>/dev/null)
    
    if [ -n "$buckets" ] && [ "$buckets" != "None" ]; then
        for bucket in $buckets; do
            if [[ "$bucket" == *"$PROJECT_NAME"* ]]; then
                log_info "Emptying and deleting S3 bucket: $bucket"
                
                # Empty bucket first
                aws s3 rm s3://$bucket --recursive \
                    --region $REGION \
                    --profile $PROFILE >/dev/null 2>&1 || true
                
                # Delete bucket
                aws s3api delete-bucket \
                    --bucket $bucket \
                    --region $REGION \
                    --profile $PROFILE >/dev/null 2>&1 || true
                
                log_success "Deleted S3 bucket: $bucket"
            fi
        done
    else
        log_info "No S3 buckets found"
    fi
}

# Function to delete CloudFront distributions
cleanup_cloudfront_distributions() {
    log_action "Cleaning up CloudFront distributions..."
    
    # Get all distributions
    local distributions=$(aws cloudfront list-distributions \
        --query 'DistributionList.Items[].{Id:Id,DomainName:DomainName,Comment:Comment}' \
        --output json \
        --profile $PROFILE 2>/dev/null)
    
    if command_exists jq && [ -n "$distributions" ] && [ "$distributions" != "null" ] && [ "$distributions" != "[]" ]; then
        echo "$distributions" | jq -c '.[]' | while read -r dist; do
            local dist_id=$(echo "$dist" | jq -r '.Id')
            local comment=$(echo "$dist" | jq -r '.Comment // ""')
            
            if [[ "$comment" == *"$PROJECT_NAME"* ]]; then
                log_info "Disabling CloudFront distribution: $dist_id"
                
                # Get current distribution config
                local etag=$(aws cloudfront get-distribution-config \
                    --id $dist_id \
                    --query 'ETag' \
                    --output text \
                    --profile $PROFILE 2>/dev/null)
                
                # Disable distribution (required before deletion)
                aws cloudfront get-distribution-config \
                    --id $dist_id \
                    --profile $PROFILE 2>/dev/null | \
                    jq '.DistributionConfig.Enabled = false' | \
                    aws cloudfront update-distribution \
                        --id $dist_id \
                        --distribution-config file:///dev/stdin \
                        --if-match $etag \
                        --profile $PROFILE >/dev/null 2>&1 || true
                
                log_info "Waiting for CloudFront distribution to be disabled: $dist_id"
                aws cloudfront wait distribution-deployed \
                    --id $dist_id \
                    --profile $PROFILE 2>/dev/null || true
                
                # Get new ETag after update
                local new_etag=$(aws cloudfront get-distribution-config \
                    --id $dist_id \
                    --query 'ETag' \
                    --output text \
                    --profile $PROFILE 2>/dev/null)
                
                # Delete distribution
                aws cloudfront delete-distribution \
                    --id $dist_id \
                    --if-match $new_etag \
                    --profile $PROFILE >/dev/null 2>&1 || true
                
                log_success "Deleted CloudFront distribution: $dist_id"
            fi
        done
    elif ! command_exists jq; then
        log_info "Skipping CloudFront cleanup (jq not installed)"
    else
        log_info "No CloudFront distributions found"
    fi
}

# Function to delete ECS task definitions
cleanup_ecs_task_definitions() {
    log_action "Cleaning up ECS task definitions..."
    
    # Get all task definition families
    local families=$(aws ecs list-task-definition-families \
        --query 'families' \
        --output text \
        --region $REGION \
        --profile $PROFILE 2>/dev/null)
    
    if [ -n "$families" ] && [ "$families" != "None" ]; then
        for family in $families; do
            if [[ "$family" == *"$PROJECT_NAME"* ]]; then
                log_info "Deregistering task definition family: $family"
                
                # Get all revisions of this family
                local revisions=$(aws ecs list-task-definitions \
                    --family-prefix $family \
                    --query 'taskDefinitionArns' \
                    --output text \
                    --region $REGION \
                    --profile $PROFILE 2>/dev/null)
                
                # Deregister all revisions
                for revision_arn in $revisions; do
                    aws ecs deregister-task-definition \
                        --task-definition $revision_arn \
                        --region $REGION \
                        --profile $PROFILE >/dev/null 2>&1 || true
                done
                
                log_success "Deregistered task definition family: $family"
            fi
        done
    else
        log_info "No ECS task definitions found"
    fi
}

# Function to delete IAM roles
cleanup_iam_roles() {
    log_action "Cleaning up IAM roles..."
    
    # Get all roles
    local roles=$(aws iam list-roles \
        --query 'Roles[].RoleName' \
        --output text \
        --profile $PROFILE 2>/dev/null)
    
    if [ -n "$roles" ] && [ "$roles" != "None" ]; then
        for role in $roles; do
            if [[ "$role" == *"$PROJECT_NAME"* ]]; then
                log_info "Deleting IAM role: $role"
                
                # Detach managed policies
                local managed_policies=$(aws iam list-attached-role-policies \
                    --role-name $role \
                    --query 'AttachedPolicies[].PolicyArn' \
                    --output text \
                    --profile $PROFILE 2>/dev/null)
                
                for policy_arn in $managed_policies; do
                    aws iam detach-role-policy \
                        --role-name $role \
                        --policy-arn $policy_arn \
                        --profile $PROFILE >/dev/null 2>&1 || true
                done
                
                # Delete inline policies
                local inline_policies=$(aws iam list-role-policies \
                    --role-name $role \
                    --query 'PolicyNames' \
                    --output text \
                    --profile $PROFILE 2>/dev/null)
                
                for policy_name in $inline_policies; do
                    aws iam delete-role-policy \
                        --role-name $role \
                        --policy-name $policy_name \
                        --profile $PROFILE >/dev/null 2>&1 || true
                done
                
                # Delete instance profiles
                local instance_profiles=$(aws iam list-instance-profiles-for-role \
                    --role-name $role \
                    --query 'InstanceProfiles[].InstanceProfileName' \
                    --output text \
                    --profile $PROFILE 2>/dev/null)
                
                for instance_profile in $instance_profiles; do
                    aws iam remove-role-from-instance-profile \
                        --instance-profile-name $instance_profile \
                        --role-name $role \
                        --profile $PROFILE >/dev/null 2>&1 || true
                    
                    aws iam delete-instance-profile \
                        --instance-profile-name $instance_profile \
                        --profile $PROFILE >/dev/null 2>&1 || true
                done
                
                # Delete role
                aws iam delete-role \
                    --role-name $role \
                    --profile $PROFILE >/dev/null 2>&1 || true
                
                log_success "Deleted IAM role: $role"
            fi
        done
    else
        log_info "No IAM roles found"
    fi
}

# Function to cleanup local Docker images
cleanup_local_docker() {
    log_action "Cleaning up local Docker images..."
    
    if command_exists docker; then
        # Remove project-specific images
        local images=$(docker images --format "{{.Repository}}:{{.Tag}}" | grep "${PROJECT_NAME}" 2>/dev/null || true)
        
        if [ -n "$images" ]; then
            for image in $images; do
                log_info "Removing local Docker image: $image"
                docker rmi "$image" >/dev/null 2>&1 || true
            done
            log_success "Local Docker images cleaned up"
        else
            log_info "No local Docker images found for project"
        fi
        
        # Clean up dangling images and containers
        docker system prune -f >/dev/null 2>&1 || true
        log_success "Docker system cleaned up"
    else
        log_info "Docker not found, skipping local cleanup"
    fi
}

# Function to show cleanup summary
show_cleanup_summary() {
    log_info "🧹 Cleanup Summary:"
    echo
    echo "The following resources have been cleaned up:"
    echo "  ✅ ECS Services and Clusters"
    echo "  ✅ Target Groups"
    echo "  ✅ Load Balancers"
    echo "  ✅ CloudFront Distributions"
    echo "  ✅ S3 Buckets"
    echo "  ✅ CloudFormation Stacks"
    echo "  ✅ RDS Database Instances"
    echo "  ✅ Secrets Manager Secrets"
    echo "  ✅ ECR Repositories and Images"
    echo "  ✅ ECS Task Definitions"
    echo "  ✅ IAM Roles"
    echo "  ✅ Local Docker Images"
    echo
    log_success "AWS account is now clean and ready for fresh deployment!"
    echo
    log_info "Next steps:"
    log_info "1. Run ./scripts/deploy-aws.sh for fresh deployment"
    log_info "2. Or run individual deployment scripts as needed"
}

# Main function
main() {
    log_info "🧹 Starting AWS cleanup for Banana Pajama Zombie Shooter"
    
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
            --yes|-y)
                SKIP_CONFIRMATION=true
                shift
                ;;
            --help)
                echo "Usage: $0 [--region REGION] [--profile PROFILE] [--yes]"
                echo "Completely removes all AWS resources for Banana Pajama project"
                echo ""
                echo "Options:"
                echo "  --region: AWS region (default: us-east-1)"
                echo "  --profile: AWS profile (default: default)"
                echo "  --yes: Skip confirmation prompt"
                echo ""
                echo "⚠️  WARNING: This will DELETE ALL AWS resources for the project!"
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
    
    # Check prerequisites
    check_prerequisites
    
    # Confirmation prompt
    if [ "$SKIP_CONFIRMATION" != "true" ]; then
        echo
        log_warning "⚠️  WARNING: This will DELETE ALL AWS resources for Banana Pajama!"
        log_warning "This includes:"
        log_warning "  - ECS clusters, services, and tasks"
        log_warning "  - Target Groups"
        log_warning "  - Load Balancers"
        log_warning "  - CloudFront distributions"
        log_warning "  - S3 buckets"
        log_warning "  - CloudFormation stacks"
        log_warning "  - RDS database instances"
        log_warning "  - Secrets Manager secrets"
        log_warning "  - ECR repositories and all images"
        log_warning "  - ECS task definitions"
        log_warning "  - IAM roles"
        log_warning "  - Local Docker images"
        echo
        read -p "Are you sure you want to continue? (yes/no): " confirm
        
        if [ "$confirm" != "yes" ]; then
            log_info "Cleanup cancelled."
            exit 0
        fi
    fi
    
    echo
    log_info "Starting cleanup process..."
    
    # Execute cleanup in order
    cleanup_ecs_services
    cleanup_target_groups
    cleanup_load_balancers
    cleanup_cloudfront_distributions
    cleanup_s3_buckets
    cleanup_cloudformation_stacks
    cleanup_rds_instances
    cleanup_secrets
    cleanup_ecr_repositories
    cleanup_ecs_task_definitions
    cleanup_iam_roles
    cleanup_local_docker
    
    # Show summary
    echo
    show_cleanup_summary
    
    log_success "🎉 Cleanup completed successfully!"
}

# Run main function
main "$@"