/**
 * WebGL Flash Game Renderer for Flash-JS Repository
 * Integrates with Parse.js webpage terminal output for debugging
 * Optimized for big Flash games performance
 * PHASE 2: Shape rendering integration with Flash-JS ShapeParsers and DisplayParsers
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
        
        // Shape tessellation and rendering data
        this.renderableShapes = new Map(); // ID -> WebGL vertex data
        
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

            this.logToTerminal('WebGL Flash Renderer initialized successfully');
            
        } catch (error) {
            this.logToTerminal(`WebGL initialization failed: ${error.message}`);
            throw error;
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

    // PHASE 2: Integration with Flash-JS Parse.js output for shape rendering
    loadFromFlashJSData(signatureData, tagData) {
        this.logToTerminal('Loading Flash content from Flash-JS Parse.js output for rendering');

        try {
            // Process SWF signature data from parseSWFSignature
            if (signatureData) {
                this.setupViewportFromSignature(signatureData);
            }

            // Process tag data from parseSWFTags to extract shapes and display list
            if (tagData) {
                this.processFlashJSTagsForRendering(tagData);
            }

            this.logToTerminal(`Loaded ${this.shapes.size} shapes and ${this.displayList.size} display objects`);

        } catch (error) {
            this.logToTerminal(`Error loading Flash-JS parse data: ${error.message}`);
        }
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

    processFlashJSTagsForRendering(tagData) {
        this.logToTerminal('Processing Flash-JS tag data with ShapeParsers and DisplayParsers');
        
        // Parse the content mode output to get actual parsed shape data
        if (tagData.includes('Parsed Tag Content')) {
            this.parseContentModeData(tagData);
        } else {
            // Fallback: trigger content parsing mode to get shape data
            this.logToTerminal('Tag data not in content parsing mode - switch to "Show Parsed Content Only" to see shapes');
        }
    }

    parseContentModeData(tagData) {
        const lines = tagData.split('\n');
        let currentTag = null;
        let currentData = null;
        let isInContent = false;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Detect start of a tag
            if (line.match(/^Tag \d+:/)) {
                // Process previous tag if it exists
                if (currentTag && currentData) {
                    this.processTagData(currentTag, currentData);
                }
                
                // Start new tag
                currentTag = this.parseTagHeader(line);
                currentData = {};
                isInContent = false;
            }
            // Detect content section
            else if (line === 'Content:') {
                isInContent = true;
            }
            // Parse content data
            else if (isInContent && line.startsWith('  ')) {
                this.parseContentLine(line, currentData);
            }
        }
        
        // Process final tag
        if (currentTag && currentData) {
            this.processTagData(currentTag, currentData);
        }
    }

    parseTagHeader(line) {
        const tagMatch = line.match(/Tag (\d+): (.+)/);
        if (tagMatch) {
            return {
                index: parseInt(tagMatch[1]),
                type: tagMatch[2].trim()
            };
        }
        return null;
    }

    parseContentLine(line, data) {
        const cleanLine = line.replace(/^  /, '');
        
        if (cleanLine.includes(': ')) {
            const [key, value] = cleanLine.split(': ', 2);
            
            // Parse numeric values
            if (!isNaN(value)) {
                data[key] = parseFloat(value);
            } else {
                data[key] = value;
            }
        }
    }

    processTagData(tag, data) {
        // Process DefineShape tags
        if (tag.type.includes('DefineShape')) {
            this.processShapeDefinition(tag, data);
        }
        // Process PlaceObject tags
        else if (tag.type.includes('PlaceObject')) {
            this.processPlaceObject(tag, data);
        }
    }

    processShapeDefinition(tag, data) {
        if (!data.shapeId) return;
        
        this.logToTerminal(`Processing shape definition: ID ${data.shapeId} (${tag.type})`);
        
        // Create a renderable shape from the parsed data
        const renderableShape = this.createRenderableShape(data);
        this.shapes.set(data.shapeId, renderableShape);
        
        this.logToTerminal(`Created renderable shape ${data.shapeId} with ${renderableShape.vertices.length / 2} vertices`);
    }

    createRenderableShape(shapeData) {
        // For Phase 2, create simple colored rectangles based on shape bounds
        // This will be enhanced in Phase 3 with actual vector tessellation
        
        const bounds = this.parseShapeBounds(shapeData);
        const color = this.parseShapeColor(shapeData);
        
        // Create rectangle vertices from bounds (in twips, convert to pixels)
        const x1 = (bounds.xMin || 0) / 20;
        const y1 = (bounds.yMin || 0) / 20;
        const x2 = (bounds.xMax || 1000) / 20;
        const y2 = (bounds.yMax || 1000) / 20;
        
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
        
        return {
            vertices: vertices,
            colors: colors,
            bounds: bounds,
            primitiveType: this.gl.TRIANGLES,
            vertexCount: 6
        };
    }

    parseShapeBounds(shapeData) {
        // Try to extract bounds from various possible formats
        if (shapeData.boundsFormatted) {
            const match = shapeData.boundsFormatted.match(/\((-?\d+),\s*(-?\d+)\)\s*to\s*\((-?\d+),\s*(-?\d+)\)/);
            if (match) {
                return {
                    xMin: parseInt(match[1]),
                    yMin: parseInt(match[2]),
                    xMax: parseInt(match[3]),
                    yMax: parseInt(match[4])
                };
            }
        }
        
        // Default bounds for visibility
        return { xMin: 0, yMin: 0, xMax: 1000, yMax: 1000 };
    }

    parseShapeColor(shapeData) {
        // Try to extract color from fill styles
        // For Phase 2, use a default color or simple extraction
        return { r: 0.8, g: 0.2, b: 0.2, a: 1.0 }; // Default red
    }

    processPlaceObject(tag, data) {
        if (!data.depth) return;
        
        const depth = data.depth;
        const characterId = data.characterId;
        
        this.logToTerminal(`Processing display object: Character ${characterId} at depth ${depth}`);
        
        // Create display object
        const displayObject = {
            characterId: characterId,
            depth: depth,
            matrix: this.parseTransformMatrix(data),
            visible: true
        };
        
        this.displayList.set(depth, displayObject);
    }

    parseTransformMatrix(data) {
        // Parse transform matrix from Flash-JS DisplayParsers output
        // For Phase 2, use identity matrix or simple translation
        const matrix = new Float32Array(16);
        this.setIdentityMatrix(matrix);
        
        // Apply simple translation if available
        if (data.matrixFormatted && data.matrixFormatted.includes('Translate')) {
            const match = data.matrixFormatted.match(/Translate:\s*\(([^)]+)\)/);
            if (match) {
                const coords = match[1].split(',');
                if (coords.length >= 2) {
                    const tx = parseFloat(coords[0]) / 20; // Convert twips to pixels
                    const ty = parseFloat(coords[1]) / 20;
                    matrix[12] = tx;
                    matrix[13] = ty;
                }
            }
        }
        
        return matrix;
    }

    // PHASE 2: Enhanced render loop with actual shape rendering
    render() {
        const currentTime = performance.now();
        const deltaTime = currentTime - this.lastFrameTime;
        this.lastFrameTime = currentTime;
        
        // Calculate FPS
        this.frameCount++;
        if (this.frameCount % 60 === 0) {
            this.fps = Math.round(1000 / deltaTime);
            this.logToTerminal(`Rendering at ${this.fps} FPS with ${this.displayList.size} display objects`);
        }

        // Clear canvas
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        this.gl.clearColor(1.0, 1.0, 1.0, 1.0); // White background for visibility
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
            if (displayObject.visible && displayObject.characterId) {
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
