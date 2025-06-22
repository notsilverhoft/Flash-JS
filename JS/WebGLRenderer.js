/**
 * WebGL Flash Renderer for Flash-JS Repository
 * ONLY RENDERS pre-translated data - NO PARSING FUNCTIONALITY
 * Strict separation from parsing pipeline
 * Receives data from ShapeTranslator and DisplayTranslator
 */

class WebGLFlashRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.gl = null;
        
        // Store shapes and display objects
        this.shapes = new Map(); // characterId -> translated geometry
        this.displayList = new Map(); // depth -> display object
        
        // WebGL state
        this.program = null;
        this.buffers = {};
        this.attributes = {};
        this.uniforms = {};
        
        // Rendering state
        this.renderingActive = false;
        this.lastFrameTime = 0;
        this.frameCount = 0;
        this.fps = 0;
        this.renderAttempts = 0;
        
        // Stage properties
        this.stageWidth = 550;
        this.stageHeight = 400;
        this.backgroundColor = [0.2, 0.2, 0.2, 1.0];
        
        // Matrices
        this.projectionMatrix = new Float32Array(16);
        this.viewMatrix = new Float32Array(16);
        
        // Initialize WebGL
        this.initialize();
    }

    initialize() {
        try {
            // Initialize WebGL context
            this.gl = this.canvas.getContext('webgl') || this.canvas.getContext('experimental-webgl');
            
            if (!this.gl) {
                this.logToTerminal('WebGL not supported');
                return false;
            }
            
            // Create shader program
            this.createShaderProgram();
            
            // Create buffers
            this.createBuffers();
            
            // Set up projection matrix
            this.updateProjectionMatrix();
            
            // Set view matrix (identity)
            this.setIdentityMatrix(this.viewMatrix);
            
            this.logToTerminal('WebGL initialized successfully');
            return true;
            
        } catch (error) {
            this.logToTerminal(`WebGL initialization error: ${error.message}`);
            return false;
        }
    }

    createShaderProgram() {
        // Vertex shader source
        const vsSource = `
            attribute vec2 aVertexPosition;
            attribute vec4 aVertexColor;
            
            uniform mat4 uProjectionMatrix;
            uniform mat4 uViewMatrix;
            uniform mat4 uModelMatrix;
            
            varying lowp vec4 vColor;
            
            void main(void) {
                gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(aVertexPosition, 0.0, 1.0);
                vColor = aVertexColor;
            }
        `;
        
        // Fragment shader source
        const fsSource = `
            varying lowp vec4 vColor;
            
            void main(void) {
                gl_FragColor = vColor;
            }
        `;
        
        // Compile shaders
        const vertexShader = this.compileShader(vsSource, this.gl.VERTEX_SHADER);
        const fragmentShader = this.compileShader(fsSource, this.gl.FRAGMENT_SHADER);
        
        // Create program
        this.program = this.gl.createProgram();
        this.gl.attachShader(this.program, vertexShader);
        this.gl.attachShader(this.program, fragmentShader);
        this.gl.linkProgram(this.program);
        
        // Check if program linked successfully
        if (!this.gl.getProgramParameter(this.program, this.gl.LINK_STATUS)) {
            this.logToTerminal(`Unable to link shader program: ${this.gl.getProgramInfoLog(this.program)}`);
            return null;
        }
        
        // Get attribute and uniform locations
        this.attributes = {
            position: this.gl.getAttribLocation(this.program, 'aVertexPosition'),
            color: this.gl.getAttribLocation(this.program, 'aVertexColor')
        };
        
        this.uniforms = {
            projectionMatrix: this.gl.getUniformLocation(this.program, 'uProjectionMatrix'),
            viewMatrix: this.gl.getUniformLocation(this.program, 'uViewMatrix'),
            modelMatrix: this.gl.getUniformLocation(this.program, 'uModelMatrix')
        };
        
        this.logToTerminal('Shader program created successfully');
    }

    compileShader(source, type) {
        const shader = this.gl.createShader(type);
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);
        
        // Check if shader compiled successfully
        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            this.logToTerminal(`Error compiling shader: ${this.gl.getShaderInfoLog(shader)}`);
            this.gl.deleteShader(shader);
            return null;
        }
        
        return shader;
    }

    createBuffers() {
        // Create vertex position buffer
        this.buffers = {
            vertex: this.gl.createBuffer(),
            color: this.gl.createBuffer()
        };
        
        this.logToTerminal('WebGL buffers created');
    }

    updateProjectionMatrix() {
        // Use orthographic projection for 2D rendering
        this.setOrthographicMatrix(
            this.projectionMatrix,
            0, this.stageWidth,
            this.stageHeight, 0,
            -1, 1
        );
        
        this.logToTerminal(`Updated projection matrix for stage: ${this.stageWidth}x${this.stageHeight}`);
    }

    setOrthographicMatrix(matrix, left, right, bottom, top, near, far) {
        // Column-major order
        matrix[0] = 2 / (right - left);
        matrix[1] = 0;
        matrix[2] = 0;
        matrix[3] = 0;
        
        matrix[4] = 0;
        matrix[5] = 2 / (top - bottom);
        matrix[6] = 0;
        matrix[7] = 0;
        
        matrix[8] = 0;
        matrix[9] = 0;
        matrix[10] = -2 / (far - near);
        matrix[11] = 0;
        
        matrix[12] = -(right + left) / (right - left);
        matrix[13] = -(top + bottom) / (top - bottom);
        matrix[14] = -(far + near) / (far - near);
        matrix[15] = 1;
    }

    setIdentityMatrix(matrix) {
        matrix[0] = 1;  matrix[4] = 0;  matrix[8] = 0;   matrix[12] = 0;
        matrix[1] = 0;  matrix[5] = 1;  matrix[9] = 0;   matrix[13] = 0;
        matrix[2] = 0;  matrix[6] = 0;  matrix[10] = 1;  matrix[14] = 0;
        matrix[3] = 0;  matrix[7] = 0;  matrix[11] = 0;  matrix[15] = 1;
    }

    extractTransformMatrix(displayData) {
        const matrix = new Float32Array(16);
        this.setIdentityMatrix(matrix);
        
        if (displayData && displayData.matrix) {
            const m = displayData.matrix;
            
            // Apply scaling
            if (m.scaleX !== undefined) matrix[0] = m.scaleX;
            if (m.scaleY !== undefined) matrix[5] = m.scaleY;
            
            // Apply rotation (skew)
            if (m.skewX !== undefined) {
                matrix[1] = Math.sin(m.skewX);
                matrix[0] = Math.cos(m.skewX) * (m.scaleX !== undefined ? m.scaleX : 1.0);
            }
            
            if (m.skewY !== undefined) {
                matrix[4] = Math.sin(m.skewY);
                matrix[5] = Math.cos(m.skewY) * (m.scaleY !== undefined ? m.scaleY : 1.0);
            }
            
            // Apply translation (convert from twips if needed)
            if (m.translateX !== undefined) matrix[12] = m.translateX / 20;
            if (m.translateY !== undefined) matrix[13] = m.translateY / 20;
        }
        
        return matrix;
    }

    analyzeShapeDisplayLinking() {
        this.logToTerminal('=== ANALYZING SHAPE-DISPLAY LINKING ===');
        const shapesInUse = new Set();
        
        // Find which shapes are used in display list
        for (const [depth, displayObj] of this.displayList.entries()) {
            if (displayObj.characterId !== undefined) {
                shapesInUse.add(displayObj.characterId);
            }
        }
        
        // Log shapes not in use
        let unusedShapeCount = 0;
        for (const characterId of this.shapes.keys()) {
            if (!shapesInUse.has(characterId)) {
                unusedShapeCount++;
            }
        }
        
        this.logToTerminal(`Shape usage analysis: ${shapesInUse.size} shapes used in display list, ${unusedShapeCount} unused shapes`);
        
        return {
            shapesInUse: shapesInUse,
            unusedShapeCount: unusedShapeCount
        };
    }

    createDisplayObjectsForAllShapes() {
        this.logToTerminal('Creating display objects for all translated shapes');
        
        const availableShapeIds = Array.from(this.shapes.keys());
        let createdCount = 0;
        let depth = 1;
        
        // Create a grid layout for all translated shapes
        const cols = Math.ceil(Math.sqrt(availableShapeIds.length));
        const rows = Math.ceil(availableShapeIds.length / cols);
        const cellWidth = this.stageWidth / cols;
        const cellHeight = this.stageHeight / rows;
        
        this.logToTerminal(`Creating ${availableShapeIds.length} display objects in ${cols}x${rows} grid`);
        
        for (let i = 0; i < availableShapeIds.length; i++) {
            const shapeId = availableShapeIds[i];
            const col = i % cols;
            const row = Math.floor(i / cols);
            
            // Calculate position in grid
            const x = col * cellWidth + cellWidth / 2;
            const y = row * cellHeight + cellHeight / 2;
            
            // Create display object with identity matrix
            const matrix = new Float32Array(16);
            this.setIdentityMatrix(matrix);
            
            // Set translation
            matrix[12] = x;
            matrix[13] = y;
            
            // Set scale based on cell size
            const scale = Math.min(cellWidth, cellHeight) / 200;
            matrix[0] = scale;
            matrix[5] = scale;
            
            const displayObject = {
                characterId: shapeId,
                depth: depth++,
                matrix: matrix,
                visible: true
            };
            
            this.displayList.set(displayObject.depth, displayObject);
            createdCount++;
        }
        
        this.logToTerminal(`Created ${createdCount} display objects for translated shapes`);
        return createdCount > 0;
    }

    setupViewportFromSignature(signatureData) {
        if (!signatureData || !signatureData.frameSize) {
            return false;
        }
        
        // Extract frame size from signature data
        const frameWidth = (signatureData.frameSize.xMax - signatureData.frameSize.xMin) / 20;
        const frameHeight = (signatureData.frameSize.yMax - signatureData.frameSize.yMin) / 20;
        
        // Update stage size
        if (frameWidth > 0 && frameHeight > 0) {
            this.setStageSize(frameWidth, frameHeight);
            return true;
        }
        
        return false;
    }

    createIdentityMatrix() {
        const matrix = new Float32Array(16);
        this.setIdentityMatrix(matrix);
        return matrix;
    }

    debugLogAllObjects() {
        this.logToTerminal('=== DEBUG: ALL TRANSLATED OBJECTS ===');
        this.logToTerminal(`Translated shapes in map: ${this.shapes.size}`);
        
        // Log translation statistics
        if (this.shapeTranslator) {
            const stats = this.shapeTranslator.getTranslationStats();
            this.logToTerminal(`Translation stats: ${stats.totalTranslations} shapes translated using ${stats.method}`);
        }
        
        this.logToTerminal(`Display objects in map: ${this.displayList.size}`);
        const displayObjects = Array.from(this.displayList.entries()).slice(0, 5);
        for (const [depth, obj] of displayObjects) {
            this.logToTerminal(`  Depth ${depth}: Character ${obj.characterId}, Visible: ${obj.visible}`);
        }
        if (this.displayList.size > 5) {
            this.logToTerminal(`  ... and ${this.displayList.size - 5} more display objects`);
        }
    }

    // Enhanced render loop with translated geometry
    render() {
        const currentTime = performance.now();
        const deltaTime = currentTime - this.lastFrameTime;
        this.lastFrameTime = currentTime;
        
        this.renderAttempts++;
        
        // Calculate FPS
        this.frameCount++;
        if (this.frameCount % 60 === 0) {
            this.fps = Math.round(1000 / deltaTime);
            this.logToTerminal(`=== RENDERING TRANSLATED SHAPES ===`);
            this.logToTerminal(`FPS: ${this.fps}, Translated shapes: ${this.shapes.size}, Display objects: ${this.displayList.size}`);
        }

        // Clear canvas with background color
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        this.gl.clearColor(...this.backgroundColor);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);

        // Use shader program
        this.gl.useProgram(this.program);
        
        // Set uniforms
        this.gl.uniformMatrix4fv(this.uniforms.projectionMatrix, false, this.projectionMatrix);
        this.gl.uniformMatrix4fv(this.uniforms.viewMatrix, false, this.viewMatrix);

        // Render display list with translated geometry
        this.renderTranslatedDisplayList();

        // Continue rendering loop if active
        if (this.renderingActive) {
            requestAnimationFrame(() => this.render());
        }
    }

    renderTranslatedDisplayList() {
        // Sort display objects by depth
        const sortedDisplayObjects = Array.from(this.displayList.entries())
            .sort(([depthA], [depthB]) => depthA - depthB);
        
        let renderedCount = 0;
        
        for (const [depth, displayObject] of sortedDisplayObjects) {
            if (displayObject.visible && displayObject.characterId !== undefined) {
                const wasRendered = this.renderTranslatedDisplayObject(displayObject, depth);
                if (wasRendered) renderedCount++;
            }
        }
        
        if (this.frameCount % 120 === 0) {
            this.logToTerminal(`Successfully rendered ${renderedCount} translated objects`);
        }
    }

    renderTranslatedDisplayObject(displayObject, depth) {
        const translatedShape = this.shapes.get(displayObject.characterId);
        if (!translatedShape) {
            if (this.frameCount % 300 === 0) {
                this.logToTerminal(`WARNING: No translated shape found for character ID ${displayObject.characterId} at depth ${depth}`);
            }
            return false;
        }
        
        // Set model matrix for this display object
        this.gl.uniformMatrix4fv(this.uniforms.modelMatrix, false, displayObject.matrix);
        
        // Bind translated vertex data
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffers.vertex);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, translatedShape.vertices, this.gl.STATIC_DRAW);
        this.gl.enableVertexAttribArray(this.attributes.position);
        this.gl.vertexAttribPointer(this.attributes.position, 2, this.gl.FLOAT, false, 0, 0);
        
        // Bind translated color data
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffers.color);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, translatedShape.colors, this.gl.STATIC_DRAW);
        this.gl.enableVertexAttribArray(this.attributes.color);
        this.gl.vertexAttribPointer(this.attributes.color, 4, this.gl.FLOAT, false, 0, 0);
        
        // Draw the translated shape
        this.gl.drawArrays(this.gl.TRIANGLES, 0, translatedShape.vertexCount);
        
        return true;
    }

    startRendering() {
        this.renderingActive = true;
        this.lastFrameTime = performance.now();
        this.render();
        this.logToTerminal('=== WEBGL RENDERING STARTED WITH TRANSLATED DATA ===');
    }

    stopRendering() {
        this.renderingActive = false;
        this.logToTerminal('WebGL rendering stopped');
    }

    clearRenderer() {
        this.shapes.clear();
        this.displayList.clear();
        this.renderingActive = false;
        this.logToTerminal('WebGL renderer cleared');
    }

    // Debug logging using Flash-JS Parse.js webpage terminal output method
    logToTerminal(message) {
        const timestamp = new Date().toISOString().substring(11, 19);
        const logMessage = `[${timestamp}] [WebGL] ${message}`;
        
        // Use Flash-JS Parse.js webpage terminal output system
        const terminal = document.getElementById('displayOutput');
        if (terminal) {
            terminal.textContent += '\n' + logMessage;
            terminal.scrollTop = terminal.scrollHeight;
        }
    }

    // Set stage dimensions
    setStageSize(width, height) {
        this.stageWidth = width;
        this.stageHeight = height;
        
        // Update canvas dimensions if provided
        if (this.canvas) {
            this.canvas.width = width;
            this.canvas.height = height;
            this.gl.viewport(0, 0, width, height);
        }
        
        // Update projection matrix
        this.updateProjectionMatrix();
        
        this.logToTerminal(`Stage size updated to ${width}x${height}`);
    }

    // Set background color
    setBackgroundColor(r, g, b, a = 1.0) {
        this.backgroundColor = [r, g, b, a];
        this.logToTerminal(`Background color set to [${r}, ${g}, ${b}, ${a}]`);
    }

    // Add a single display object
    addDisplayObject(displayObject) {
        if (!displayObject || displayObject.depth === undefined || displayObject.characterId === undefined) {
            this.logToTerminal('Invalid display object');
            return false;
        }
        
        this.displayList.set(displayObject.depth, displayObject);
        this.logToTerminal(`Added display object at depth ${displayObject.depth} with character ID ${displayObject.characterId}`);
        return true;
    }

    // Remove a display object at specified depth
    removeDisplayObject(depth) {
        if (this.displayList.has(depth)) {
            this.displayList.delete(depth);
            this.logToTerminal(`Removed display object at depth ${depth}`);
            return true;
        } else {
            this.logToTerminal(`No display object found at depth ${depth}`);
            return false;
        }
    }

    // Cleanup
    destroy() {
        // Stop rendering
        this.renderingActive = false;
        
        // Clear data
        this.shapes.clear();
        this.displayList.clear();
        
        // Delete WebGL resources
        if (this.gl) {
            // Delete buffers
            if (this.buffers.vertex) this.gl.deleteBuffer(this.buffers.vertex);
            if (this.buffers.color) this.gl.deleteBuffer(this.buffers.color);
            
            // Delete shader program
            if (this.program) this.gl.deleteProgram(this.program);
        }
        
        this.logToTerminal('WebGL renderer destroyed');
    }
}

// Export for use with Flash-JS repository
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WebGLFlashRenderer;
}

// Global access for Flash-JS repository integration
if (typeof window !== 'undefined') {
    window.WebGLFlashRenderer = WebGLFlashRenderer;
}
