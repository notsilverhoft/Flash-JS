/**
 * Shape Translator for Flash-JS Repository
 * Converts ShapeParsers.js output to WebGL-ready geometry data
 * Integrates with Parse.js webpage terminal output for debugging
 * Separates shape data translation from WebGL rendering logic
 */

class ShapeTranslator {
    constructor() {
        this.dataTypes = new SWFDataTypes();
        
        // Translation state
        this.currentPenX = 0;
        this.currentPenY = 0;
        this.currentFillStyle0 = 0;
        this.currentFillStyle1 = 0;
        this.currentLineStyle = 0;
        
        // Debug state for Flash-JS repository Parse.js integration
        this.debugMode = true;
        this.translationCount = 0;
        
        this.logToTerminal('ShapeTranslator initialized for Flash-JS repository');
    }

    /**
     * Main translation method - converts ShapeParsers.js data to WebGL geometry
     * @param {Object} shapeData - Parsed shape data from ShapeParsers.js
     * @returns {Object} WebGL-ready geometry data
     */
    translateShape(shapeData) {
        this.translationCount++;
        this.logToTerminal(`=== TRANSLATING SHAPE ${shapeData.shapeId} ===`);
        
        try {
            // Reset pen position and style state for each shape
            this.resetTranslationState();
            
            // Extract core shape components from ShapeParsers.js output
            const bounds = this.extractBounds(shapeData);
            const fillStyles = this.extractFillStyles(shapeData);
            const lineStyles = this.extractLineStyles(shapeData);
            const shapeRecords = this.extractShapeRecords(shapeData);
            
            this.logToTerminal(`Shape ${shapeData.shapeId}: ${shapeRecords.length} records, ${fillStyles.length} fills`);
            
            // Build path segments from Flash-JS ShapeParsers shape records
            const pathSegments = this.buildPathSegments(shapeRecords);
            
            // Tessellate paths into triangles using ear-clipping
            const triangulatedGeometry = this.tessellateShapeToTriangles(pathSegments, fillStyles, bounds);
            
            // Create final WebGL-ready data structure
            const webglGeometry = this.createWebGLGeometry(triangulatedGeometry, shapeData.shapeId);
            
            this.logToTerminal(`Shape ${shapeData.shapeId} translated: ${webglGeometry.vertexCount} vertices, ${webglGeometry.triangleCount} triangles`);
            
            return webglGeometry;
            
        } catch (error) {
            this.logToTerminal(`Error translating shape ${shapeData.shapeId}: ${error.message}`);
            return this.createFallbackGeometry(shapeData);
        }
    }

    /**
     * Reset translation state for new shape
     */
    resetTranslationState() {
        this.currentPenX = 0;
        this.currentPenY = 0;
        this.currentFillStyle0 = 0;
        this.currentFillStyle1 = 0;
        this.currentLineStyle = 0;
    }

    /**
     * Extract bounds from ShapeParsers.js data structure
     */
    extractBounds(shapeData) {
        if (shapeData.bounds) {
            return {
                xMin: shapeData.bounds.xMin || 0,
                yMin: shapeData.bounds.yMin || 0,
                xMax: shapeData.bounds.xMax || 2000,
                yMax: shapeData.bounds.yMax || 1500
            };
        }
        
        // Default bounds for visibility
        return { xMin: 100, yMin: 100, xMax: 2000, yMax: 1500 };
    }

    /**
     * Extract fill styles from ShapeParsers.js data structure
     */
    extractFillStyles(shapeData) {
        if (shapeData.fillStyles && shapeData.fillStyles.styles) {
            return shapeData.fillStyles.styles;
        }
        return [];
    }

    /**
     * Extract line styles from ShapeParsers.js data structure
     */
    extractLineStyles(shapeData) {
        if (shapeData.lineStyles && shapeData.lineStyles.styles) {
            return shapeData.lineStyles.styles;
        }
        return [];
    }

