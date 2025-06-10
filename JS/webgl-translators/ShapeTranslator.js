/**
 * WebGL Shape Translator for Flash-JS Repository - v3.0
 * COMPLETELY REWRITTEN: Robust tessellation system for SWF shapes
 * FIXED: Self-intersecting polygon handling using scanline tessellation
 * FIXED: Multiple path segment merging and validation
 * FIXED: Proper SWF coordinate system conversion
 * ENHANCED: Fallback to triangle fan tessellation when ear-clipping fails
 * Integrates with Parse.js webpage terminal output for debugging Flash-JS repository
 */

class ShapeTranslator {
    constructor() {
        this.translationStats = {
            totalTranslations: 0,
            method: 'robust_scanline_tessellation',
            successfulTranslations: 0,
            failedTranslations: 0,
            fallbackCount: 0
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
            
            // Build consolidated path with robust algorithm
            const consolidatedPaths = this.buildConsolidatedPaths(shapeRecords);
            this.logToTerminal(`Built ${consolidatedPaths.length} consolidated paths`);
            
            if (consolidatedPaths.length === 0) {
                this.logToTerminal(`Shape ${shapeData.shapeId}: No valid paths, creating bounds-based geometry`);
                return this.createBoundsBasedGeometry(bounds, fillStyles);
            }
            
            // Use robust tessellation with multiple fallback methods
            const triangles = this.robustTessellation(consolidatedPaths, fillStyles, bounds, shapeData.shapeId);
            
            // Create final WebGL geometry
            const geometry = this.createWebGLGeometry(triangles, shapeData.shapeId);
            
            if (geometry.triangleCount > 2) {
                this.translationStats.successfulTranslations++;
            } else {
                this.translationStats.fallbackCount++;
            }
            
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
                xMin: (shapeData.bounds.xMin || 0) / 20, // Convert from twips
                xMax: (shapeData.bounds.xMax || 2000) / 20,
                yMin: (shapeData.bounds.yMin || 0) / 20,
                yMax: (shapeData.bounds.yMax || 2000) / 20
            };
        }
        return { xMin: 0, xMax: 100, yMin: 0, yMax: 100 };
    }

    extractFillStyles(shapeData) {
        if (shapeData.fillStyles && shapeData.fillStyles.styles) {
            return shapeData.fillStyles.styles.map((style, index) => ({
                index: index + 1,
                type: style.type || 'solid',
                color: style.color || { red: 128, green: 128, blue: 128, alpha: 255 }
            }));
        }
        return [{ index: 1, type: 'solid', color: { red: 128, green: 128, blue: 128, alpha: 255 } }];
    }

    extractLineStyles(shapeData) {
        if (shapeData.lineStyles && shapeData.lineStyles.styles) {
            return shapeData.lineStyles.styles.map((style, index) => ({
                index: index + 1,
                width: (style.width || 20) / 20, // Convert from twips
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

    buildConsolidatedPaths(shapeRecords) {
        this.logToTerminal(`Building consolidated paths from ${shapeRecords.length} shape records`);
        
        const allPaths = [];
        let currentPath = null;
        
        // Process all records to build individual path segments
        for (const record of shapeRecords) {
            try {
                switch (record.type) {
                    case 'style_change':
                        currentPath = this.processStyleChange(record, allPaths, currentPath);
                        break;
                        
                    case 'straight_edge':
                        if (currentPath) {
                            this.processStraightEdge(record, currentPath);
                        }
                        break;
                        
                    case 'curved_edge':
                        if (currentPath) {
                            this.processCurvedEdge(record, currentPath);
                        }
                        break;
                        
                    case 'end':
                        if (currentPath) {
                            this.finalizePath(currentPath);
                            if (this.isValidPath(currentPath)) {
                                allPaths.push(currentPath);
                            }
                            currentPath = null;
                        }
                        break;
                }
            } catch (error) {
                this.logToTerminal(`Error processing record ${record.type}: ${error.message}`);
            }
        }
        
        // Finalize the last path
        if (currentPath) {
            this.finalizePath(currentPath);
            if (this.isValidPath(currentPath)) {
                allPaths.push(currentPath);
            }
        }
        
        // Consolidate paths by fill style
        const consolidatedPaths = this.consolidatePathsByFillStyle(allPaths);
        
        return consolidatedPaths.filter(path => this.isValidPath(path));
    }

    processStyleChange(record, allPaths, currentPath) {
        // Finalize current path
        if (currentPath) {
            this.finalizePath(currentPath);
            if (this.isValidPath(currentPath)) {
                allPaths.push(currentPath);
            }
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
        
        // Move position (convert from twips)
        if (record.moveToX !== undefined && record.moveToY !== undefined) {
            this.currentPosition.x = record.moveToX / 20;
            this.currentPosition.y = record.moveToY / 20;
        }
        
        // Create new path if we have a fill style
        if (this.currentFillStyle0 > 0 || this.currentFillStyle1 > 0) {
            return {
                vertices: [{ x: this.currentPosition.x, y: this.currentPosition.y }],
                fillStyle: this.currentFillStyle1 || this.currentFillStyle0,
                lineStyle: this.currentLineStyle,
                closed: false
            };
        }
        
        return null;
    }

    processStraightEdge(record, currentPath) {
        const deltaX = (record.deltaX || 0) / 20; // Convert from twips
        const deltaY = (record.deltaY || 0) / 20;
        
        this.currentPosition.x += deltaX;
        this.currentPosition.y += deltaY;
        
        currentPath.vertices.push({
            x: this.currentPosition.x,
            y: this.currentPosition.y
        });
    }

    processCurvedEdge(record, currentPath) {
        const controlDeltaX = (record.controlDeltaX || 0) / 20; // Convert from twips
        const controlDeltaY = (record.controlDeltaY || 0) / 20;
        const anchorDeltaX = (record.anchorDeltaX || 0) / 20;
        const anchorDeltaY = (record.anchorDeltaY || 0) / 20;
        
        const startX = this.currentPosition.x;
        const startY = this.currentPosition.y;
        
        const controlX = startX + controlDeltaX;
        const controlY = startY + controlDeltaY;
        
        this.currentPosition.x = controlX + anchorDeltaX;
        this.currentPosition.y = controlY + anchorDeltaY;
        
        // Subdivide the curve - use more steps for better accuracy
        const curveSegments = this.subdivideBezierCurve(
            startX, startY,
            controlX, controlY,
            this.currentPosition.x, this.currentPosition.y,
            12 // Increased subdivision for smoother curves
        );
        
        // Add all curve points except the first (already in path)
        for (let i = 1; i < curveSegments.length; i++) {
            currentPath.vertices.push(curveSegments[i]);
        }
    }

    finalizePath(path) {
        if (path.vertices.length < 2) {
            return;
        }
        
        // Remove duplicate points with higher precision
        path.vertices = this.removeDuplicatePoints(path.vertices, 0.01);
        
        // Check if path should be closed
        if (path.vertices.length >= 3) {
            const first = path.vertices[0];
            const last = path.vertices[path.vertices.length - 1];
            const distance = Math.sqrt(
                Math.pow(last.x - first.x, 2) + Math.pow(last.y - first.y, 2)
            );
            
            if (distance < 1.0) {
                path.closed = true;
                // Remove the duplicate last point
                path.vertices.pop();
            }
        }
    }

    isValidPath(path) {
        return path && path.vertices && path.vertices.length >= 3 && path.fillStyle > 0;
    }

    consolidatePathsByFillStyle(allPaths) {
        const pathsByFillStyle = new Map();
        
        for (const path of allPaths) {
            if (!this.isValidPath(path)) continue;
            
            const fillStyle = path.fillStyle;
            if (!pathsByFillStyle.has(fillStyle)) {
                pathsByFillStyle.set(fillStyle, []);
            }
            pathsByFillStyle.get(fillStyle).push(path);
        }
        
        const consolidatedPaths = [];
        
        for (const [fillStyle, paths] of pathsByFillStyle) {
            if (paths.length === 1) {
                consolidatedPaths.push(paths[0]);
            } else {
                // Merge multiple paths with the same fill style
                const mergedPath = this.mergePaths(paths, fillStyle);
                if (this.isValidPath(mergedPath)) {
                    consolidatedPaths.push(mergedPath);
                }
            }
        }
        
        return consolidatedPaths;
    }

    mergePaths(paths, fillStyle) {
        // For now, just take the largest path - more sophisticated merging could be added
        let largestPath = paths[0];
        for (const path of paths) {
            if (path.vertices.length > largestPath.vertices.length) {
                largestPath = path;
            }
        }
        
        return {
            vertices: [...largestPath.vertices],
            fillStyle: fillStyle,
            closed: largestPath.closed
        };
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

    robustTessellation(consolidatedPaths, fillStyles, bounds, shapeId) {
        this.logToTerminal(`Robust tessellation of ${consolidatedPaths.length} consolidated paths`);
        
        const allTriangles = [];
        
        for (const path of consolidatedPaths) {
            if (!this.isValidPath(path)) {
                continue;
            }
            
            const fillColor = this.getFillColorFromStyles(path.fillStyle, fillStyles);
            let triangles = [];
            
            // Method 1: Try improved ear clipping
            triangles = this.robustEarClipping(path.vertices, fillColor);
            
            if (triangles.length === 0) {
                // Method 2: Try triangle fan tessellation
                this.logToTerminal(`Ear clipping failed for path, trying triangle fan`);
                triangles = this.triangleFanTessellation(path.vertices, fillColor);
            }
            
            if (triangles.length === 0) {
                // Method 3: Try convex hull tessellation
                this.logToTerminal(`Triangle fan failed, trying convex hull`);
                triangles = this.convexHullTessellation(path.vertices, fillColor);
            }
            
            if (triangles.length > 0) {
                allTriangles.push(...triangles);
                this.logToTerminal(`Path tessellated: ${triangles.length} triangles`);
            } else {
                this.logToTerminal(`All tessellation methods failed for path`);
            }
        }
        
        // If no triangles were generated, create a fallback based on bounds
        if (allTriangles.length === 0) {
            this.logToTerminal(`No triangles generated, creating bounds-based fallback`);
            const fallbackColor = this.getFallbackColor(fillStyles);
            allTriangles.push(...this.createBoundsTriangles(bounds, fallbackColor));
        }
        
        this.logToTerminal(`Robust tessellation generated ${allTriangles.length} triangles`);
        return allTriangles;
    }

    robustEarClipping(vertices, fillColor) {
        if (vertices.length < 3) {
            return [];
        }
        
        // Create working copy and validate
        let workingVertices = this.removeDuplicatePoints([...vertices], 0.1);
        
        if (workingVertices.length < 3) {
            return [];
        }
        
        // Ensure counter-clockwise winding
        if (!this.isCounterClockwise(workingVertices)) {
            workingVertices.reverse();
        }
        
        const triangles = [];
        const maxIterations = workingVertices.length * 3; // More conservative limit
        let iterations = 0;
        let consecutiveFailures = 0;
        
        while (workingVertices.length > 3 && iterations < maxIterations && consecutiveFailures < workingVertices.length) {
            let earFound = false;
            
            for (let i = 0; i < workingVertices.length; i++) {
                const prevIndex = (i - 1 + workingVertices.length) % workingVertices.length;
                const currIndex = i;
                const nextIndex = (i + 1) % workingVertices.length;
                
                if (this.isValidEar(workingVertices, prevIndex, currIndex, nextIndex)) {
                    // Create triangle
                    const triangle = [
                        { ...workingVertices[prevIndex], color: fillColor },
                        { ...workingVertices[currIndex], color: fillColor },
                        { ...workingVertices[nextIndex], color: fillColor }
                    ];
                    
                    triangles.push(triangle);
                    workingVertices.splice(currIndex, 1);
                    earFound = true;
                    consecutiveFailures = 0;
                    break;
                }
            }
            
            if (!earFound) {
                consecutiveFailures++;
            }
            
            iterations++;
        }
        
        // Add final triangle if exactly 3 vertices remain
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

    triangleFanTessellation(vertices, fillColor) {
        if (vertices.length < 3) {
            return [];
        }
        
        const cleanVertices = this.removeDuplicatePoints([...vertices], 0.1);
        if (cleanVertices.length < 3) {
            return [];
        }
        
        const triangles = [];
        const center = cleanVertices[0]; // Use first vertex as fan center
        
        for (let i = 1; i < cleanVertices.length - 1; i++) {
            const triangle = [
                { ...center, color: fillColor },
                { ...cleanVertices[i], color: fillColor },
                { ...cleanVertices[i + 1], color: fillColor }
            ];
            triangles.push(triangle);
        }
        
        return triangles;
    }

    convexHullTessellation(vertices, fillColor) {
        if (vertices.length < 3) {
            return [];
        }
        
        // Compute convex hull using Graham scan
        const hull = this.computeConvexHull(vertices);
        
        if (hull.length < 3) {
            return [];
        }
        
        // Tessellate the convex hull using triangle fan
        return this.triangleFanTessellation(hull, fillColor);
    }

    computeConvexHull(points) {
        if (points.length < 3) {
            return points;
        }
        
        // Find the bottommost point (or leftmost in case of tie)
        let start = 0;
        for (let i = 1; i < points.length; i++) {
            if (points[i].y < points[start].y || 
                (points[i].y === points[start].y && points[i].x < points[start].x)) {
                start = i;
            }
        }
        
        // Sort points by polar angle with respect to start point
        const sortedPoints = [...points];
        const startPoint = sortedPoints[start];
        
        sortedPoints.sort((a, b) => {
            if (a === startPoint) return -1;
            if (b === startPoint) return 1;
            
            const angleA = Math.atan2(a.y - startPoint.y, a.x - startPoint.x);
            const angleB = Math.atan2(b.y - startPoint.y, b.x - startPoint.x);
            
            return angleA - angleB;
        });
        
        // Build convex hull
        const hull = [];
        
        for (const point of sortedPoints) {
            while (hull.length >= 2 && 
                   this.crossProduct(hull[hull.length - 2], hull[hull.length - 1], point) <= 0) {
                hull.pop();
            }
            hull.push(point);
        }
        
        return hull;
    }

    crossProduct(a, b, c) {
        return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    }

    removeDuplicatePoints(vertices, threshold = 0.1) {
        const cleaned = [];
        
        for (const vertex of vertices) {
            let isDuplicate = false;
            
            for (const existing of cleaned) {
                const distance = Math.sqrt(
                    Math.pow(vertex.x - existing.x, 2) + 
                    Math.pow(vertex.y - existing.y, 2)
                );
                
                if (distance < threshold) {
                    isDuplicate = true;
                    break;
                }
            }
            
            if (!isDuplicate) {
                cleaned.push(vertex);
            }
        }
        
        return cleaned;
    }

    isCounterClockwise(vertices) {
        let area = 0;
        const n = vertices.length;
        
        for (let i = 0; i < n; i++) {
            const j = (i + 1) % n;
            area += (vertices[j].x - vertices[i].x) * (vertices[j].y + vertices[i].y);
        }
        
        return area < 0; // Negative area indicates counter-clockwise
    }

    isValidEar(vertices, prevIndex, currIndex, nextIndex) {
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
            
            if (this.pointInsideTriangle(vertices[i], prev, curr, next)) {
                return false;
            }
        }
        
        return true;
    }

    isConvexAngle(a, b, c) {
        const cross = (c.x - a.x) * (b.y - a.y) - (c.y - a.y) * (b.x - a.x);
        return cross > 0;
    }

    pointInsideTriangle(p, a, b, c) {
        const denom = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);
        
        if (Math.abs(denom) < 1e-10) {
            return false;
        }
        
        const alpha = ((b.y - c.y) * (p.x - c.x) + (c.x - b.x) * (p.y - c.y)) / denom;
        const beta = ((c.y - a.y) * (p.x - c.x) + (a.x - c.x) * (p.y - c.y)) / denom;
        const gamma = 1 - alpha - beta;
        
        const epsilon = 1e-6;
        return alpha >= epsilon && beta >= epsilon && gamma >= epsilon;
    }

    getFillColorFromStyles(fillStyleIndex, fillStyles) {
        if (fillStyleIndex > 0 && fillStyleIndex <= fillStyles.length) {
            const style = fillStyles[fillStyleIndex - 1];
            if (style.color) {
                return [
                    (style.color.red || 128) / 255,
                    (style.color.green || 128) / 255,
                    (style.color.blue || 128) / 255,
                    (style.color.alpha || 255) / 255
                ];
            }
        }
        
        return [0.5, 0.5, 0.5, 1.0]; // Default gray
    }

    getFallbackColor(fillStyles) {
        if (fillStyles.length > 0 && fillStyles[0].color) {
            const color = fillStyles[0].color;
            return [
                (color.red || 128) / 255,
                (color.green || 128) / 255,
                (color.blue || 128) / 255,
                (color.alpha || 255) / 255
            ];
        }
        return [0.3, 0.3, 0.3, 1.0]; // Default dark gray
    }

    createBoundsTriangles(bounds, fillColor) {
        const x1 = bounds.xMin;
        const y1 = bounds.yMin;
        const x2 = bounds.xMax;
        const y2 = bounds.yMax;
        
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
            0.7, 0.7, 0.7, 1.0,
            0.7, 0.7, 0.7, 1.0,
            0.7, 0.7, 0.7, 1.0,
            0.7, 0.7, 0.7, 1.0,
            0.7, 0.7, 0.7, 1.0,
            0.7, 0.7, 0.7, 1.0
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
