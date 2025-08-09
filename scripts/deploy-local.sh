#!/bin/bash

# Banana Pajama Zombie Shooter - Local Development Deployment Script
# This script sets up the complete development environment using Docker

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions for colored output
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

# Check if Docker is installed and running
check_docker() {
    log_info "Checking Docker installation..."
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install Docker Desktop."
        echo "Download from: https://www.docker.com/products/docker-desktop"
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        log_error "Docker is not running. Please start Docker Desktop."
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed. Please install Docker Compose."
        exit 1
    fi
    
    log_success "Docker is installed and running"
}

# Check if we're in the right directory
check_directory() {
    if [[ ! -f "docker/docker-compose.yml" ]]; then
        log_error "Please run this script from the project root directory (where README.md is located)"
        exit 1
    fi
    log_success "Correct directory confirmed"
}

# Create .env file if it doesn't exist
setup_env_file() {
    if [[ ! -f "docker/.env" ]]; then
        log_info "Creating .env file from template..."
        cp docker/.env.example docker/.env
        log_success "Created docker/.env file"
        log_warning "Please review and update the environment variables in docker/.env if needed"
    else
        log_info ".env file already exists"
    fi
}

# Clean up any existing containers
cleanup_containers() {
    log_info "Cleaning up any existing containers..."
    cd docker
    docker-compose down --remove-orphans 2>/dev/null || true
    docker-compose rm -f 2>/dev/null || true
    cd ..
    log_success "Cleanup completed"
}

# Build and start services
start_services() {
    log_info "Building and starting services..."
    cd docker
    
    # Build images
    log_info "Building Docker images..."
    docker-compose build --no-cache
    
    # Start services
    log_info "Starting services..."
    docker-compose up -d
    
    cd ..
    log_success "Services are starting up..."
}

# Wait for services to be healthy
wait_for_services() {
    log_info "Waiting for services to be healthy..."
    
    local max_attempts=30
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        attempt=$((attempt + 1))
        
        # Check database
        if docker-compose -f docker/docker-compose.yml exec -T database pg_isready -U postgres -d banana_pajama >/dev/null 2>&1; then
            log_success "Database is ready"
            break
        fi
        
        if [ $attempt -eq $max_attempts ]; then
            log_error "Database failed to start within expected time"
            show_logs
            exit 1
        fi
        
        log_info "Waiting for database... (attempt $attempt/$max_attempts)"
        sleep 2
    done
    
    # Wait a bit more for all services
    log_info "Waiting for all services to stabilize..."
    sleep 10
}

# Show service status and logs
show_status() {
    log_info "Service Status:"
    cd docker
    docker-compose ps
    cd ..
    
    echo ""
    log_info "Service URLs:"
    echo "🎮 Game Client: http://localhost:8080"
    echo "🔧 API Server: http://localhost:3000"
    echo "📊 Database Admin: http://localhost:8081"
    echo "   - Server: database"
    echo "   - Username: postgres"
    echo "   - Password: banana_dev_password"
    echo ""
}

# Show logs function
show_logs() {
    log_info "Recent logs:"
    cd docker
    docker-compose logs --tail=50
    cd ..
}

# Test the deployment
test_deployment() {
    log_info "Testing deployment..."
    
    # Test API health
    if curl -f http://localhost:3000/api/health >/dev/null 2>&1; then
        log_success "API server is responding"
    else
        log_warning "API server is not responding yet"
    fi
    
    # Test client
    if curl -f http://localhost:8080/health >/dev/null 2>&1; then
        log_success "Client is responding"
    else
        log_warning "Client is not responding yet"
    fi
}

# Main deployment function
main() {
    echo "🍌 Banana Pajama Zombie Shooter - Local Development Setup"
    echo "========================================================"
    echo ""
    
    check_docker
    check_directory
    setup_env_file
    cleanup_containers
    start_services
    wait_for_services
    show_status
    test_deployment
    
    echo ""
    log_success "🎉 Local development environment is ready!"
    echo ""
    echo "Quick commands:"
    echo "  View logs: docker-compose -f docker/docker-compose.yml logs -f"
    echo "  Stop services: docker-compose -f docker/docker-compose.yml down"
    echo "  Restart services: docker-compose -f docker/docker-compose.yml restart"
    echo "  View status: docker-compose -f docker/docker-compose.yml ps"
    echo ""
    echo "If you encounter issues, check the logs with:"
    echo "  ./scripts/deploy-local.sh logs"
}

# Handle command line arguments
case "${1:-}" in
    "logs"|"log")
        cd docker && docker-compose logs -f
        ;;
    "stop")
        log_info "Stopping services..."
        cd docker && docker-compose down
        log_success "Services stopped"
        ;;
    "restart")
        log_info "Restarting services..."
        cd docker && docker-compose restart
        log_success "Services restarted"
        ;;
    "status")
        cd docker && docker-compose ps
        ;;
    "clean")
        log_info "Cleaning up everything (including volumes)..."
        cd docker && docker-compose down -v --remove-orphans
        docker system prune -f
        log_success "Cleanup completed"
        ;;
    *)
        main
        ;;
esac