    /**
     * Extract shape records from ShapeParsers.js data structure
     */
    extractShapeRecords(shapeData) {
        if (shapeData.shapeRecords && shapeData.shapeRecords.records) {
            return shapeData.shapeRecords.records;
        }
        return [];
    }

    /**
     * Build path segments from Flash-JS ShapeParsers shape records
     */
    buildPathSegments(shapeRecords) {
        const pathSegments = [];
        let currentPath = null;
        
        this.logToTerminal(`Building paths from ${shapeRecords.length} shape records`);
        
        for (let i = 0; i < shapeRecords.length && i < 500; i++) {
            const record = shapeRecords[i];
            
            if (record.type === 'style_change') {
                this.processStyleChangeRecord(record, pathSegments, currentPath);
                if (record.flags && record.flags.moveTo) {
                    currentPath = this.createNewPath(record);
                }
            } else if (record.type === 'straight_edge') {
                currentPath = this.processStraightEdge(record, currentPath);
            } else if (record.type === 'curved_edge') {
                currentPath = this.processCurvedEdge(record, currentPath);
            } else if (record.type === 'end') {
                break;
            }
        }
        
        // Add final path
        if (currentPath && currentPath.points.length > 2) {
            this.finalizeCurrentPath(currentPath);
            pathSegments.push(currentPath);
        }
        
        this.logToTerminal(`Built ${pathSegments.length} path segments`);
        return pathSegments;
    }

    /**
     * Process style change record from ShapeParsers.js
     */
    processStyleChangeRecord(record, pathSegments, currentPath) {
        if (currentPath && currentPath.points.length > 2) {
            pathSegments.push(currentPath);
        }
        
        // Update current styles from ShapeParsers.js data
        if (record.fillStyle0 !== undefined) this.currentFillStyle0 = record.fillStyle0;
        if (record.fillStyle1 !== undefined) this.currentFillStyle1 = record.fillStyle1;
        if (record.lineStyle !== undefined) this.currentLineStyle = record.lineStyle;
    }

    /**
     * Create new path from move operation
     */
    createNewPath(record) {
        // Convert twips to pixels using ShapeParsers.js data
        this.currentPenX = (record.moveToX || 0) / 20;
        this.currentPenY = (record.moveToY || 0) / 20;
        
        return {
            points: [{ x: this.currentPenX, y: this.currentPenY }],
            fillStyle0: this.currentFillStyle0,
            fillStyle1: this.currentFillStyle1,
            lineStyle: this.currentLineStyle,
            closed: false
        };
    }

    /**
     * Process straight edge from ShapeParsers.js
     */
    processStraightEdge(record, currentPath) {
        if (!currentPath) {
            currentPath = this.createDefaultPath();
        }
        
        const deltaX = (record.deltaX || 0) / 20;
        const deltaY = (record.deltaY || 0) / 20;
        this.currentPenX += deltaX;
        this.currentPenY += deltaY;
        
        currentPath.points.push({ x: this.currentPenX, y: this.currentPenY });
        return currentPath;
    }

    /**
     * Process curved edge from ShapeParsers.js
     */
    processCurvedEdge(record, currentPath) {
        if (!currentPath) {
            currentPath = this.createDefaultPath();
        }
        
        // Convert control and anchor deltas from twips to pixels
        const controlDeltaX = (record.controlDeltaX || 0) / 20;
        const controlDeltaY = (record.controlDeltaY || 0) / 20;
        const anchorDeltaX = (record.anchorDeltaX || 0) / 20;
        const anchorDeltaY = (record.anchorDeltaY || 0) / 20;
        
        const controlX = this.currentPenX + controlDeltaX;
        const controlY = this.currentPenY + controlDeltaY;
        const endX = controlX + anchorDeltaX;
        const endY = controlY + anchorDeltaY;
        
        // Subdivide curve into line segments for triangulation
        const curvePoints = this.subdivideBezierCurve(
            this.currentPenX, this.currentPenY,
            controlX, controlY,
            endX, endY,
            6 // subdivision steps for smooth curves
        );
        
        currentPath.points.push(...curvePoints);
        
        this.currentPenX = endX;
        this.currentPenY = endY;
        
        return currentPath;
    }

