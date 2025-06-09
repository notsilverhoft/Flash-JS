/**
 * WebGL Flash Game Renderer for Flash-JS Repository
 * Integrates with Parse.js webpage terminal output for debugging
 * Optimized for big Flash games performance
 * PHASE 2: Direct integration with Flash-JS ShapeParsers and DisplayParsers objects
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
        this.parsedTags = [];
        
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
            this.gl.enable(this.gl.DEPTH_TEST);
            this.gl.depthFunc(this.gl.LEQUAL);

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
            }
            
            if (typeof DisplayParsers !== 'undefined') {
                this.displayParsers = new DisplayParsers();
                this.logToTerminal('DisplayParsers initialized for WebGL rendering');
            }
        } catch (error) {
            this.logToTerminal(`Parser initialization error: ${error.message}`);
        }
    }

    createShaderProgram() {
        // Vertex shader for sprite rendering
        const vertexShaderSource = `
            attribute vec2 a_position;
            attribute vec2 a_texCoord;
            attribute vec4 a_color;
            
            uniform mat4 u_projectionMatrix;
            uniform mat4 u_viewMatrix;
            uniform mat4 u_modelMatrix;
            
            varying vec2 v_texCoord;
            varying vec4 v_color;
            
            void main() {
                gl_Position = u_projectionMatrix * u_viewMatrix * u_modelMatrix * vec4(a_position, 0.0, 1.0);
                v_texCoord = a_texCoord;
                v_color = a_color;
            }
        `;

        // Fragment shader for sprite rendering
        const fragmentShaderSource = `
            precision mediump float;
            
            uniform sampler2D u_texture;
            uniform bool u_useTexture;
            
            varying vec2 v_texCoord;
            varying vec4 v_color;
            
            void main() {
                if (u_useTexture) {
                    gl_FragColor = texture2D(u_texture, v_texCoord) * v_color;
                } else {
                    gl_FragColor = v_color;
                }
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
        this.attributes.texCoord = this.gl.getAttribLocation(this.program, 'a_texCoord');
        this.attributes.color = this.gl.getAttribLocation(this.program, 'a_color');

        this.uniforms.projectionMatrix = this.gl.getUniformLocation(this.program, 'u_projectionMatrix');
        this.uniforms.viewMatrix = this.gl.getUniformLocation(this.program, 'u_viewMatrix');
        this.uniforms.modelMatrix = this.gl.getUniformLocation(this.program, 'u_modelMatrix');
        this.uniforms.texture = this.gl.getUniformLocation(this.program, 'u_texture');
        this.uniforms.useTexture = this.gl.getUniformLocation(this.program, 'u_useTexture');

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
        // Create vertex buffer for shapes (position + texCoord)
        this.buffers.vertex = this.gl.createBuffer();
        
        // Create color buffer
        this.buffers.color = this.gl.createBuffer();
        
        // Create index buffer for triangle rendering
        this.buffers.index = this.gl.createBuffer();

        this.logToTerminal('WebGL buffers created');
    }

    updateProjectionMatrix() {
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        // Create orthographic projection matrix for 2D Flash content
        this.setOrthographicMatrix(this.projectionMatrix, 0, width, height, 0, -1000, 1000);
        
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
        this.logToTerminal('Loading Flash content directly from SWF data via Flash-JS parsers');

        try {
            // Parse SWF signature data
            const signatureData = parseSWFSignature(arrayBuffer);
            this.setupViewportFromSignature(signatureData);

            // Parse tags directly using Flash-JS tag parsing pipeline
            this.parseTagsDirectly(arrayBuffer);

            this.logToTerminal(`Loaded ${this.shapes.size} shapes and ${this.displayList.size} display objects for rendering`);

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
        
        try {
            switch (signature) {
                case 'FWS':
                    // Calculate tag data offset for uncompressed files
                    const rect = parseRECT(bytes, 8);
                    const nbits = (bytes[8] >> 3) & 0x1F;
                    const rectBits = 5 + (4 * nbits);
                    const rectBytes = Math.ceil(rectBits / 8);
                    const tagOffset = 8 + rectBytes + 4; // +4 for frame rate and count
                    tagData = bytes.slice(tagOffset);
                    break;
                    
                case 'CWS':
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
                    this.logToTerminal('LZMA decompression not yet supported for direct rendering - use regular parsing mode');
                    return;
                    
                default:
                    this.logToTerminal(`Unknown SWF format: ${signature}`);
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
        
        this.logToTerminal('Parsing tags directly for WebGL rendering');
        
        while (offset < tagData.length && tagIndex < 1000) {
            const tagHeader = this.parseTagHeader(tagData, offset);
            
            if (!tagHeader) {
                this.logToTerminal(`Error parsing tag header at offset ${offset}`);
                break;
            }
            
            const contentOffset = offset + tagHeader.headerSize;
            
            // Process shape definition tags
            if ([2, 22, 32, 83].includes(tagHeader.type) && this.shapeParsers) {
                try {
                    const parsedShape = this.shapeParsers.parseTag(tagHeader.type, tagData, contentOffset, tagHeader.length);
                    if (parsedShape && parsedShape.data && parsedShape.data.shapeId !== undefined) {
                        this.processShapeForRendering(parsedShape.data);
                    }
                } catch (error) {
                    this.logToTerminal(`Error parsing shape tag ${tagHeader.type}: ${error.message}`);
                }
            }
            
            // Process display list tags
            if ([4, 26, 70].includes(tagHeader.type) && this.displayParsers) {
                try {
                    const parsedDisplay = this.displayParsers.parseTag(tagHeader.type, tagData, contentOffset, tagHeader.length);
                    if (parsedDisplay && parsedDisplay.data && parsedDisplay.data.depth !== undefined) {
                        this.processDisplayObjectForRendering(parsedDisplay.data);
                    }
                } catch (error) {
                    this.logToTerminal(`Error parsing display tag ${tagHeader.type}: ${error.message}`);
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
        if (!shapeData.shapeId) return;
        
        this.logToTerminal(`Processing shape for rendering: ID ${shapeData.shapeId}`);
        
        // Extract shape bounds and create renderable geometry
        const bounds = this.extractShapeBounds(shapeData);
        const color = this.extractShapeColor(shapeData);
        
        // Create rectangle vertices from bounds (convert twips to pixels)
        const x1 = (bounds.xMin || 0) / 20;
        const y1 = (bounds.yMin || 0) / 20;
        const x2 = (bounds.xMax || 1000) / 20;
        const y2 = (bounds.yMax || 1000) / 20;
        
        // Ensure we have a visible rectangle
        if (x2 <= x1) x2 = x1 + 50;
        if (y2 <= y1) y2 = y1 + 50;
        
        // Create two triangles for rectangle
        const vertices = new Float32Array([
            x1, y1,   // Bottom left
            x2, y1,   // Bottom right
            x1, y2,   // Top left
            x2, y1,   // Bottom right
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
        
        this.logToTerminal(`Created renderable shape ${shapeData.shapeId}: (${x1}, ${y1}) to (${x2}, ${y2})`);
    }

    extractShapeBounds(shapeData) {
        // Extract bounds from the Flash-JS ShapeParsers data structure
        if (shapeData.bounds) {
            return {
                xMin: shapeData.bounds.xMin || 0,
                yMin: shapeData.bounds.yMin || 0,
                xMax: shapeData.bounds.xMax || 1000,
                yMax: shapeData.bounds.yMax || 1000
            };
        }
        
        // Default bounds for visibility
        return { xMin: 100, yMin: 100, xMax: 400, yMax: 300 };
    }

    extractShapeColor(shapeData) {
        // Try to extract color from fill styles in the Flash-JS data structure
        if (shapeData.fillStyles && shapeData.fillStyles.styles && shapeData.fillStyles.styles.length > 0) {
            const firstFill = shapeData.fillStyles.styles[0];
            if (firstFill.type === 'solid' && firstFill.color) {
                return {
                    r: (firstFill.color.red || 0) / 255,
                    g: (firstFill.color.green || 0) / 255,
                    b: (firstFill.color.blue || 0) / 255,
                    a: (firstFill.color.alpha !== undefined ? firstFill.color.alpha : 255) / 255
                };
            }
        }
        
        // Generate a visible color based on shape ID
        const hue = (shapeData.shapeId * 137.5) % 360; // Golden angle for good distribution
        return this.hslToRgb(hue / 360, 0.7, 0.5);
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
        if (displayData.depth === undefined) return;
        
        const depth = displayData.depth;
        const characterId = displayData.characterId;
        
        this.logToTerminal(`Processing display object: Character ${characterId} at depth ${depth}`);
        
        // Create display object with transform matrix
        const displayObject = {
            characterId: characterId,
            depth: depth,
            matrix: this.extractTransformMatrix(displayData),
            visible: true
        };
        
        this.displayList.set(depth, displayObject);
    }

    extractTransformMatrix(displayData) {
        // Extract transform matrix from Flash-JS DisplayParsers data structure
        const matrix = new Float32Array(16);
        this.setIdentityMatrix(matrix);
        
        if (displayData.matrix) {
            const m = displayData.matrix;
            
            // Apply scale
            if (m.scaleX !== undefined) matrix[0] = m.scaleX;
            if (m.scaleY !== undefined) matrix[5] = m.scaleY;
            
            // Apply rotation/skew (simplified)
            if (m.rotateSkew0 !== undefined) matrix[1] = m.rotateSkew0;
            if (m.rotateSkew1 !== undefined) matrix[4] = m.rotateSkew1;
            
            // Apply translation (convert twips to pixels)
            if (m.translateX !== undefined) matrix[12] = m.translateX / 20;
            if (m.translateY !== undefined) matrix[13] = m.translateY / 20;
        }
        
        return matrix;
    }

    setupViewportFromSignature(signatureData) {
        // Parse signature data to extract stage dimensions
        const lines = signatureData.split('\n');
        for (const line of lines) {
            if (line.includes('Stage Dimensions:')) {
                const match = line.match(/(\d+)\s*×\s*(\d+)\s*pixels/);
                if (match) {
                    this.canvas.width = parseInt(match[1]);
                    this.canvas.height = parseInt(match[2]);
                    this.updateProjectionMatrix();
                    this.logToTerminal(`Viewport set to ${this.canvas.width}x${this.canvas.height} from Flash-JS signature data`);
                    break;
                }
            }
        }
    }

    // Enhanced render loop with actual shape rendering
    render() {
        const currentTime = performance.now();
        const deltaTime = currentTime - this.lastFrameTime;
        this.lastFrameTime = currentTime;
        
        // Calculate FPS
        this.frameCount++;
        if (this.frameCount % 60 === 0 && this.displayList.size > 0) {
            this.fps = Math.round(1000 / deltaTime);
            this.logToTerminal(`Rendering at ${this.fps} FPS with ${this.displayList.size} display objects`);
        }

        // Clear canvas
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        this.gl.clearColor(0.9, 0.9, 0.9, 1.0); // Light gray background for visibility
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);

        // Use shader program
        this.gl.useProgram(this.program);

        // Set uniforms
        this.gl.uniformMatrix4fv(this.uniforms.projectionMatrix, false, this.projectionMatrix);
        this.gl.uniformMatrix4fv(this.uniforms.viewMatrix, false, this.viewMatrix);
        this.gl.uniform1i(this.uniforms.useTexture, 0); // No textures for Phase 2

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
        
        for (const [depth, displayObject] of sortedDisplayObjects) {
            if (displayObject.visible && displayObject.characterId !== undefined) {
                this.renderDisplayObject(displayObject);
            }
        }
    }

    renderDisplayObject(displayObject) {
        const shape = this.shapes.get(displayObject.characterId);
        if (!shape) return;
        
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
        
        // Disable texture coordinates for Phase 2
        this.gl.disableVertexAttribArray(this.attributes.texCoord);
        
        // Draw the shape
        this.gl.drawArrays(shape.primitiveType, 0, shape.vertexCount);
    }

    startRendering() {
        this.renderingActive = true;
        this.render();
        this.logToTerminal('WebGL rendering started');
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
        const timestamp = new Date().toISOString();
        const logMessage = `[WebGL Renderer] ${message}`;
        
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
