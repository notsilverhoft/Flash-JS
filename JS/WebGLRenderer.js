/**
 * WebGL Flash Game Renderer for Flash-JS Repository
 * Integrates with Parse.js webpage terminal output for debugging
 * Optimized for big Flash games performance
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
        
        // Rendering state
        this.sprites = [];
        this.textures = new Map();
        this.projectionMatrix = new Float32Array(16);
        this.viewMatrix = new Float32Array(16);
        
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
        // Create vertex buffer for sprites (position + texCoord)
        this.buffers.vertex = this.gl.createBuffer();
        
        // Create color buffer
        this.buffers.color = this.gl.createBuffer();
        
        // Create index buffer for batched rendering
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

    // Integration point with Flash-JS Parse.js output
    loadFromFlashJSData(signatureData, tagData) {
        this.logToTerminal('Loading Flash content from Flash-JS Parse.js output');

        try {
            // Process SWF signature data from parseSWFSignature
            if (signatureData) {
                this.setupViewportFromSignature(signatureData);
            }

            // Process tag data from parseSWFTags  
            if (tagData) {
                this.processFlashJSTags(tagData);
            }

            this.logToTerminal(`Loaded ${this.sprites.length} sprites from Flash-JS parse data`);

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

    processFlashJSTags(tagData) {
        // Process Flash-JS parsed tag output
        this.logToTerminal('Processing Flash-JS tag data for rendering');
        
        // For now, create placeholder sprite data based on tag information
        // This will be enhanced in Phase 2 with actual tag parsing integration
        const lines = tagData.split('\n');
        let tagCount = 0;
        
        for (const line of lines) {
            if (line.includes('Tag ') && line.includes('Type ')) {
                // Extract tag type information
                const typeMatch = line.match(/Type (\d+)/);
                const nameMatch = line.match(/\(([^)]+)\)/);
                
                if (typeMatch && nameMatch) {
                    const tagType = parseInt(typeMatch[1]);
                    const tagName = nameMatch[1];
                    
                    // Create placeholder sprite for renderable tags
                    if (this.isRenderableTag(tagType)) {
                        const sprite = {
                            id: tagCount,
                            type: tagName,
                            tagType: tagType,
                            vertices: [],
                            colors: [],
                            texture: null
                        };
                        
                        this.sprites.push(sprite);
                        tagCount++;
                    }
                }
            }
        }
        
        this.logToTerminal(`Created ${tagCount} placeholder sprites from Flash-JS tag data`);
    }

    isRenderableTag(tagType) {
        // Define which tags are potentially renderable
        const renderableTags = new Set([
            2, 22, 32, 83,    // DefineShape tags
            6, 20, 21, 35, 36, // Bitmap tags
            4, 26, 70,        // PlaceObject tags
            39                // DefineSprite
        ]);
        
        return renderableTags.has(tagType);
    }

    // Basic render loop
    render() {
        const currentTime = performance.now();
        const deltaTime = currentTime - this.lastFrameTime;
        this.lastFrameTime = currentTime;
        
        // Calculate FPS
        this.frameCount++;
        if (this.frameCount % 60 === 0) {
            this.fps = Math.round(1000 / deltaTime);
            this.logToTerminal(`Rendering at ${this.fps} FPS`);
        }

        // Clear canvas
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        this.gl.clearColor(0.0, 0.0, 0.0, 1.0);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);

        // Use shader program
        this.gl.useProgram(this.program);

        // Set uniforms
        this.gl.uniformMatrix4fv(this.uniforms.projectionMatrix, false, this.projectionMatrix);
        this.gl.uniformMatrix4fv(this.uniforms.viewMatrix, false, this.viewMatrix);

        // Render sprites (basic implementation for now)
        this.renderSprites();

        // Continue rendering loop if active
        if (this.renderingActive) {
            requestAnimationFrame(() => this.render());
        }
    }

    renderSprites() {
        // Basic sprite rendering - will be enhanced in sprite system phase
        this.sprites.forEach(sprite => {
            this.renderSprite(sprite);
        });
    }

    renderSprite(sprite) {
        // Placeholder sprite rendering
        // Full implementation in next phase
        const modelMatrix = new Float32Array(16);
        this.setIdentityMatrix(modelMatrix);
        
        this.gl.uniformMatrix4fv(this.uniforms.modelMatrix, false, modelMatrix);
        this.gl.uniform1i(this.uniforms.useTexture, 0);
        
        // Actual rendering will be implemented in sprite system phase
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
        this.sprites = [];
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
