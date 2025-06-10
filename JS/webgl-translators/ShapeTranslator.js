/**
 * WebGL Shape Translator for Flash-JS Repository - v2.0
 * FIXED: Complete overhaul of ear-clipping tessellation algorithm
 * FIXED: Proper polygon validation and winding order detection
 * FIXED: Improved curve subdivision and path building
 * FIXED: Better error handling and fallback rendering
 * Integrates with Parse.js webpage terminal output for debugging
 * Clean separation between shape parsing and WebGL geometry translation
 */

class ShapeTranslator {
    constructor() {
        this.translationStats = {
            totalTranslations: 0,
            method: 'improved_ear_clipping_tessellation',
            successfulTranslations: 0,
            failedTranslations: 0
        };
        
        // Current translation state
        this.currentPosition = { x: 0, y: 0 };
        this.currentFillStyle0 = 0;
        this.currentFillStyle1 = 0;
        this.currentLineStyle = 0;
        
        this.logToTerminal('ShapeTranslator initialized for Flash-JS repository');
    }

    translateShape(shapeData) {
        this.logToTerminal(`=== TRANSLATING SHAPE ${shapeData.shapeId || 'UNKNOWN'} ===`);
        this.translationStats.totalTranslations++;
        
        try {
            this.resetTranslationState();
            
            // Extract shape components with better validation
            const bounds = this.extractBounds(shapeData);
            const fillStyles = this.extractFillStyles(shapeData);
            const lineStyles = this.extractLineStyles(shapeData);
            const shapeRecords = this.extractShapeRecords(shapeData);
            
            this.logToTerminal(`Shape ${shapeData.shapeId}: ${shapeRecords.length} records, ${fillStyles.length} fills`);
            
            if (shapeRecords.length === 0) {
                this.logToTerminal(`Shape ${shapeData.shapeId}: No shape records found, creating fallback geometry`);
                return this.createFallbackGeometry(shapeData);
            }
            
            // Build path segments with improved algorithm
            const pathSegments = this.buildPathSegments(shapeRecords);
            this.logToTerminal(`Built ${pathSegments.length} path segments`);
            
            if (pathSegments.length === 0) {
                this.logToTerminal(`Shape ${shapeData.shapeId}: No valid paths, creating bounds-based geometry`);
                return this.createBoundsBasedGeometry(bounds, fillStyles);
            }
            
            // Tessellate with improved ear-clipping algorithm
            const triangles = this.tessellateShapeToTriangles(pathSegments, fillStyles, bounds);
            
            // Create final WebGL geometry
            const geometry = this.createWebGLGeometry(triangles, shapeData.shapeId);
            
            this.translationStats.successfulTranslations++;
            this.logToTerminal(`Shape ${shapeData.shapeId} translated: ${geometry.vertexCount} vertices, ${geometry.triangleCount} triangles`);
            
            return geometry;
            
        } catch (error) {
            this.translationStats.failedTranslations++;
            this.logToTerminal(`Shape translation failed: ${error.message}`);
            return this.createFallbackGeometry(shapeData);
        }
    }

    resetTranslationState() {
        this.currentPosition = { x: 0, y: 0 };
        this.currentFillStyle0 = 0;
        this.currentFillStyle1 = 0;
        this.currentLineStyle = 0;
    }

    extractBounds(shapeData) {
        if (shapeData.bounds) {
            return {
                xMin: shapeData.bounds.xMin || 0,
                xMax: shapeData.bounds.xMax || 100,
                yMin: shapeData.bounds.yMin || 0,
                yMax: shapeData.bounds.yMax || 100
            };
        }
        return { xMin: 0, xMax: 100, yMin: 0, yMax: 100 };
    }

    extractFillStyles(shapeData) {
        if (shapeData.fillStyles && shapeData.fillStyles.styles) {
            return shapeData.fillStyles.styles.map((style, index) => ({
                index: index + 1,
                type: style.type || 'solid',
                color: style.color || { red: 255, green: 0, blue: 0, alpha: 255 }
            }));
        }
        return [{ index: 1, type: 'solid', color: { red: 255, green: 0, blue: 0, alpha: 255 } }];
    }

