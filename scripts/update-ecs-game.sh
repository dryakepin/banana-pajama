#!/bin/bash

# Update ECS Service with Game Containers
# This script updates the existing ECS service to run the actual game

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

# Get AWS Account ID
get_account_id() {
    AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text --profile $PROFILE)
    log_info "AWS Account ID: $AWS_ACCOUNT_ID"
}

# Get database endpoint
get_database_endpoint() {
    DATABASE_ENDPOINT=$(aws cloudformation describe-stacks \
        --stack-name "${PROJECT_NAME}-${ENVIRONMENT}-rds" \
        --query 'Stacks[0].Outputs[?OutputKey==`DatabaseEndpoint`].OutputValue' \
        --output text \
        --region $REGION \
        --profile $PROFILE)
    
    if [ -z "$DATABASE_ENDPOINT" ]; then
        log_error "Could not get database endpoint"
        exit 1
    fi
    log_info "Database endpoint: $DATABASE_ENDPOINT"
}

# Get Load Balancer DNS
get_loadbalancer_dns() {
    ALB_DNS=$(aws cloudformation describe-stacks \
        --stack-name "${PROJECT_NAME}-${ENVIRONMENT}-ecs-simple" \
        --query 'Stacks[0].Outputs[?OutputKey==`LoadBalancerDNS`].OutputValue' \
        --output text \
        --region $REGION \
        --profile $PROFILE)
    
    if [ -z "$ALB_DNS" ]; then
        log_error "Could not get load balancer DNS"
        exit 1
    fi
    log_info "Load Balancer DNS: $ALB_DNS"
}

# Create secrets in AWS Secrets Manager
create_secrets() {
    log_info "Creating secrets in AWS Secrets Manager..."
    
    # Database secret
    local db_secret_name="${PROJECT_NAME}-${ENVIRONMENT}-database-secret"
    local db_secret_value=$(cat <<EOF
{
  "username": "postgres",
  "password": "${DATABASE_PASSWORD}",
  "engine": "postgres",
  "host": "${DATABASE_ENDPOINT}",
  "port": 5432,
  "dbname": "banana_pajama"
}
EOF
)
    
    # Check if secret exists
    if aws secretsmanager describe-secret --secret-id "$db_secret_name" --region $REGION --profile $PROFILE >/dev/null 2>&1; then
        log_info "Updating existing database secret..."
        aws secretsmanager update-secret \
            --secret-id "$db_secret_name" \
            --secret-string "$db_secret_value" \
            --region $REGION \
            --profile $PROFILE >/dev/null
    else
        log_info "Creating database secret..."
        aws secretsmanager create-secret \
            --name "$db_secret_name" \
            --description "Database credentials for Banana Pajama" \
            --secret-string "$db_secret_value" \
            --region $REGION \
            --profile $PROFILE >/dev/null
    fi
    
    # Application secret
    local app_secret_name="${PROJECT_NAME}-${ENVIRONMENT}-app-secrets"
    local app_secret_value=$(cat <<EOF
{
  "session_secret": "${SESSION_SECRET}",
  "jwt_secret": "${SESSION_SECRET}",
  "cors_origin": "http://${ALB_DNS}"
}
EOF
)
    
    # Check if secret exists
    if aws secretsmanager describe-secret --secret-id "$app_secret_name" --region $REGION --profile $PROFILE >/dev/null 2>&1; then
        log_info "Updating existing application secret..."
        aws secretsmanager update-secret \
            --secret-id "$app_secret_name" \
            --secret-string "$app_secret_value" \
            --region $REGION \
            --profile $PROFILE >/dev/null
    else
        log_info "Creating application secret..."
        aws secretsmanager create-secret \
            --name "$app_secret_name" \
            --description "Application secrets for Banana Pajama" \
            --secret-string "$app_secret_value" \
            --region $REGION \
            --profile $PROFILE >/dev/null
    fi
    
    log_success "Secrets created/updated successfully"
}

