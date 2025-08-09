#!/bin/bash

# Build Docker Images Script for Banana Pajama Zombie Shooter
# This script builds all Docker images for deployment

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
    
    if ! command_exists docker; then
        log_error "Docker is not installed. Please install Docker Desktop first."
        exit 1
    fi
    
    # Check if Docker is running
    if ! docker info >/dev/null 2>&1; then
        log_error "Docker is not running. Please start Docker Desktop."
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

# Function to build client image
build_client() {
    log_info "Building client (Phaser.js game) image..."
    
    cd client
    
    # Check if package.json exists
    if [ ! -f "package.json" ]; then
        log_error "package.json not found in client directory"
        exit 1
    fi
    
    # Build the image
    docker build --platform linux/amd64 -t "${PROJECT_NAME}-client:latest" .
    
    if [ $? -eq 0 ]; then
        log_success "Client image built successfully"
    else
        log_error "Failed to build client image"
        exit 1
    fi
    
    cd ..
}

# Function to build server image
build_server() {
    log_info "Building server (Node.js API) image..."
    
    cd server
    
    # Check if package.json exists
    if [ ! -f "package.json" ]; then
        log_error "package.json not found in server directory"
        exit 1
    fi
    
    # Build the image
    docker build --platform linux/amd64 -t "${PROJECT_NAME}-server:latest" .
    
    if [ $? -eq 0 ]; then
        log_success "Server image built successfully"
    else
        log_error "Failed to build server image"
        exit 1
    fi
    
    cd ..
}

# Function to build nginx image
build_nginx() {
    log_info "Building nginx (reverse proxy) image..."
    
    cd nginx
    
    # Check if Dockerfile exists
    if [ ! -f "Dockerfile" ]; then
        log_error "Dockerfile not found in nginx directory"
        exit 1
    fi
    
    # Build the image
    docker build --platform linux/amd64 -t "${PROJECT_NAME}-nginx:latest" .
    
    if [ $? -eq 0 ]; then
        log_success "Nginx image built successfully"
    else
        log_error "Failed to build nginx image"
        exit 1
    fi
    
    cd ..
}

# Function to list built images
list_images() {
    log_info "Built images:"
    docker images | grep "${PROJECT_NAME}"
}

# Main function
main() {
    log_info "🍌 Building Docker images for Banana Pajama Zombie Shooter"
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --help)
                echo "Usage: $0"
                echo "Builds all Docker images for the Banana Pajama game"
                echo ""
                echo "This script will build:"
                echo "  - Client image (Phaser.js game with Nginx)"
                echo "  - Server image (Node.js API)"
                echo "  - Nginx image (Reverse proxy)"
                exit 0
                ;;
            *)
                log_error "Unknown parameter: $1"
                exit 1
                ;;
        esac
    done
    
    # Check prerequisites
    check_prerequisites
    
    # Build all images
    build_client
    build_server
    build_nginx
    
    # List built images
    list_images
    
    log_success "🎉 All Docker images built successfully!"
    log_info "Next step: Run ./scripts/push-images.sh to push to AWS ECR"
}

# Run main function
main "$@"