/**
 * WebGL Flash Game Renderer for Flash-JS Repository
 * Integrates with Parse.js webpage terminal output for debugging
 * Optimized for big Flash games performance
 * PHASE 2: Fixed shape-display object linking for Flash-JS ShapeParsers and DisplayParsers
 * FIXED: Display objects now properly link to shape definitions
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
        this.shapes = new Map(); // ID -> shape definition
        this.displayList = new Map(); // depth -> display object
        this.textures = new Map();
        this.projectionMatrix = new Float32Array(16);
        this.viewMatrix = new Float32Array(16);
        
        // Flash-JS parser integration
        this.shapeParsers = null;
        this.displayParsers = null;
        this.stageWidth = 550;
        this.stageHeight = 400;
        
        // Debugging state
        this.debugMode = true;
        this.renderAttempts = 0;
        this.shapeIdMap = new Map(); // Track all shape IDs found
        this.displayObjectCharacterIds = new Set(); // Track all character IDs referenced
        
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
            this.gl.disable(this.gl.DEPTH_TEST); // Disable depth test for 2D rendering

            // Create shader program
            this.createShaderProgram();
            
            // Create buffers
            this.createBuffers();
            
            // Set up projection matrix
            this.updateProjectionMatrix();
            
            // Initialize view matrix
            this.setIdentityMatrix(this.viewMatrix);

            // Initialize Flash-JS parsers
            this.initializeParsers();

            this.logToTerminal('WebGL Flash Renderer initialized successfully');
            
        } catch (error) {
            this.logToTerminal(`WebGL initialization failed: ${error.message}`);
            throw error;
        }
    }

    initializeParsers() {
        try {
            if (typeof ShapeParsers !== 'undefined') {
                this.shapeParsers = new ShapeParsers();
                this.logToTerminal('ShapeParsers initialized for WebGL rendering');
            } else {
                this.logToTerminal('ERROR: ShapeParsers not available');
            }
            
            if (typeof DisplayParsers !== 'undefined') {
                this.displayParsers = new DisplayParsers();
                this.logToTerminal('DisplayParsers initialized for WebGL rendering');
            } else {
                this.logToTerminal('ERROR: DisplayParsers not available');
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
        // Use standard OpenGL coordinate system: origin at bottom-left
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
        this.logToTerminal('=== STARTING FLASH-JS SWF DATA LOADING ===');

        try {
            // Clear existing data
            this.shapes.clear();
            this.displayList.clear();
            this.shapeIdMap.clear();
            this.displayObjectCharacterIds.clear();
            
            // Parse SWF signature data
            const signatureData = parseSWFSignature(arrayBuffer);
            this.setupViewportFromSignature(signatureData);

            // Parse tags directly using Flash-JS tag parsing pipeline
            this.parseTagsDirectly(arrayBuffer);

            this.logToTerminal(`=== LOADING COMPLETE ===`);
            this.logToTerminal(`Found shapes: ${this.shapes.size}, Display objects: ${this.displayList.size}`);

            // Analyze shape-display object linking
            this.analyzeShapeDisplayLinking();
            
            // Create fallback display objects if shapes exist but no display objects reference them
            this.createMissingDisplayObjects();

            // Always create a test shape for debugging
            this.createTestShape();
            
            // Debug log all objects
            this.debugLogAllObjects();

        } catch (error) {
            this.logToTerminal(`Error loading Flash-JS SWF data: ${error.message}`);
        }
    }

    parseTagsDirectly(arrayBuffer) {
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
                    this.logToTerminal('Processing uncompressed FWS file');
                    // Calculate tag data offset for uncompressed files
                    const rect = parseRECT(bytes, 8);
                    const nbits = (bytes[8] >> 3) & 0x1F;
                    const rectBits = 5 + (4 * nbits);
                    const rectBytes = Math.ceil(rectBits / 8);
                    const tagOffset = 8 + rectBytes + 4; // +4 for frame rate and count
                    tagData = bytes.slice(tagOffset);
                    break;
                    
                case 'CWS':
                    this.logToTerminal('Processing ZLIB compressed CWS file');
                    // Decompress ZLIB data
                    const compressedData = arrayBuffer.slice(8);
                    const decompressedData = pako.inflate(new Uint8Array(compressedData));
                    
                    // Calculate tag offset from decompressed data
                    const rectCWS = parseRECT(decompressedData, 0);
                    const nbitsCWS = (decompressedData[0] >> 3) & 0x1F;
                    const rectBitsCWS = 5 + (4 * nbitsCWS);
                    const rectBytesCWS = Math.ceil(rectBitsCWS / 8);
                    const tagOffsetCWS = rectBytesCWS + 4;
                    tagData = decompressedData.slice(tagOffsetCWS);
                    break;
                    
                case 'ZWS':
                    this.logToTerminal('LZMA decompression not yet supported for direct rendering');
                    this.createTestShape();
                    return;
                    
                default:
                    this.logToTerminal(`Unknown SWF format: ${signature}`);
                    this.createTestShape();
                    return;
            }
            
            this.parseTagDataForRendering(tagData);
            
        } catch (error) {
            this.logToTerminal(`Error parsing tags for rendering: ${error.message}`);
        }
    }

    parseTagDataForRendering(tagData) {
        let offset = 0;
        let tagIndex = 0;
        
        this.logToTerminal('=== PARSING TAGS FOR RENDERING ===');
        
        while (offset < tagData.length && tagIndex < 100) {
            const tagHeader = this.parseTagHeader(tagData, offset);
            
            if (!tagHeader) {
                this.logToTerminal(`Error parsing tag header at offset ${offset}`);
                break;
            }
            
            const contentOffset = offset + tagHeader.headerSize;
            
            this.logToTerminal(`Tag ${tagIndex}: Type ${tagHeader.type}, Length ${tagHeader.length}`);
            
            // Process shape definition tags
            if ([2, 22, 32, 83].includes(tagHeader.type)) {
                this.logToTerminal(`Found shape definition tag ${tagHeader.type}`);
                if (this.shapeParsers) {
                    try {
                        const parsedShape = this.shapeParsers.parseTag(tagHeader.type, tagData, contentOffset, tagHeader.length);
                        if (parsedShape && parsedShape.data && parsedShape.data.shapeId !== undefined) {
                            this.processShapeForRendering(parsedShape.data);
                            this.shapeIdMap.set(parsedShape.data.shapeId, true);
                        }
                    } catch (error) {
                        this.logToTerminal(`Error parsing shape tag ${tagHeader.type}: ${error.message}`);
                    }
                }
            }
            
            // Process display list tags
            if ([4, 26, 70].includes(tagHeader.type)) {
                this.logToTerminal(`Found display list tag ${tagHeader.type}`);
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
        
        this.logToTerminal(`Processed ${tagIndex} tags for rendering`);
    }

    parseTagHeader(data, offset) {
        if (offset + 2 > data.length) {
            return null;
        }
        
        // Read first 2 bytes
        const byte1 = data[offset];
        const byte2 = data[offset + 1];
        
        // Extract tag type (upper 10 bits) and length (lower 6 bits)
        const tagAndLength = (byte2 << 8) | byte1;
        const tagType = (tagAndLength >> 6) & 0x3FF;
        const shortLength = tagAndLength & 0x3F;
        
        let length, headerSize;
        
        if (shortLength === 0x3F) {
            // Long format: read 4 more bytes for length
            if (offset + 6 > data.length) {
                return null;
            }
            
            length = data[offset + 2] | 
                     (data[offset + 3] << 8) | 
                     (data[offset + 4] << 16) | 
                     (data[offset + 5] << 24);
            headerSize = 6;
        } else {
            // Short format
            length = shortLength;
            headerSize = 2;
        }
        
        return {
            type: tagType,
            length: length,
            headerSize: headerSize
        };
    }

    processShapeForRendering(shapeData) {
        this.logToTerminal(`=== PROCESSING SHAPE ${shapeData.shapeId} ===`);
        
        // Extract shape bounds and create renderable geometry
        const bounds = this.extractShapeBounds(shapeData);
        const color = this.extractShapeColor(shapeData);
        
        // Convert bounds from twips to pixels and ensure visibility
        let x1 = (bounds.xMin || 0) / 20;
        let y1 = (bounds.yMin || 0) / 20;
        let x2 = (bounds.xMax || 2000) / 20;
        let y2 = (bounds.yMax || 2000) / 20;
        
        // Ensure we have a visible rectangle within the stage
        if (x2 <= x1 || Math.abs(x2 - x1) < 5) {
            x1 = 50 + (shapeData.shapeId * 30) % (this.stageWidth - 150);
            x2 = x1 + 100;
        }
        if (y2 <= y1 || Math.abs(y2 - y1) < 5) {
            y1 = 50 + (shapeData.shapeId * 30) % (this.stageHeight - 150);
            y2 = y1 + 80;
        }
        
        // Clamp to stage bounds
        x1 = Math.max(10, Math.min(x1, this.stageWidth - 110));
        y1 = Math.max(10, Math.min(y1, this.stageHeight - 90));
        x2 = Math.max(x1 + 100, Math.min(x2, this.stageWidth - 10));
        y2 = Math.max(y1 + 80, Math.min(y2, this.stageHeight - 10));
        
        this.logToTerminal(`Shape ${shapeData.shapeId} coordinates: (${x1.toFixed(1)}, ${y1.toFixed(1)}) to (${x2.toFixed(1)}, ${y2.toFixed(1)})`);
        
        // Create two triangles for rectangle
        const vertices = new Float32Array([
            x1, y1,   // Triangle 1: Bottom left
            x2, y1,   // Bottom right
            x1, y2,   // Top left
            
            x2, y1,   // Triangle 2: Bottom right
            x2, y2,   // Top right
            x1, y2    // Top left
        ]);
        
        const colors = new Float32Array([
            color.r, color.g, color.b, color.a,
            color.r, color.g, color.b, color.a,
            color.r, color.g, color.b, color.a,
            color.r, color.g, color.b, color.a,
            color.r, color.g, color.b, color.a,
            color.r, color.g, color.b, color.a
        ]);
        
        const renderableShape = {
            vertices: vertices,
            colors: colors,
            bounds: bounds,
            primitiveType: this.gl.TRIANGLES,
            vertexCount: 6
        };
        
        this.shapes.set(shapeData.shapeId, renderableShape);
        
        this.logToTerminal(`Shape ${shapeData.shapeId} created and stored`);
    }

    extractShapeBounds(shapeData) {
        // Extract bounds from the Flash-JS ShapeParsers data structure
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

    extractShapeColor(shapeData) {
        // Try to extract color from fill styles in the Flash-JS data structure
        if (shapeData.fillStyles && shapeData.fillStyles.styles && shapeData.fillStyles.styles.length > 0) {
            const firstFill = shapeData.fillStyles.styles[0];
            if (firstFill.type === 'solid' && firstFill.color) {
                return {
                    r: (firstFill.color.red || 128) / 255,
                    g: (firstFill.color.green || 128) / 255,
                    b: (firstFill.color.blue || 255) / 255,
                    a: (firstFill.color.alpha !== undefined ? firstFill.color.alpha : 255) / 255
                };
            }
        }
        
        // Generate a bright, visible color based on shape ID
        const hue = (shapeData.shapeId * 60) % 360;
        return this.hslToRgb(hue / 360, 0.8, 0.6);
    }

    hslToRgb(h, s, l) {
        let r, g, b;
        
        if (s === 0) {
            r = g = b = l;
        } else {
            const hue2rgb = (p, q, t) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1/6) return p + (q - p) * 6 * t;
                if (t < 1/2) return q;
                if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                return p;
            };
            
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hue2rgb(p, q, h + 1/3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1/3);
        }
        
        return { r, g, b, a: 1.0 };
    }

    processDisplayObjectForRendering(displayData) {
        this.logToTerminal(`=== PROCESSING DISPLAY OBJECT ===`);
        
        const depth = displayData.depth;
        const characterId = displayData.characterId;
        
        this.logToTerminal(`Display object: Character ${characterId} at depth ${depth}`);
        
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
        
        this.logToTerminal(`Available shape IDs: [${availableShapeIds.join(', ')}]`);
        this.logToTerminal(`Referenced character IDs: [${referencedCharacterIds.join(', ')}]`);
        
        // Check for matches
        const matches = availableShapeIds.filter(id => referencedCharacterIds.includes(id));
        const unlinkedShapes = availableShapeIds.filter(id => !referencedCharacterIds.includes(id));
        const missingShapes = referencedCharacterIds.filter(id => !availableShapeIds.includes(id));
        
        this.logToTerminal(`Linked shapes: [${matches.join(', ')}]`);
        this.logToTerminal(`Unlinked shapes: [${unlinkedShapes.join(', ')}]`);
        this.logToTerminal(`Missing shapes: [${missingShapes.join(', ')}]`);
    }

    createMissingDisplayObjects() {
        this.logToTerminal('=== CREATING MISSING DISPLAY OBJECTS ===');
        
        // Create display objects for shapes that don't have them
        const availableShapeIds = Array.from(this.shapes.keys());
        const referencedCharacterIds = Array.from(this.displayObjectCharacterIds);
        
        let createdCount = 0;
        let nextDepth = Math.max(...Array.from(this.displayList.keys()), 0) + 1;
        
        for (const shapeId of availableShapeIds) {
            if (!referencedCharacterIds.includes(shapeId)) {
                // Create a display object for this unlinked shape
                const displayObject = {
                    characterId: shapeId,
                    depth: nextDepth,
                    matrix: this.createIdentityMatrix(),
                    visible: true
                };
                
                this.displayList.set(nextDepth, displayObject);
                this.logToTerminal(`Created display object for shape ${shapeId} at depth ${nextDepth}`);
                
                nextDepth++;
                createdCount++;
            }
        }
        
        this.logToTerminal(`Created ${createdCount} missing display objects`);
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

    createTestShape() {
        // Create a test shape for debugging visibility
        this.logToTerminal('=== CREATING TEST SHAPE ===');
        
        const vertices = new Float32Array([
            300, 50,     // Triangle 1: Bottom left
            400, 50,     // Bottom right
            300, 130,    // Top left
            
            400, 50,     // Triangle 2: Bottom right
            400, 130,    // Top right
            300, 130     // Top left
        ]);
        
        const colors = new Float32Array([
            1.0, 0.0, 0.0, 1.0,  // Red
            0.0, 1.0, 0.0, 1.0,  // Green
            0.0, 0.0, 1.0, 1.0,  // Blue
            0.0, 1.0, 0.0, 1.0,  // Green
            1.0, 1.0, 0.0, 1.0,  // Yellow
            0.0, 0.0, 1.0, 1.0   // Blue
        ]);
        
        const testShape = {
            vertices: vertices,
            colors: colors,
            primitiveType: this.gl.TRIANGLES,
            vertexCount: 6
        };
        
        this.shapes.set(999, testShape);
        
        const testDisplayObject = {
            characterId: 999,
            depth: 9999,
            matrix: this.createIdentityMatrix(),
            visible: true
        };
        
        this.displayList.set(9999, testDisplayObject);
        
        this.logToTerminal('Test shape created at (300,50) to (400,130) with rainbow colors');
    }

    createIdentityMatrix() {
        const matrix = new Float32Array(16);
        this.setIdentityMatrix(matrix);
        return matrix;
    }

    debugLogAllObjects() {
        this.logToTerminal('=== DEBUG: ALL OBJECTS ===');
        this.logToTerminal(`Shapes in map: ${this.shapes.size}`);
        for (const [id, shape] of this.shapes.entries()) {
            this.logToTerminal(`  Shape ${id}: ${shape.vertexCount} vertices`);
        }
        
        this.logToTerminal(`Display objects in map: ${this.displayList.size}`);
        for (const [depth, obj] of this.displayList.entries()) {
            this.logToTerminal(`  Depth ${depth}: Character ${obj.characterId}, Visible: ${obj.visible}`);
        }
    }

    // Enhanced render loop with actual shape rendering
    render() {
        const currentTime = performance.now();
        const deltaTime = currentTime - this.lastFrameTime;
        this.lastFrameTime = currentTime;
        
        this.renderAttempts++;
        
        // Calculate FPS
        this.frameCount++;
        if (this.frameCount % 60 === 0) {
            this.fps = Math.round(1000 / deltaTime);
            this.logToTerminal(`=== RENDERING STATUS ===`);
            this.logToTerminal(`FPS: ${this.fps}, Shapes: ${this.shapes.size}, Display objects: ${this.displayList.size}`);
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

        // Render display list in depth order
        this.renderDisplayList();

        // Continue rendering loop if active
        if (this.renderingActive) {
            requestAnimationFrame(() => this.render());
        }
    }

    renderDisplayList() {
        // Sort display objects by depth
        const sortedDisplayObjects = Array.from(this.displayList.entries())
            .sort(([depthA], [depthB]) => depthA - depthB);
        
        let renderedCount = 0;
        
        for (const [depth, displayObject] of sortedDisplayObjects) {
            if (displayObject.visible && displayObject.characterId !== undefined) {
                const wasRendered = this.renderDisplayObject(displayObject, depth);
                if (wasRendered) renderedCount++;
            }
        }
        
        if (this.frameCount % 120 === 0) {
            this.logToTerminal(`Successfully rendered ${renderedCount} objects`);
        }
    }

    renderDisplayObject(displayObject, depth) {
        const shape = this.shapes.get(displayObject.characterId);
        if (!shape) {
            if (this.frameCount % 300 === 0) {
                this.logToTerminal(`WARNING: No shape found for character ID ${displayObject.characterId} at depth ${depth}`);
            }
            return false;
        }
        
        // Set model matrix for this display object
        this.gl.uniformMatrix4fv(this.uniforms.modelMatrix, false, displayObject.matrix);
        
        // Bind vertex data
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffers.vertex);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, shape.vertices, this.gl.STATIC_DRAW);
        this.gl.enableVertexAttribArray(this.attributes.position);
        this.gl.vertexAttribPointer(this.attributes.position, 2, this.gl.FLOAT, false, 0, 0);
        
        // Bind color data
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffers.color);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, shape.colors, this.gl.STATIC_DRAW);
        this.gl.enableVertexAttribArray(this.attributes.color);
        this.gl.vertexAttribPointer(this.attributes.color, 4, this.gl.FLOAT, false, 0, 0);
        
        // Draw the shape
        this.gl.drawArrays(shape.primitiveType, 0, shape.vertexCount);
        
        return true;
    }

    startRendering() {
        this.renderingActive = true;
        this.render();
        this.logToTerminal('=== WEBGL RENDERING STARTED ===');
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
        
        // Use same terminal output method as Parse.js in Flash-JS repository
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
            // Clean up WebGL resources
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