# Create new task definition
create_task_definition() {
    log_info "Creating new ECS task definition with game containers..."
    
    local task_def_json=$(cat <<EOF
{
  "family": "${PROJECT_NAME}-${ENVIRONMENT}-game",
  "cpu": "512",
  "memory": "1024",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "executionRoleArn": "arn:aws:iam::${AWS_ACCOUNT_ID}:role/${PROJECT_NAME}-${ENVIRONMENT}-ecs-simple-ECSTaskExecutionRole-*",
  "containerDefinitions": [
    {
      "name": "nginx",
      "image": "${AWS_ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${PROJECT_NAME}-nginx:latest",
      "essential": true,
      "portMappings": [
        {
          "containerPort": 80,
          "protocol": "tcp"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/${PROJECT_NAME}-${ENVIRONMENT}-nginx",
          "awslogs-region": "${REGION}",
          "awslogs-stream-prefix": "nginx",
          "awslogs-create-group": "true"
        }
      },
      "healthCheck": {
        "command": [
          "CMD-SHELL",
          "wget --no-verbose --tries=1 --spider http://localhost/health || exit 1"
        ],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      },
      "dependsOn": [
        {
          "containerName": "client",
          "condition": "HEALTHY"
        },
        {
          "containerName": "server",
          "condition": "HEALTHY"
        }
      ]
    },
    {
      "name": "client",
      "image": "${AWS_ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${PROJECT_NAME}-client:latest",
      "essential": true,
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/${PROJECT_NAME}-${ENVIRONMENT}-client",
          "awslogs-region": "${REGION}",
          "awslogs-stream-prefix": "client",
          "awslogs-create-group": "true"
        }
      },
      "healthCheck": {
        "command": [
          "CMD-SHELL",
          "wget --no-verbose --tries=1 --spider http://localhost || exit 1"
        ],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      }
    },
    {
      "name": "server",
      "image": "${AWS_ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${PROJECT_NAME}-server:latest",
      "essential": true,
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        },
        {
          "name": "PORT",
          "value": "3000"
        }
      ],
      "secrets": [
        {
          "name": "DB_HOST",
          "valueFrom": "arn:aws:secretsmanager:${REGION}:${AWS_ACCOUNT_ID}:secret:${PROJECT_NAME}-${ENVIRONMENT}-database-secret:host::"
        },
        {
          "name": "DB_PORT",
          "valueFrom": "arn:aws:secretsmanager:${REGION}:${AWS_ACCOUNT_ID}:secret:${PROJECT_NAME}-${ENVIRONMENT}-database-secret:port::"
        },
        {
          "name": "DB_NAME",
          "valueFrom": "arn:aws:secretsmanager:${REGION}:${AWS_ACCOUNT_ID}:secret:${PROJECT_NAME}-${ENVIRONMENT}-database-secret:dbname::"
        },
        {
          "name": "DB_USER",
          "valueFrom": "arn:aws:secretsmanager:${REGION}:${AWS_ACCOUNT_ID}:secret:${PROJECT_NAME}-${ENVIRONMENT}-database-secret:username::"
        },
        {
          "name": "DB_PASSWORD",
          "valueFrom": "arn:aws:secretsmanager:${REGION}:${AWS_ACCOUNT_ID}:secret:${PROJECT_NAME}-${ENVIRONMENT}-database-secret:password::"
        },
        {
          "name": "SESSION_SECRET",
          "valueFrom": "arn:aws:secretsmanager:${REGION}:${AWS_ACCOUNT_ID}:secret:${PROJECT_NAME}-${ENVIRONMENT}-app-secrets:session_secret::"
        },
        {
          "name": "JWT_SECRET",
          "valueFrom": "arn:aws:secretsmanager:${REGION}:${AWS_ACCOUNT_ID}:secret:${PROJECT_NAME}-${ENVIRONMENT}-app-secrets:jwt_secret::"
        },
        {
          "name": "CORS_ORIGIN",
          "valueFrom": "arn:aws:secretsmanager:${REGION}:${AWS_ACCOUNT_ID}:secret:${PROJECT_NAME}-${ENVIRONMENT}-app-secrets:cors_origin::"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/${PROJECT_NAME}-${ENVIRONMENT}-server",
          "awslogs-region": "${REGION}",
          "awslogs-stream-prefix": "server",
          "awslogs-create-group": "true"
        }
      },
      "healthCheck": {
        "command": [
          "CMD",
          "node",
          "healthcheck.js"
        ],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      }
    }
  ]
}
EOF
)
    
    # Register the task definition
    TASK_DEF_ARN=$(echo "$task_def_json" | aws ecs register-task-definition \
        --cli-input-json file:///dev/stdin \
        --region $REGION \
        --profile $PROFILE \
        --query 'taskDefinition.taskDefinitionArn' \
        --output text)
    
    if [ $? -eq 0 ]; then
        log_success "Task definition created: $TASK_DEF_ARN"
        echo "$TASK_DEF_ARN"
    else
        log_error "Failed to create task definition"
        exit 1
    fi
}

# Update ECS service
update_service() {
    local task_def_arn=$1
    
    log_info "Updating ECS service with new task definition..."
    
    # Update the service
    aws ecs update-service \
        --cluster "${PROJECT_NAME}-${ENVIRONMENT}-cluster" \
        --service "${PROJECT_NAME}-${ENVIRONMENT}-service" \
        --task-definition "$task_def_arn" \
        --region $REGION \
        --profile $PROFILE >/dev/null
    
    if [ $? -eq 0 ]; then
        log_success "ECS service update initiated"
    else
        log_error "Failed to update ECS service"
        exit 1
    fi
}

# Wait for deployment
wait_for_deployment() {
    log_info "Waiting for service deployment to complete..."
    
    aws ecs wait services-stable \
        --cluster "${PROJECT_NAME}-${ENVIRONMENT}-cluster" \
        --services "${PROJECT_NAME}-${ENVIRONMENT}-service" \
        --region $REGION \
        --profile $PROFILE
    
    if [ $? -eq 0 ]; then
        log_success "Service deployment completed successfully!"
    else
        log_warning "Service deployment may still be in progress"
    fi
}

# Main function
main() {
    log_info "🍌 Updating ECS service with Banana Pajama game containers"
    
    # Get required parameters
    read -s -p "Database Password: " DATABASE_PASSWORD
    echo
    read -s -p "Session Secret: " SESSION_SECRET
    echo
    
    # Validate inputs
    if [ ${#DATABASE_PASSWORD} -lt 8 ]; then
        log_error "Database password must be at least 8 characters"
        exit 1
    fi
    
    if [ ${#SESSION_SECRET} -lt 32 ]; then
        log_error "Session secret must be at least 32 characters"
        exit 1
    fi
    
    # Run deployment steps
    get_account_id
    get_database_endpoint
    get_loadbalancer_dns
    create_secrets
    
    local task_def_arn
    task_def_arn=$(create_task_definition)
    
    update_service "$task_def_arn"
    wait_for_deployment
    
    log_success "🎉 Game deployment completed!"
    log_info "Your game is now running at: http://$ALB_DNS"
}

# Run main function
main "$@"