    /**
     * Create default path with current state
     */
    createDefaultPath() {
        return {
            points: [{ x: this.currentPenX, y: this.currentPenY }],
            fillStyle0: this.currentFillStyle0,
            fillStyle1: this.currentFillStyle1,
            lineStyle: this.currentLineStyle,
            closed: false
        };
    }

    /**
     * Finalize current path - check if it should be closed
     */
    finalizeCurrentPath(currentPath) {
        const firstPoint = currentPath.points[0];
        const lastPoint = currentPath.points[currentPath.points.length - 1];
        const distance = Math.sqrt(
            Math.pow(lastPoint.x - firstPoint.x, 2) + 
            Math.pow(lastPoint.y - firstPoint.y, 2)
        );
        
        if (distance < 2.0) { // Close threshold in pixels
            currentPath.closed = true;
            currentPath.points.pop(); // Remove duplicate last point
        }
    }

    /**
     * Subdivide Bezier curve to line segments
     */
    subdivideBezierCurve(x0, y0, x1, y1, x2, y2, steps) {
        const points = [];
        
        for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            
            // Quadratic Bezier curve evaluation
            const x = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * x1 + t * t * x2;
            const y = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * y1 + t * t * y2;
            
            points.push({ x, y });
        }
        
        return points;
    }

    /**
     * Tessellate shape paths into triangles using ear-clipping algorithm
     */
    tessellateShapeToTriangles(pathSegments, fillStyles, bounds) {
        const triangles = [];
        
        this.logToTerminal(`Ear-clipping tessellation of ${pathSegments.length} paths`);
        
        for (let pathIndex = 0; pathIndex < pathSegments.length && pathIndex < 50; pathIndex++) {
            const path = pathSegments[pathIndex];
            
            if (path.points.length < 3) {
                continue; // Need at least 3 points for triangulation
            }
            
            // Get fill color from ShapeParsers.js fill styles
            const fillColor = this.getFillColorFromStyles(path.fillStyle0 || path.fillStyle1, fillStyles);
            
            // Use ear-clipping triangulation algorithm
            const pathTriangles = this.earClipPolygon(path.points, fillColor);
            triangles.push(...pathTriangles);
        }
        
        // Create fallback triangles if no geometry generated
        if (triangles.length === 0) {
            const fallbackColor = this.getFallbackColor(fillStyles);
            const fallbackTriangles = this.createBoundsTriangles(bounds, fallbackColor);
            triangles.push(...fallbackTriangles);
        }
        
        this.logToTerminal(`Ear-clipping generated ${triangles.length} triangles`);
        return triangles;
    }

    /**
     * Ear-clipping triangulation algorithm implementation
     */
    earClipPolygon(points, fillColor) {
        if (points.length < 3) return [];
        
        // Make a copy to avoid modifying original
        const vertices = points.slice();
        const triangles = [];
        
        // Remove duplicate consecutive points
        this.removeDuplicatePoints(vertices);
        
        if (vertices.length < 3) return [];
        
        // Ensure counter-clockwise winding for proper triangulation
        if (!this.isCounterClockwise(vertices)) {
            vertices.reverse();
        }
        
        // Main ear clipping loop
        let attempts = 0;
        while (vertices.length > 3 && attempts < vertices.length * 2) {
            attempts++;
            let earFound = false;
            
            for (let i = 0; i < vertices.length; i++) {
                const prevIndex = (i - 1 + vertices.length) % vertices.length;
                const currIndex = i;
                const nextIndex = (i + 1) % vertices.length;
                
                const prev = vertices[prevIndex];
                const curr = vertices[currIndex];
                const next = vertices[nextIndex];
                
                // Check if this vertex forms an ear
                if (this.isValidEar(vertices, prevIndex, currIndex, nextIndex)) {
                    // Create triangle
                    triangles.push({
                        vertices: [
                            prev.x, prev.y,
                            curr.x, curr.y,
                            next.x, next.y
                        ],
                        color: fillColor
                    });
                    
                    // Remove the ear vertex
                    vertices.splice(currIndex, 1);
                    earFound = true;
                    break;
                }
            }
            
            if (!earFound) {
                this.logToTerminal(`Ear-clipping failed to find ear, breaking with ${vertices.length} vertices remaining`);
                break;
            }
        }
        
        // Add the final triangle
        if (vertices.length === 3) {
            triangles.push({
                vertices: [
                    vertices[0].x, vertices[0].y,
                    vertices[1].x, vertices[1].y,
                    vertices[2].x, vertices[2].y
                ],
                color: fillColor
            });
        }
        
        return triangles;
    }

    /**
     * Remove duplicate consecutive points
     */
    removeDuplicatePoints(vertices) {
        for (let i = vertices.length - 1; i >= 1; i--) {
            const curr = vertices[i];
            const prev = vertices[i - 1];
            const distance = Math.sqrt(
                Math.pow(curr.x - prev.x, 2) + 
                Math.pow(curr.y - prev.y, 2)
            );
            if (distance < 0.1) {
                vertices.splice(i, 1);
            }
        }
    }

    /**
     * Check if polygon vertices are in counter-clockwise order
     */
    isCounterClockwise(vertices) {
        let sum = 0;
        for (let i = 0; i < vertices.length; i++) {
            const curr = vertices[i];
            const next = vertices[(i + 1) % vertices.length];
            sum += (next.x - curr.x) * (next.y + curr.y);
        }
        return sum < 0;
    }

    /**
     * Check if vertex forms a valid ear for clipping
     */
    isValidEar(vertices, prevIndex, currIndex, nextIndex) {
        const prev = vertices[prevIndex];
        const curr = vertices[currIndex];
        const next = vertices[nextIndex];
        
        // Check if angle is convex
        if (!this.isConvexAngle(prev, curr, next)) {
            return false;
        }
        
        // Check if any other vertex is inside this triangle
        for (let i = 0; i < vertices.length; i++) {
            if (i === prevIndex || i === currIndex || i === nextIndex) {
                continue;
            }
            
            if (this.pointInsideTriangle(vertices[i], prev, curr, next)) {
                return false;
            }
        }
        
        return true;
    }

    /**
     * Check if angle at vertex is convex
     */
    isConvexAngle(a, b, c) {
        const cross = (c.x - a.x) * (b.y - a.y) - (c.y - a.y) * (b.x - a.x);
        return cross > 0;
    }

    /**
     * Check if point is inside triangle
     */
    pointInsideTriangle(p, a, b, c) {
        const area = Math.abs((b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y));
        const area1 = Math.abs((a.x - p.x) * (b.y - p.y) - (b.x - p.x) * (a.y - p.y));
        const area2 = Math.abs((b.x - p.x) * (c.y - p.y) - (c.x - p.x) * (b.y - p.y));
        const area3 = Math.abs((c.x - p.x) * (a.y - p.y) - (a.x - p.x) * (c.y - p.y));
        
        return Math.abs(area - (area1 + area2 + area3)) < 0.1;
    }

    /**
     * Get fill color from ShapeParsers.js fill styles
     */
    getFillColorFromStyles(fillStyleIndex, fillStyles) {
        if (fillStyleIndex > 0 && fillStyleIndex <= fillStyles.length) {
            const fillStyle = fillStyles[fillStyleIndex - 1]; // 1-based indexing in Flash
            
            if (fillStyle.type === 'solid' && fillStyle.color) {
                return {
                    r: (fillStyle.color.red || 128) / 255,
                    g: (fillStyle.color.green || 128) / 255,
                    b: (fillStyle.color.blue || 255) / 255,
                    a: Math.max(0.3, (fillStyle.color.alpha !== undefined ? fillStyle.color.alpha : 255) / 255)
                };
            }
        }
        
        // Default bright color for visibility
        return { r: 0.8, g: 0.4, b: 0.9, a: 0.8 };
    }

    /**
     * Get fallback color when no fill styles available
     */
    getFallbackColor(fillStyles) {
        if (fillStyles.length > 0) {
            return this.getFillColorFromStyles(1, fillStyles);
        }
        return { r: 0.7, g: 0.3, b: 0.8, a: 0.7 };
    }

    /**
     * Create triangles from bounds for fallback geometry
     */
    createBoundsTriangles(bounds, fillColor) {
        // Convert twips to pixels
        let x1 = (bounds.xMin || 0) / 20;
        let y1 = (bounds.yMin || 0) / 20;
        let x2 = (bounds.xMax || 2000) / 20;
        let y2 = (bounds.yMax || 1500) / 20;
        
        // Ensure minimum size for visibility
        if (x2 - x1 < 10) { x2 = x1 + 40; }
        if (y2 - y1 < 10) { y2 = y1 + 30; }
        
        return [
            {
                vertices: [x1, y1, x2, y1, x1, y2],
                color: fillColor
            },
            {
                vertices: [x2, y1, x2, y2, x1, y2],
                color: fillColor
            }
        ];
    }

    /**
     * Create final WebGL-ready geometry data structure
     */
    createWebGLGeometry(triangles, shapeId) {
        const vertices = [];
        const colors = [];
        
        for (const triangle of triangles) {
            // Add triangle vertices (3 points = 6 coordinates)
            vertices.push(...triangle.vertices);
            
            // Add triangle colors (3 points × 4 components each)
            for (let i = 0; i < 3; i++) {
                colors.push(triangle.color.r, triangle.color.g, triangle.color.b, triangle.color.a);
            }
        }
        
        return {
            shapeId: shapeId,
            vertices: new Float32Array(vertices),
            colors: new Float32Array(colors),
            vertexCount: triangles.length * 3,
            triangleCount: triangles.length,
            primitiveType: 'TRIANGLES', // WebGL primitive type
            method: 'ear_clipping_translation',
            translated: true
        };
    }

    /**
     * Create fallback geometry when translation fails
     */
    createFallbackGeometry(shapeData) {
        this.logToTerminal(`Creating fallback geometry for shape ${shapeData.shapeId}`);
        
        const bounds = this.extractBounds(shapeData);
        const fallbackColor = { r: 0.5, g: 0.5, b: 0.8, a: 0.8 };
        const fallbackTriangles = this.createBoundsTriangles(bounds, fallbackColor);
        
        return this.createWebGLGeometry(fallbackTriangles, shapeData.shapeId);
    }

    /**
     * Debug logging integration with Flash-JS Parse.js terminal output
     */
    logToTerminal(message) {
        const timestamp = new Date().toISOString().substring(11, 19);
        const logMessage = `[${timestamp}] [ShapeTranslator] ${message}`;
        
        console.log(logMessage);
        
        // Integrate with Flash-JS Parse.js terminal output system
        const terminal = document.getElementById('terminalOutput');
        if (terminal) {
            terminal.textContent += '\n' + logMessage;
            terminal.scrollTop = terminal.scrollHeight;
        }
    }

    /**
     * Get translation statistics for debugging
     */
    getTranslationStats() {
        return {
            totalTranslations: this.translationCount,
            translatorActive: true,
            method: 'ear_clipping_tessellation',
            integration: 'flash_js_shape_parsers'
        };
    }
}

// Export for Flash-JS repository integration
if (typeof window !== 'undefined') {
    window.ShapeTranslator = ShapeTranslator;
}