    extractLineStyles(shapeData) {
        if (shapeData.lineStyles && shapeData.lineStyles.styles) {
            return shapeData.lineStyles.styles.map((style, index) => ({
                index: index + 1,
                width: style.width || 20,
                color: style.color || { red: 0, green: 0, blue: 0, alpha: 255 }
            }));
        }
        return [];
    }

    extractShapeRecords(shapeData) {
        if (shapeData.shapeRecords && shapeData.shapeRecords.records) {
            return shapeData.shapeRecords.records.filter(record => 
                record && record.type && record.type !== 'parse_error'
            );
        }
        return [];
    }

    buildPathSegments(shapeRecords) {
        this.logToTerminal(`Building paths from ${shapeRecords.length} shape records`);
        
        const pathSegments = [];
        let currentPath = this.createDefaultPath();
        
        for (const record of shapeRecords) {
            try {
                switch (record.type) {
                    case 'style_change':
                        currentPath = this.processStyleChangeRecord(record, pathSegments, currentPath);
                        break;
                        
                    case 'straight_edge':
                        this.processStraightEdge(record, currentPath);
                        break;
                        
                    case 'curved_edge':
                        this.processCurvedEdge(record, currentPath);
                        break;
                        
                    case 'end':
                        // Finalize current path
                        this.finalizeCurrentPath(currentPath);
                        if (currentPath.vertices.length >= 3) {
                            pathSegments.push(currentPath);
                        }
                        break;
                }
            } catch (error) {
                this.logToTerminal(`Error processing record ${record.type}: ${error.message}`);
            }
        }
        
        // Finalize the last path if it has content
        this.finalizeCurrentPath(currentPath);
        if (currentPath.vertices.length >= 3) {
            pathSegments.push(currentPath);
        }
        
        return pathSegments.filter(path => path.vertices.length >= 3);
    }

    processStyleChangeRecord(record, pathSegments, currentPath) {
        // Finalize current path before style change
        this.finalizeCurrentPath(currentPath);
        if (currentPath.vertices.length >= 3) {
            pathSegments.push(currentPath);
        }
        
        // Update styles
        if (record.fillStyle0 !== undefined) {
            this.currentFillStyle0 = record.fillStyle0;
        }
        if (record.fillStyle1 !== undefined) {
            this.currentFillStyle1 = record.fillStyle1;
        }
        if (record.lineStyle !== undefined) {
            this.currentLineStyle = record.lineStyle;
        }
        
        // Move position
        if (record.moveToX !== undefined && record.moveToY !== undefined) {
            this.currentPosition.x = record.moveToX;
            this.currentPosition.y = record.moveToY;
        }
        
        // Create new path with updated styles
        return this.createNewPath(record);
    }

    createNewPath(record) {
        return {
            vertices: [{ x: this.currentPosition.x, y: this.currentPosition.y }],
            fillStyle0: this.currentFillStyle0,
            fillStyle1: this.currentFillStyle1,
            lineStyle: this.currentLineStyle,
            closed: false,
            area: 0
        };
    }

    processStraightEdge(record, currentPath) {
        const deltaX = record.deltaX || 0;
        const deltaY = record.deltaY || 0;
        
        this.currentPosition.x += deltaX;
        this.currentPosition.y += deltaY;
        
        currentPath.vertices.push({
            x: this.currentPosition.x,
            y: this.currentPosition.y
        });
    }

    processCurvedEdge(record, currentPath) {
        const controlDeltaX = record.controlDeltaX || 0;
        const controlDeltaY = record.controlDeltaY || 0;
        const anchorDeltaX = record.anchorDeltaX || 0;
        const anchorDeltaY = record.anchorDeltaY || 0;
        
        const startX = this.currentPosition.x;
        const startY = this.currentPosition.y;
        
        const controlX = startX + controlDeltaX;
        const controlY = startY + controlDeltaY;
        
        this.currentPosition.x = controlX + anchorDeltaX;
        this.currentPosition.y = controlY + anchorDeltaY;
        
        // Subdivide the curve into line segments for better tessellation
        const curveSegments = this.subdivideBezierCurve(
            startX, startY,
            controlX, controlY,
            this.currentPosition.x, this.currentPosition.y,
            8 // More subdivision steps for smoother curves
        );
        
        // Add all curve points except the first (already in path)
        for (let i = 1; i < curveSegments.length; i++) {
            currentPath.vertices.push(curveSegments[i]);
        }
    }

