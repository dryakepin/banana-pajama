import { TILE_SIZE } from './TileMap.js';

// Simple A* pathfinding implementation
export default class Pathfinder {
    constructor(tileMap) {
        this.tileMap = tileMap;
        this.maxDistance = 500; // Maximum pathfinding distance
        this.gridSize = TILE_SIZE / 2; // Use smaller grid for smoother paths
    }
    
    // Convert world coordinates to pathfinding grid
    worldToGrid(worldX, worldY) {
        return {
            x: Math.floor(worldX / this.gridSize),
            y: Math.floor(worldY / this.gridSize)
        };
    }
    
    // Convert pathfinding grid to world coordinates
    gridToWorld(gridX, gridY) {
        return {
            x: gridX * this.gridSize + this.gridSize / 2,
            y: gridY * this.gridSize + this.gridSize / 2
        };
    }
    
    // Calculate heuristic distance (Manhattan distance)
    heuristic(a, b) {
        return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    }
    
    // Get neighbors of a grid position
    getNeighbors(pos) {
        const neighbors = [];
        const directions = [
            { x: -1, y: 0 },  // Left
            { x: 1, y: 0 },   // Right
            { x: 0, y: -1 },  // Up
            { x: 0, y: 1 },   // Down
            { x: -1, y: -1 }, // Up-Left
            { x: 1, y: -1 },  // Up-Right
            { x: -1, y: 1 },  // Down-Left
            { x: 1, y: 1 }    // Down-Right
        ];
        
        for (const dir of directions) {
            const neighbor = {
                x: pos.x + dir.x,
                y: pos.y + dir.y
            };
            
            const worldPos = this.gridToWorld(neighbor.x, neighbor.y);
            if (this.tileMap.isWalkable(worldPos.x, worldPos.y)) {
                neighbors.push(neighbor);
            }
        }
        
        return neighbors;
    }
    
    // Find path from start to goal using A*
    findPath(startX, startY, goalX, goalY) {
        const start = this.worldToGrid(startX, startY);
        const goal = this.worldToGrid(goalX, goalY);
        
        // If goal is too far, don't pathfind
        const distance = Math.sqrt(
            Math.pow(goalX - startX, 2) + Math.pow(goalY - startY, 2)
        );
        if (distance > this.maxDistance) {
            return this.getDirectionalMove(startX, startY, goalX, goalY);
        }
        
        // If goal is not walkable, find nearest walkable position
        if (!this.tileMap.isWalkable(goalX, goalY)) {
            const nearestWalkable = this.tileMap.getNearestWalkablePosition(goalX, goalY);
            const newGoal = this.worldToGrid(nearestWalkable.x, nearestWalkable.y);
            goal.x = newGoal.x;
            goal.y = newGoal.y;
        }
        
        const openSet = [start];
        const closedSet = new Set();
        const cameFrom = new Map();
        const gScore = new Map();
        const fScore = new Map();
        
        const getKey = (pos) => `${pos.x},${pos.y}`;
        
        gScore.set(getKey(start), 0);
        fScore.set(getKey(start), this.heuristic(start, goal));
        
        let iterations = 0;
        const maxIterations = 100; // Prevent infinite loops
        
        while (openSet.length > 0 && iterations < maxIterations) {
            iterations++;
            
            // Find node in openSet with lowest fScore
            let current = openSet[0];
            let currentIndex = 0;
            
            for (let i = 1; i < openSet.length; i++) {
                const currentKey = getKey(openSet[i]);
                const bestKey = getKey(current);
                if ((fScore.get(currentKey) || Infinity) < (fScore.get(bestKey) || Infinity)) {
                    current = openSet[i];
                    currentIndex = i;
                }
            }
            
            openSet.splice(currentIndex, 1);
            closedSet.add(getKey(current));
            
            // Goal reached
            if (current.x === goal.x && current.y === goal.y) {
                return this.reconstructPath(cameFrom, current);
            }
            
            const neighbors = this.getNeighbors(current);
            
            for (const neighbor of neighbors) {
                const neighborKey = getKey(neighbor);
                
                if (closedSet.has(neighborKey)) {
                    continue;
                }
                
                const tentativeGScore = (gScore.get(getKey(current)) || Infinity) + 1;
                
                if (!openSet.find(pos => pos.x === neighbor.x && pos.y === neighbor.y)) {
                    openSet.push(neighbor);
                }
                
                if (tentativeGScore >= (gScore.get(neighborKey) || Infinity)) {
                    continue;
                }
                
                cameFrom.set(neighborKey, current);
                gScore.set(neighborKey, tentativeGScore);
                fScore.set(neighborKey, tentativeGScore + this.heuristic(neighbor, goal));
            }
        }
        
        // No path found, return directional move
        return this.getDirectionalMove(startX, startY, goalX, goalY);
    }
    
    // Reconstruct path from A* result
    reconstructPath(cameFrom, current) {
        const path = [current];
        const getKey = (pos) => `${pos.x},${pos.y}`;
        
        while (cameFrom.has(getKey(current))) {
            current = cameFrom.get(getKey(current));
            path.unshift(current);
        }
        
        // Convert to world coordinates and return first move
        if (path.length > 1) {
            const nextStep = this.gridToWorld(path[1].x, path[1].y);
            return nextStep;
        }
        
        return null;
    }
    
    // Simple directional move when pathfinding fails
    getDirectionalMove(startX, startY, goalX, goalY) {
        const angle = Math.atan2(goalY - startY, goalX - startX);
        const stepSize = this.gridSize;
        
        // Try to move directly toward goal
        let targetX = startX + Math.cos(angle) * stepSize;
        let targetY = startY + Math.sin(angle) * stepSize;
        
        if (this.tileMap.isWalkable(targetX, targetY)) {
            return { x: targetX, y: targetY };
        }
        
        // Try alternative directions if direct path is blocked
        const alternatives = [
            angle + Math.PI / 4,
            angle - Math.PI / 4,
            angle + Math.PI / 2,
            angle - Math.PI / 2
        ];
        
        for (const altAngle of alternatives) {
            targetX = startX + Math.cos(altAngle) * stepSize;
            targetY = startY + Math.sin(altAngle) * stepSize;
            
            if (this.tileMap.isWalkable(targetX, targetY)) {
                return { x: targetX, y: targetY };
            }
        }
        
        // If all else fails, stay put
        return { x: startX, y: startY };
    }
    
    // Get next move toward target (simplified interface)
    getNextMove(startX, startY, goalX, goalY) {
        const nextPos = this.findPath(startX, startY, goalX, goalY);
        
        if (!nextPos) {
            return { x: 0, y: 0 }; // No movement
        }
        
        // Return velocity vector
        return {
            x: nextPos.x - startX,
            y: nextPos.y - startY
        };
    }
}