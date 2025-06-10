/**
 * WebGL Flash Game Renderer for Flash-JS Repository
 * Integrates with Parse.js webpage terminal output for debugging
 * Uses ShapeTranslator.js for clean, pre-processed geometry data
 * Simplified to focus only on rendering, not shape processing
 */

class WebGLFlashRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.gl = null;
        this.program = null;
        this.buffers = {};
        this.uniforms = {};
        this.attributes = {};
        
        // Performance tracking
        this.frameCount = 0;
        this.lastFrameTime = 0;
        this.fps = 0;
        this.renderingActive = false;
        
        // Rendering state
        this.shapes = new Map(); // ID -> translated geometry
        this.displayList = new Map(); // depth -> display object
        this.textures = new Map();
        this.projectionMatrix = new Float32Array(16);
        this.viewMatrix = new Float32Array(16);
        
        // Flash-JS parser integration
        this.shapeParsers = null;
        this.displayParsers = null;
        this.shapeTranslator = null;
        this.stageWidth = 550;
        this.stageHeight = 400;
        
        // Debugging state for Flash-JS repository
        this.debugMode = true;
        this.renderAttempts = 0;
        this.shapeIdMap = new Map();
        this.displayObjectCharacterIds = new Set();
        
        this.initialize();
    }

    initialize() {
        try {
            // Initialize WebGL context
            this.gl = this.canvas.getContext('webgl') || this.canvas.getContext('experimental-webgl');
            
            if (!this.gl) {
                throw new Error('WebGL not supported');
            }

            // Set up WebGL state
            this.gl.enable(this.gl.BLEND);
            this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
            this.gl.disable(this.gl.DEPTH_TEST);

            // Create shader program
            this.createShaderProgram();
            
            // Create buffers
            this.createBuffers();
            
            // Set up projection matrix
            this.updateProjectionMatrix();
            
            // Initialize view matrix
            this.setIdentityMatrix(this.viewMatrix);

            // Initialize Flash-JS parsers and translator
            this.initializeParsersAndTranslator();

            this.logToTerminal('WebGL Flash Renderer initialized with ShapeTranslator integration');
            
        } catch (error) {
            this.logToTerminal(`WebGL initialization failed: ${error.message}`);
            throw error;
        }
    }

    initializeParsersAndTranslator() {
        try {
            // Initialize Flash-JS ShapeParsers
            if (typeof ShapeParsers !== 'undefined') {
                this.shapeParsers = new ShapeParsers();
                this.logToTerminal('ShapeParsers initialized for Flash-JS integration');
            } else {
                this.logToTerminal('ERROR: ShapeParsers not available');
            }
            
            // Initialize Flash-JS DisplayParsers
            if (typeof DisplayParsers !== 'undefined') {
                this.displayParsers = new DisplayParsers();
                this.logToTerminal('DisplayParsers initialized for Flash-JS integration');
            } else {
                this.logToTerminal('ERROR: DisplayParsers not available');
            }

            // Initialize ShapeTranslator for clean geometry data
            if (typeof ShapeTranslator !== 'undefined') {
                this.shapeTranslator = new ShapeTranslator();
                this.logToTerminal('ShapeTranslator initialized - clean separation of translation and rendering');
            } else {
                this.logToTerminal('ERROR: ShapeTranslator not available - cannot process shapes');
            }
            
        } catch (error) {
            this.logToTerminal(`Parser initialization error: ${error.message}`);
        }
    }

    createShaderProgram() {
        // Vertex shader for sprite rendering
        const vertexShaderSource = `
            attribute vec2 a_position;
            attribute vec4 a_color;
            
            uniform mat4 u_projectionMatrix;
            uniform mat4 u_viewMatrix;
            uniform mat4 u_modelMatrix;
            
            varying vec4 v_color;
            
            void main() {
                gl_Position = u_projectionMatrix * u_viewMatrix * u_modelMatrix * vec4(a_position, 0.0, 1.0);
                v_color = a_color;
            }
        `;

        // Fragment shader for sprite rendering
        const fragmentShaderSource = `
            precision mediump float;
            
            varying vec4 v_color;
            
            void main() {
                gl_FragColor = v_color;
            }
        `;

        const vertexShader = this.compileShader(vertexShaderSource, this.gl.VERTEX_SHADER);
        const fragmentShader = this.compileShader(fragmentShaderSource, this.gl.FRAGMENT_SHADER);

        this.program = this.gl.createProgram();
        this.gl.attachShader(this.program, vertexShader);
        this.gl.attachShader(this.program, fragmentShader);
        this.gl.linkProgram(this.program);

        if (!this.gl.getProgramParameter(this.program, this.gl.LINK_STATUS)) {
            throw new Error('Shader program linking failed: ' + this.gl.getProgramInfoLog(this.program));
        }

        // Get attribute and uniform locations
        this.attributes.position = this.gl.getAttribLocation(this.program, 'a_position');
        this.attributes.color = this.gl.getAttribLocation(this.program, 'a_color');

        this.uniforms.projectionMatrix = this.gl.getUniformLocation(this.program, 'u_projectionMatrix');
        this.uniforms.viewMatrix = this.gl.getUniformLocation(this.program, 'u_viewMatrix');
        this.uniforms.modelMatrix = this.gl.getUniformLocation(this.program, 'u_modelMatrix');

        this.logToTerminal('Shader program created successfully');
    }

    compileShader(source, type) {
        const shader = this.gl.createShader(type);
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);

        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            const error = this.gl.getShaderInfoLog(shader);
            this.gl.deleteShader(shader);
            throw new Error('Shader compilation failed: ' + error);
        }

        return shader;
    }

    createBuffers() {
        // Create vertex buffer for shapes (position + color)
        this.buffers.vertex = this.gl.createBuffer();
        this.buffers.color = this.gl.createBuffer();

        this.logToTerminal('WebGL buffers created');
    }

    updateProjectionMatrix() {
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        // Create orthographic projection matrix for 2D Flash content
        this.setOrthographicMatrix(this.projectionMatrix, 0, width, height, 0, -1, 1);
        
        this.logToTerminal(`Projection matrix updated for ${width}x${height}`);
    }

    setOrthographicMatrix(matrix, left, right, bottom, top, near, far) {
        const lr = 1 / (left - right);
        const bt = 1 / (bottom - top);
        const nf = 1 / (near - far);

        matrix[0] = -2 * lr;
        matrix[1] = 0;
        matrix[2] = 0;
        matrix[3] = 0;
        matrix[4] = 0;
        matrix[5] = -2 * bt;
        matrix[6] = 0;
        matrix[7] = 0;
        matrix[8] = 0;
        matrix[9] = 0;
        matrix[10] = 2 * nf;
        matrix[11] = 0;
        matrix[12] = (left + right) * lr;
        matrix[13] = (top + bottom) * bt;
        matrix[14] = (far + near) * nf;
        matrix[15] = 1;
    }

    setIdentityMatrix(matrix) {
        matrix.fill(0);
        matrix[0] = matrix[5] = matrix[10] = matrix[15] = 1;
    }

    // Direct integration with Flash-JS SWF tag parsing pipeline
    loadFromFlashJSSWFData(arrayBuffer) {
        this.logToTerminal('=== STARTING FLASH-JS SWF DATA LOADING WITH SHAPE TRANSLATOR ===');

        try {
            // Clear existing data
            this.shapes.clear();
            this.displayList.clear();
            this.shapeIdMap.clear();
            this.displayObjectCharacterIds.clear();
            
            // Parse SWF signature data using Flash-JS Parse.js
            const signatureData = parseSWFSignature(arrayBuffer);
            this.setupViewportFromSignature(signatureData);

            // Parse tags directly using Flash-JS tag parsing pipeline
            this.parseTagsWithTranslator(arrayBuffer);

            this.logToTerminal(`=== LOADING COMPLETE ===`);
            this.logToTerminal(`Translated shapes: ${this.shapes.size}, Display objects: ${this.displayList.size}`);

            // Analyze shape-display object linking
            this.analyzeShapeDisplayLinking();
            
            // Create display objects for all translated shapes
            this.createDisplayObjectsForAllShapes();

            // Debug log all objects
            this.debugLogAllObjects();

        } catch (error) {
            this.logToTerminal(`Error loading Flash-JS SWF data: ${error.message}`);
        }
    }

    parseTagsWithTranslator(arrayBuffer) {
        const bytes = new Uint8Array(arrayBuffer);
        
        if (arrayBuffer.byteLength < 8) {
            this.logToTerminal('Invalid SWF file: File is too small');
            return;
        }
        
        // Read signature to determine processing method
        const signature = String.fromCharCode(bytes[0], bytes[1], bytes[2]);
        let tagData;
        
        this.logToTerminal(`SWF signature: ${signature}`);
        
        try {
            switch (signature) {
                case 'FWS':
                    this.logToTerminal('Processing uncompressed FWS file with ShapeTranslator');
                    const rect = parseRECT(bytes, 8);
                    const nbits = (bytes[8] >> 3) & 0x1F;
                    const rectBits = 5 + (4 * nbits);
                    const rectBytes = Math.ceil(rectBits / 8);
                    const tagOffset = 8 + rectBytes + 4;
                    tagData = bytes.slice(tagOffset);
                    break;
                    
                case 'CWS':
                    this.logToTerminal('Processing ZLIB compressed CWS file with ShapeTranslator');
                    const compressedData = arrayBuffer.slice(8);
                    const decompressedData = pako.inflate(new Uint8Array(compressedData));
                    
                    const rectCWS = parseRECT(decompressedData, 0);
                    const nbitsCWS = (decompressedData[0] >> 3) & 0x1F;
                    const rectBitsCWS = 5 + (4 * nbitsCWS);
                    const rectBytesCWS = Math.ceil(rectBitsCWS / 8);
                    const tagOffsetCWS = rectBytesCWS + 4;
                    tagData = decompressedData.slice(tagOffsetCWS);
                    break;
                    
                case 'ZWS':
                    this.logToTerminal('LZMA decompression not yet supported for direct rendering');
                    return;
                    
                default:
                    this.logToTerminal(`Unknown SWF format: ${signature}`);
                    return;
            }
            
            this.parseTagDataWithTranslator(tagData);
            
        } catch (error) {
            this.logToTerminal(`Error parsing tags for rendering: ${error.message}`);
        }
    }

    parseTagDataWithTranslator(tagData) {
        let offset = 0;
        let tagIndex = 0;
        
        this.logToTerminal('=== PARSING TAGS WITH SHAPE TRANSLATOR ===');
        
        while (offset < tagData.length && tagIndex < 100) {
            const tagHeader = this.parseTagHeader(tagData, offset);
            
            if (!tagHeader) {
                this.logToTerminal(`Error parsing tag header at offset ${offset}`);
                break;
            }
            
            const contentOffset = offset + tagHeader.headerSize;
            
            // Process shape definition tags using ShapeTranslator
            if ([2, 22, 32, 83].includes(tagHeader.type)) {
                if (this.shapeParsers && this.shapeTranslator) {
                    try {
                        // Parse shape using Flash-JS ShapeParsers
                        const parsedShape = this.shapeParsers.parseTag(tagHeader.type, tagData, contentOffset, tagHeader.length);
                        
                        if (parsedShape && parsedShape.data && parsedShape.data.shapeId !== undefined) {
                            // Translate to WebGL-ready geometry using ShapeTranslator
                            const translatedGeometry = this.shapeTranslator.translateShape(parsedShape.data);
                            
                            // Store translated geometry for rendering
                            this.shapes.set(parsedShape.data.shapeId, translatedGeometry);
                            this.shapeIdMap.set(parsedShape.data.shapeId, true);
                            
                            this.logToTerminal(`Shape ${parsedShape.data.shapeId} translated: ${translatedGeometry.triangleCount} triangles`);
                        }
                    } catch (error) {
                        this.logToTerminal(`Error processing shape tag ${tagHeader.type}: ${error.message}`);
                    }
                }
            }
            
            // Process display list tags using Flash-JS DisplayParsers
            if ([4, 26, 70].includes(tagHeader.type)) {
                if (this.displayParsers) {
                    try {
                        const parsedDisplay = this.displayParsers.parseTag(tagHeader.type, tagData, contentOffset, tagHeader.length);
                        if (parsedDisplay && parsedDisplay.data && parsedDisplay.data.depth !== undefined) {
                            this.processDisplayObjectForRendering(parsedDisplay.data);
                            if (parsedDisplay.data.characterId !== undefined) {
                                this.displayObjectCharacterIds.add(parsedDisplay.data.characterId);
                            }
                        }
                    } catch (error) {
                        this.logToTerminal(`Error parsing display tag ${tagHeader.type}: ${error.message}`);
                    }
                }
            }
            
            // If this is the End tag (type 0), stop parsing
            if (tagHeader.type === 0) {
                this.logToTerminal('End tag reached - parsing complete');
                break;
            }
            
            // Move to next tag
            offset += tagHeader.headerSize + tagHeader.length;
            tagIndex++;
        }
        
        this.logToTerminal(`Processed ${tagIndex} tags with ShapeTranslator`);
    }

    parseTagHeader(data, offset) {
        if (offset + 2 > data.length) {
            return null;
        }
        
        const byte1 = data[offset];
        const byte2 = data[offset + 1];
        
        const tagAndLength = (byte2 << 8) | byte1;
        const tagType = (tagAndLength >> 6) & 0x3FF;
        const shortLength = tagAndLength & 0x3F;
        
        let length, headerSize;
        
        if (shortLength === 0x3F) {
            if (offset + 6 > data.length) {
                return null;
            }
            
            length = data[offset + 2] | 
                     (data[offset + 3] << 8) | 
                     (data[offset + 4] << 16) | 
                     (data[offset + 5] << 24);
            headerSize = 6;
        } else {
            length = shortLength;
            headerSize = 2;
        }
        
        return {
            type: tagType,
            length: length,
            headerSize: headerSize
        };
    }

    processDisplayObjectForRendering(displayData) {
        this.logToTerminal(`Processing display object: Character ${displayData.characterId} at depth ${displayData.depth}`);
        
        const depth = displayData.depth;
        const characterId = displayData.characterId;
        
        // Create display object with transform matrix
        const displayObject = {
            characterId: characterId,
            depth: depth,
            matrix: this.extractTransformMatrix(displayData),
            visible: true
        };
        
        this.displayList.set(depth, displayObject);
        
        this.logToTerminal(`Display object stored at depth ${depth} referencing character ${characterId}`);
    }

    extractTransformMatrix(displayData) {
        // Extract transform matrix from Flash-JS DisplayParsers data structure
        const matrix = new Float32Array(16);
        this.setIdentityMatrix(matrix);
        
        if (displayData.matrix) {
            const m = displayData.matrix;
            
            // Apply scale
            if (m.scaleX !== undefined && m.scaleX !== 0) matrix[0] = m.scaleX;
            if (m.scaleY !== undefined && m.scaleY !== 0) matrix[5] = m.scaleY;
            
            // Apply rotation/skew (simplified)
            if (m.rotateSkew0 !== undefined) matrix[1] = m.rotateSkew0;
            if (m.rotateSkew1 !== undefined) matrix[4] = m.rotateSkew1;
            
            // Apply translation (convert twips to pixels)
            if (m.translateX !== undefined) matrix[12] = m.translateX / 20;
            if (m.translateY !== undefined) matrix[13] = m.translateY / 20;
        }
        
        return matrix;
    }

    analyzeShapeDisplayLinking() {
        this.logToTerminal('=== ANALYZING SHAPE-DISPLAY LINKING ===');
        
        const availableShapeIds = Array.from(this.shapes.keys());
        const referencedCharacterIds = Array.from(this.displayObjectCharacterIds);
        
        this.logToTerminal(`Translated shape IDs: [${availableShapeIds.slice(0, 10).join(', ')}${availableShapeIds.length > 10 ? '...' : ''}] (${availableShapeIds.length} total)`);
        this.logToTerminal(`Referenced character IDs: [${referencedCharacterIds.join(', ')}] (${referencedCharacterIds.length} total)`);
        
        if (referencedCharacterIds.length === 0) {
            this.logToTerminal('NO DISPLAY OBJECTS FOUND - Will create display objects for all translated shapes');
        }
    }

    createDisplayObjectsForAllShapes() {
        this.logToTerminal('=== CREATING DISPLAY OBJECTS FOR ALL TRANSLATED SHAPES ===');
        
        const availableShapeIds = Array.from(this.shapes.keys());
        let createdCount = 0;
        let depth = 1;
        
        // Create a grid layout for all translated shapes
        const cols = Math.ceil(Math.sqrt(availableShapeIds.length));
        const rows = Math.ceil(availableShapeIds.length / cols);
        const cellWidth = this.stageWidth / cols;
        const cellHeight = this.stageHeight / rows;
        
        this.logToTerminal(`Creating ${availableShapeIds.length} display objects for translated shapes in ${cols}x${rows} grid`);
        
        for (let i = 0; i < availableShapeIds.length; i++) {
            const shapeId = availableShapeIds[i];
            const col = i % cols;
            const row = Math.floor(i / cols);
            
            // Calculate position in grid
            const x = col * cellWidth + cellWidth * 0.1;
            const y = row * cellHeight + cellHeight * 0.1;
            
            // Create transform matrix with position
            const matrix = new Float32Array(16);
            this.setIdentityMatrix(matrix);
            matrix[12] = x; // X translation
            matrix[13] = y; // Y translation
            
            const displayObject = {
                characterId: shapeId,
                depth: depth,
                matrix: matrix,
                visible: true
            };
            
            this.displayList.set(depth, displayObject);
            this.logToTerminal(`Created display object for translated shape ${shapeId} at depth ${depth}, position (${x.toFixed(1)}, ${y.toFixed(1)})`);
            
            depth++;
            createdCount++;
        }
        
        this.logToTerminal(`Created ${createdCount} display objects for translated shapes`);
    }

    setupViewportFromSignature(signatureData) {
        // Parse signature data to extract stage dimensions
        const lines = signatureData.split('\n');
        for (const line of lines) {
            if (line.includes('Stage Dimensions:')) {
                const match = line.match(/(\d+)\s*×\s*(\d+)\s*pixels/);
                if (match) {
                    this.stageWidth = parseInt(match[1]);
                    this.stageHeight = parseInt(match[2]);
                    this.canvas.width = this.stageWidth;
                    this.canvas.height = this.stageHeight;
                    this.updateProjectionMatrix();
                    this.logToTerminal(`Viewport set to ${this.stageWidth}x${this.stageHeight} from Flash-JS signature data`);
                    break;
                }
            }
        }
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

        // Clear canvas with dark gray background for contrast
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        this.gl.clearColor(0.2, 0.2, 0.2, 1.0);
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
        this.render();
        this.logToTerminal('=== WEBGL RENDERING STARTED WITH SHAPE TRANSLATOR ===');
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
        
        console.log(logMessage);
        
        // Use Flash-JS Parse.js webpage terminal output system
        const terminal = document.getElementById('terminalOutput');
        if (terminal) {
            terminal.textContent += '\n' + logMessage;
            terminal.scrollTop = terminal.scrollHeight;
        }
    }

    // Cleanup
    destroy() {
        this.renderingActive = false;
        
        if (this.gl) {
            if (this.program) {
                this.gl.deleteProgram(this.program);
            }
            
            Object.values(this.buffers).forEach(buffer => {
                this.gl.deleteBuffer(buffer);
            });
            
            this.textures.forEach(texture => {
                this.gl.deleteTexture(texture);
            });
        }
        
        this.logToTerminal('WebGL Flash Renderer destroyed');
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