    createDefaultPath() {
        return {
            vertices: [{ x: this.currentPosition.x, y: this.currentPosition.y }],
            fillStyle0: this.currentFillStyle0,
            fillStyle1: this.currentFillStyle1,
            lineStyle: this.currentLineStyle,
            closed: false,
            area: 0
        };
    }

    finalizeCurrentPath(currentPath) {
        if (currentPath.vertices.length < 3) {
            return;
        }
        
        // Remove duplicate points
        currentPath.vertices = this.removeDuplicatePoints(currentPath.vertices);
        
        // Check if path should be closed (first and last points are close)
        const first = currentPath.vertices[0];
        const last = currentPath.vertices[currentPath.vertices.length - 1];
        const distance = Math.sqrt(
            Math.pow(last.x - first.x, 2) + Math.pow(last.y - first.y, 2)
        );
        
        if (distance < 1.0 && currentPath.vertices.length > 3) {
            currentPath.closed = true;
            // Remove the last point since it's essentially the same as the first
            currentPath.vertices.pop();
        }
        
        // Calculate polygon area for winding order
        currentPath.area = this.calculatePolygonArea(currentPath.vertices);
    }

    subdivideBezierCurve(x0, y0, x1, y1, x2, y2, steps) {
        const points = [];
        
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const oneMinusT = 1 - t;
            
            const x = oneMinusT * oneMinusT * x0 + 
                     2 * oneMinusT * t * x1 + 
                     t * t * x2;
            const y = oneMinusT * oneMinusT * y0 + 
                     2 * oneMinusT * t * y1 + 
                     t * t * y2;
            
            points.push({ x, y });
        }
        
        return points;
    }

    tessellateShapeToTriangles(pathSegments, fillStyles, bounds) {
        this.logToTerminal(`Improved ear-clipping tessellation of ${pathSegments.length} paths`);
        
        const allTriangles = [];
        
        for (const path of pathSegments) {
            if (path.vertices.length < 3) {
                continue;
            }
            
            // Determine fill color
            const fillStyleIndex = path.fillStyle1 || path.fillStyle0 || 1;
            const fillColor = this.getFillColorFromStyles(fillStyleIndex, fillStyles);
            
            // Improved ear clipping with better polygon validation
            const triangles = this.improvedEarClipPolygon(path.vertices, fillColor);
            allTriangles.push(...triangles);
        }
        
        // If no triangles were generated, create a fallback based on bounds
        if (allTriangles.length === 0) {
            this.logToTerminal(`No triangles generated, creating bounds-based fallback`);
            const fallbackColor = this.getFallbackColor(fillStyles);
            allTriangles.push(...this.createBoundsTriangles(bounds, fallbackColor));
        }
        
        this.logToTerminal(`Improved ear-clipping generated ${allTriangles.length} triangles`);
        return allTriangles;
    }

    improvedEarClipPolygon(vertices, fillColor) {
        if (vertices.length < 3) {
            return [];
        }
        
        // Create a working copy and validate
        let workingVertices = this.removeDuplicatePoints([...vertices]);
        
        if (workingVertices.length < 3) {
            this.logToTerminal(`Insufficient vertices after duplicate removal: ${workingVertices.length}`);
            return [];
        }
        
        // Ensure counter-clockwise winding for proper triangulation
        if (!this.isCounterClockwise(workingVertices)) {
            workingVertices.reverse();
        }
        
        const triangles = [];
        const maxIterations = workingVertices.length * 2; // Prevent infinite loops
        let iterations = 0;
        
        // Ear clipping algorithm with improved ear detection
        while (workingVertices.length > 3 && iterations < maxIterations) {
            let earFound = false;
            
            for (let i = 0; i < workingVertices.length; i++) {
                const prevIndex = (i - 1 + workingVertices.length) % workingVertices.length;
                const currIndex = i;
                const nextIndex = (i + 1) % workingVertices.length;
                
                if (this.isValidEarImproved(workingVertices, prevIndex, currIndex, nextIndex)) {
                    // Found an ear, create triangle
                    const triangle = [
                        { ...workingVertices[prevIndex], color: fillColor },
                        { ...workingVertices[currIndex], color: fillColor },
                        { ...workingVertices[nextIndex], color: fillColor }
                    ];
                    
                    triangles.push(triangle);
                    
                    // Remove the ear vertex
                    workingVertices.splice(currIndex, 1);
                    earFound = true;
                    break;
                }
            }
            
            if (!earFound) {
                this.logToTerminal(`Improved ear-clipping failed to find ear, breaking with ${workingVertices.length} vertices remaining`);
                break;
            }
            
            iterations++;
        }
        
        // Add the final triangle if we have exactly 3 vertices left
        if (workingVertices.length === 3) {
            const finalTriangle = [
                { ...workingVertices[0], color: fillColor },
                { ...workingVertices[1], color: fillColor },
                { ...workingVertices[2], color: fillColor }
            ];
            triangles.push(finalTriangle);
        }
        
        return triangles;
    }

    removeDuplicatePoints(vertices) {
        const cleaned = [];
        const threshold = 0.1; // Minimum distance between points
        
        for (let i = 0; i < vertices.length; i++) {
            const current = vertices[i];
            let isDuplicate = false;
            
            for (const existing of cleaned) {
                const distance = Math.sqrt(
                    Math.pow(current.x - existing.x, 2) + 
                    Math.pow(current.y - existing.y, 2)
                );
                
                if (distance < threshold) {
                    isDuplicate = true;
                    break;
                }
            }
            
            if (!isDuplicate) {
                cleaned.push(current);
            }
        }
        
        return cleaned;
    }

    isCounterClockwise(vertices) {
        const area = this.calculatePolygonArea(vertices);
        return area > 0;
    }

    calculatePolygonArea(vertices) {
        let area = 0;
        const n = vertices.length;
        
        for (let i = 0; i < n; i++) {
            const j = (i + 1) % n;
            area += vertices[i].x * vertices[j].y;
            area -= vertices[j].x * vertices[i].y;
        }
        
        return area / 2;
    }

    isValidEarImproved(vertices, prevIndex, currIndex, nextIndex) {
        const prev = vertices[prevIndex];
        const curr = vertices[currIndex];
        const next = vertices[nextIndex];
        
        // Check if the angle at curr is convex
        if (!this.isConvexAngle(prev, curr, next)) {
            return false;
        }
        
        // Check if any other vertex is inside the triangle
        for (let i = 0; i < vertices.length; i++) {
            if (i === prevIndex || i === currIndex || i === nextIndex) {
                continue;
            }
            
            if (this.pointInsideTriangleImproved(vertices[i], prev, curr, next)) {
                return false;
            }
        }
        
        return true;
    }

    isConvexAngle(a, b, c) {
        const cross = (c.x - a.x) * (b.y - a.y) - (c.y - a.y) * (b.x - a.x);
        return cross > 0;
    }

    pointInsideTriangleImproved(p, a, b, c) {
        // Use barycentric coordinates for more accurate point-in-triangle test
        const denom = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);
        
        if (Math.abs(denom) < 1e-10) {
            return false; // Degenerate triangle
        }
        
        const alpha = ((b.y - c.y) * (p.x - c.x) + (c.x - b.x) * (p.y - c.y)) / denom;
        const beta = ((c.y - a.y) * (p.x - c.x) + (a.x - c.x) * (p.y - c.y)) / denom;
        const gamma = 1 - alpha - beta;
        
        const epsilon = 1e-6;
        return alpha >= -epsilon && beta >= -epsilon && gamma >= -epsilon;
    }

    getFillColorFromStyles(fillStyleIndex, fillStyles) {
        if (fillStyleIndex > 0 && fillStyleIndex <= fillStyles.length) {
            const style = fillStyles[fillStyleIndex - 1];
            if (style.color) {
                return [
                    (style.color.red || 255) / 255,
                    (style.color.green || 0) / 255,
                    (style.color.blue || 0) / 255,
                    (style.color.alpha || 255) / 255
                ];
            }
        }
        
        return [1.0, 0.0, 0.0, 1.0]; // Default red
    }

    getFallbackColor(fillStyles) {
        if (fillStyles.length > 0 && fillStyles[0].color) {
            const color = fillStyles[0].color;
            return [
                (color.red || 255) / 255,
                (color.green || 0) / 255,
                (color.blue || 0) / 255,
                (color.alpha || 255) / 255
            ];
        }
        return [0.5, 0.5, 0.5, 1.0]; // Default gray
    }

    createBoundsTriangles(bounds, fillColor) {
        // Create two triangles forming a rectangle
        const x1 = bounds.xMin / 20; // Convert from twips
        const y1 = bounds.yMin / 20;
        const x2 = bounds.xMax / 20;
        const y2 = bounds.yMax / 20;
        
        return [
            [
                { x: x1, y: y1, color: fillColor },
                { x: x2, y: y1, color: fillColor },
                { x: x1, y: y2, color: fillColor }
            ],
            [
                { x: x2, y: y1, color: fillColor },
                { x: x2, y: y2, color: fillColor },
                { x: x1, y: y2, color: fillColor }
            ]
        ];
    }

    createBoundsBasedGeometry(bounds, fillStyles) {
        const fallbackColor = this.getFallbackColor(fillStyles);
        const triangles = this.createBoundsTriangles(bounds, fallbackColor);
        return this.createWebGLGeometry(triangles, 'bounds_fallback');
    }

    createWebGLGeometry(triangles, shapeId) {
        const vertices = [];
        const colors = [];
        
        for (const triangle of triangles) {
            for (const vertex of triangle) {
                vertices.push(vertex.x, vertex.y);
                colors.push(
                    vertex.color[0],
                    vertex.color[1], 
                    vertex.color[2],
                    vertex.color[3]
                );
            }
        }
        
        return {
            vertices: new Float32Array(vertices),
            colors: new Float32Array(colors),
            vertexCount: vertices.length / 2,
            triangleCount: triangles.length,
            method: this.translationStats.method,
            shapeId: shapeId
        };
    }

    createFallbackGeometry(shapeData) {
        this.logToTerminal(`Creating fallback geometry for shape ${shapeData.shapeId}`);
        
        // Create a simple colored square as fallback
        const size = 20;
        const vertices = new Float32Array([
            0, 0,
            size, 0,
            0, size,
            size, 0,
            size, size,
            0, size
        ]);
        
        const colors = new Float32Array([
            1.0, 0.0, 0.0, 1.0,  // Red
            1.0, 0.0, 0.0, 1.0,
            1.0, 0.0, 0.0, 1.0,
            1.0, 0.0, 0.0, 1.0,
            1.0, 0.0, 0.0, 1.0,
            1.0, 0.0, 0.0, 1.0
        ]);
        
        return {
            vertices: vertices,
            colors: colors,
            vertexCount: 6,
            triangleCount: 2,
            method: 'fallback',
            shapeId: shapeData.shapeId || 'unknown'
        };
    }

    logToTerminal(message) {
        const timestamp = new Date().toISOString().substring(11, 19);
        const logMessage = `[${timestamp}] [ShapeTranslator] ${message}`;
        
        console.log(logMessage);
        
        // Use Flash-JS Parse.js webpage terminal output system
        const terminal = document.getElementById('terminalOutput');
        if (terminal) {
            terminal.textContent += '\n' + logMessage;
            terminal.scrollTop = terminal.scrollHeight;
        }
    }

    getTranslationStats() {
        return {
            ...this.translationStats,
            successRate: this.translationStats.totalTranslations > 0 ? 
                (this.translationStats.successfulTranslations / this.translationStats.totalTranslations) * 100 : 0
        };
    }
}

// Export for use with Flash-JS repository
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ShapeTranslator;
}

// Global access for Flash-JS repository integration
if (typeof window !== 'undefined') {
    window.ShapeTranslator = ShapeTranslator;
}
