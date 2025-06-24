/* 
 * WebGL SWF Renderer - v1.3
 * Final stage of the Flash-JS rendering pipeline
 * Takes pre-processed data from translators and renders to WebGL canvas
 * Only works with translated data - no parsing or translation logic
 * Handles shapes, display lists, transformations, and advanced features
 * SIMPLIFIED: Removed complex button management - button simply starts WebGL rendering
 * FIXED: Button unlocks when SWF is uploaded and translated data is available
 */
class WebGLRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = null;
    this.shaderProgram = null;
    this.buffers = {};
    this.textures = new Map();
    this.renderCommands = [];
    this.displayList = new Map();
    this.currentTransform = this.createIdentityMatrix();
    this.isInitialized = false;
    this.output = [];
    
    // Simplified rendering pipeline
    this.autoRenderEnabled = true;
    this.translatedDataQueue = [];
    this.renderingInProgress = false;
    this.totalTranslatedItems = 0;
    
    // Simplified UI update handling
    this.pendingUIUpdates = [];
    this.uiUpdateCallback = null;
    this.uiReadyCheckCount = 0;
    this.maxUIReadyChecks = 50;
    
    // WebGL state
    this.vertexBuffer = null;
    this.indexBuffer = null;
    this.colorBuffer = null;
    this.textureCoordBuffer = null;
    
    // Shape cache for performance
    this.shapeCache = new Map();
    this.pathCache = new Map();
    
    this.init();
  }

  // ==================== INITIALIZATION ====================

  init() {
    try {
      this.output.push("WebGL Renderer Initialization:");
      this.output.push("==============================");
      
      // Initialize WebGL context
      this.gl = this.canvas.getContext('webgl') || this.canvas.getContext('experimental-webgl');
      
      if (!this.gl) {
        throw new Error("WebGL not supported");
      }
      
      this.output.push("WebGL context created successfully");
      
      // Initialize shaders
      this.initShaders();
      this.output.push("Shaders compiled and linked");
      
      // Initialize buffers
      this.initBuffers();
      this.output.push("Buffers initialized");
      
      // Set initial WebGL state
      this.setupWebGLState();
      this.output.push("WebGL state configured");
      
      // Clear canvas
      this.clear();
      
      this.isInitialized = true;
      this.output.push("WebGL renderer ready");
      this.output.push("Waiting for SWF file upload...");
      
      // Simple auto-consumption setup
      this.setupDataConsumption();
      
      // Start UI ready checking
      this.startUIReadyCheck();
      
    } catch (error) {
      this.output.push(`Initialization failed: ${error.message}`);
      this.isInitialized = false;
    }
  }

  setupDataConsumption() {
    // Simple data consumption - just count translated items
    if (typeof window.storeTranslatedData !== 'function') {
      window.storeTranslatedData = (translatedData) => {
        if (!window.translatedDataStorage) {
          window.translatedDataStorage = {};
        }
        
        const timestamp = Date.now();
        window.translatedDataStorage[timestamp] = translatedData;
        
        // Simple counting and button update
        this.totalTranslatedItems++;
        this.updateButtonState();
        this.requestUIUpdate();
      };
      
      this.output.push("Data consumption pipeline ready");
    }
  }

  // ==================== SIMPLIFIED UI HANDLING ====================

  startUIReadyCheck() {
    this.checkUIReady();
  }

  checkUIReady() {
    this.uiReadyCheckCount++;
    
    if (typeof updateCanvasInfo === 'function') {
      this.setUIUpdateCallback(updateCanvasInfo);
      return true;
    } else if (typeof window.updateCanvasInfo === 'function') {
      this.setUIUpdateCallback(window.updateCanvasInfo);
      return true;
    }
    
    if (this.uiReadyCheckCount < this.maxUIReadyChecks) {
      setTimeout(() => this.checkUIReady(), 100);
      return false;
    } else {
      this.output.push("UI callback timeout - will queue updates");
      return false;
    }
  }

  requestUIUpdate() {
    if (this.uiUpdateCallback && typeof this.uiUpdateCallback === 'function') {
      try {
        this.uiUpdateCallback();
      } catch (error) {
        this.output.push(`UI update error: ${error.message}`);
      }
    } else if (typeof updateCanvasInfo === 'function') {
      try {
        updateCanvasInfo();
      } catch (error) {
        this.output.push(`Direct UI update error: ${error.message}`);
      }
    } else if (typeof window.updateCanvasInfo === 'function') {
      try {
        window.updateCanvasInfo();
      } catch (error) {
        this.output.push(`Window UI update error: ${error.message}`);
      }
    } else {
      this.pendingUIUpdates.push(Date.now());
    }
  }

  setUIUpdateCallback(callback) {
    this.uiUpdateCallback = callback;
    
    if (this.pendingUIUpdates.length > 0) {
      this.pendingUIUpdates = [];
      try {
        callback();
      } catch (error) {
        this.output.push(`UI callback error: ${error.message}`);
      }
    }
    
    // Update button state when UI is ready
    this.updateButtonState();
  }

  // ==================== SIMPLIFIED BUTTON MANAGEMENT ====================

  updateButtonState() {
    const renderButton = document.getElementById('renderButton');
    if (!renderButton) return;
    
    // Simple logic: enable button when we have translated data
    if (window.translatedDataStorage && Object.keys(window.translatedDataStorage).length > 0) {
      renderButton.disabled = false;
      renderButton.textContent = `Start WebGL Rendering`;
      renderButton.style.backgroundColor = '#28a745';
      this.output.push("Render button enabled - translated data available");
    } else {
      renderButton.disabled = true;
      renderButton.textContent = 'No Translated Data';
      renderButton.style.backgroundColor = '#6c757d';
    }
  }

  // Called when new SWF is uploaded
  resetForNewSWF() {
    this.totalTranslatedItems = 0;
    this.translatedDataQueue = [];
    this.displayList.clear();
    this.shapeCache.clear();
    this.pathCache.clear();
    
    // Reset button to disabled state
    const renderButton = document.getElementById('renderButton');
    if (renderButton) {
      renderButton.disabled = true;
      renderButton.textContent = 'No Translated Data';
      renderButton.style.backgroundColor = '#6c757d';
    }
    
    this.output.push("Renderer reset for new SWF file");
    this.clear();
  }

  // Called when SWF is uploaded (from index.html)
  onSWFUploaded() {
    this.output.push("SWF file uploaded - waiting for translation...");
    // Button will be enabled automatically when translated data arrives
  }

  initShaders() {
    const vertexShaderSource = `
      attribute vec2 a_position;
      attribute vec4 a_color;
      attribute vec2 a_texCoord;
      
      uniform mat3 u_transform;
      uniform vec2 u_resolution;
      
      varying vec4 v_color;
      varying vec2 v_texCoord;
      
      void main() {
        // Apply transformation matrix
        vec3 position = u_transform * vec3(a_position, 1.0);
        
        // Convert from pixels to clip space
        vec2 clipSpace = ((position.xy / u_resolution) * 2.0) - 1.0;
        gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
        
        v_color = a_color;
        v_texCoord = a_texCoord;
      }
    `;

    const fragmentShaderSource = `
      precision mediump float;
      
      uniform sampler2D u_texture;
      uniform bool u_useTexture;
      uniform vec4 u_colorMultiplier;
      uniform vec4 u_colorOffset;
      
      varying vec4 v_color;
      varying vec2 v_texCoord;
      
      void main() {
        vec4 color;
        
        if (u_useTexture) {
          color = texture2D(u_texture, v_texCoord);
        } else {
          color = v_color;
        }
        
        // Apply color transform
        color = (color * u_colorMultiplier) + u_colorOffset;
        
        gl_FragColor = color;
      }
    `;

    const vertexShader = this.compileShader(vertexShaderSource, this.gl.VERTEX_SHADER);
    const fragmentShader = this.compileShader(fragmentShaderSource, this.gl.FRAGMENT_SHADER);
    
    this.shaderProgram = this.gl.createProgram();
    this.gl.attachShader(this.shaderProgram, vertexShader);
    this.gl.attachShader(this.shaderProgram, fragmentShader);
    this.gl.linkProgram(this.shaderProgram);
    
    if (!this.gl.getProgramParameter(this.shaderProgram, this.gl.LINK_STATUS)) {
      throw new Error('Shader program linking failed: ' + this.gl.getProgramInfoLog(this.shaderProgram));
    }
    
    // Get attribute and uniform locations
    this.shaderLocations = {
      position: this.gl.getAttribLocation(this.shaderProgram, 'a_position'),
      color: this.gl.getAttribLocation(this.shaderProgram, 'a_color'),
      texCoord: this.gl.getAttribLocation(this.shaderProgram, 'a_texCoord'),
      transform: this.gl.getUniformLocation(this.shaderProgram, 'u_transform'),
      resolution: this.gl.getUniformLocation(this.shaderProgram, 'u_resolution'),
      texture: this.gl.getUniformLocation(this.shaderProgram, 'u_texture'),
      useTexture: this.gl.getUniformLocation(this.shaderProgram, 'u_useTexture'),
      colorMultiplier: this.gl.getUniformLocation(this.shaderProgram, 'u_colorMultiplier'),
      colorOffset: this.gl.getUniformLocation(this.shaderProgram, 'u_colorOffset')
    };
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

  initBuffers() {
    this.vertexBuffer = this.gl.createBuffer();
    this.indexBuffer = this.gl.createBuffer();
    this.colorBuffer = this.gl.createBuffer();
    this.textureCoordBuffer = this.gl.createBuffer();
  }

  setupWebGLState() {
    this.gl.useProgram(this.shaderProgram);
    
    // Enable blending for transparency
    this.gl.enable(this.gl.BLEND);
    this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
    
    // Set viewport
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    
    // Set resolution uniform
    this.gl.uniform2f(this.shaderLocations.resolution, this.canvas.width, this.canvas.height);
    
    // Set default color transform (identity)
    this.gl.uniform4f(this.shaderLocations.colorMultiplier, 1.0, 1.0, 1.0, 1.0);
    this.gl.uniform4f(this.shaderLocations.colorOffset, 0.0, 0.0, 0.0, 0.0);
  }

  // ==================== MAIN RENDERING ENTRY POINT ====================

  startRendering() {
    try {
      this.output.push("WebGL Rendering Started:");
      this.output.push("========================");
      
      if (!this.isInitialized) {
        this.output.push("Error: Renderer not initialized");
        return false;
      }
      
      if (!window.translatedDataStorage || Object.keys(window.translatedDataStorage).length === 0) {
        this.output.push("Error: No translated data available");
        return false;
      }
      
      this.output.push("Rendering all translated data...");
      
      // Clear previous frame
      this.clear();
      
      // Render all stored data
      let renderedCount = 0;
      for (const [timestamp, data] of Object.entries(window.translatedDataStorage)) {
        if (this.renderSingleItem(data, timestamp)) {
          renderedCount++;
        }
      }
      
      this.output.push(`Successfully rendered ${renderedCount} items`);
      return renderedCount > 0;
      
    } catch (error) {
      this.output.push(`Rendering error: ${error.message}`);
      return false;
    }
  }

  renderSingleItem(translatedData, timestamp = null) {
    try {
      const prefix = timestamp ? `[${timestamp}] ` : "";
      this.output.push(`${prefix}Rendering: ${translatedData.tagType || 'Unknown type'}`);
      
      // Process different types of translated data
      if (translatedData.renderCommands) {
        this.processRenderCommands(translatedData.renderCommands);
      }
      
      if (translatedData.displayListState) {
        this.updateDisplayList(translatedData.displayListState);
      }
      
      return true;
      
    } catch (error) {
      this.output.push(`Error rendering item: ${error.message}`);
      return false;
    }
  }

  processRenderCommands(commands) {
    this.output.push(`Processing ${commands.length} render commands`);
    
    commands.forEach((command, index) => {
      switch (command.type) {
        case "setup_shape":
          this.setupShape(command);
          break;
          
        case "setup_solid_fill":
          this.setupSolidFill(command);
          break;
          
        case "setup_texture":
          this.setupTexture(command);
          break;
          
        case "setup_line_style":
          this.setupLineStyle(command);
          break;
          
        case "draw_path":
          this.drawPath(command);
          break;
          
        case "place_object":
          this.placeObject(command);
          break;
          
        case "remove_object":
          this.removeObject(command);
          break;
          
        case "setup_advanced_rendering":
          this.setupAdvancedRendering(command);
          break;
          
        default:
          this.output.push(`Warning: Unknown render command type: ${command.type}`);
          break;
      }
    });
  }

  // ==================== RENDER COMMAND HANDLERS ====================

  setupShape(command) {
    const shapeId = command.shapeId;
    const bounds = command.bounds;
    
    // Cache shape setup for performance
    this.shapeCache.set(shapeId, {
      bounds: bounds,
      hasTransparency: command.hasTransparency,
      setupTime: Date.now()
    });
    
    this.output.push(`Shape ${shapeId} setup: ${bounds.width}×${bounds.height}px`);
  }

  setupSolidFill(command) {
    const styleIndex = command.styleIndex;
    const color = command.color;
    
    // Store fill style for use in drawing operations
    if (!this.fillStyles) this.fillStyles = new Map();
    this.fillStyles.set(styleIndex, {
      type: "solid",
      color: color
    });
    
    this.output.push(`Solid fill ${styleIndex}: rgba(${(color[0]*255).toFixed(0)}, ${(color[1]*255).toFixed(0)}, ${(color[2]*255).toFixed(0)}, ${color[3].toFixed(2)})`);
  }

  setupTexture(command) {
    const styleIndex = command.styleIndex;
    const textureType = command.textureType;
    
    // For now, create a simple procedural texture based on type
    const texture = this.createProceduralTexture(textureType, command.gradient);
    
    if (!this.fillStyles) this.fillStyles = new Map();
    this.fillStyles.set(styleIndex, {
      type: "texture",
      texture: texture,
      textureType: textureType
    });
    
    this.output.push(`Texture fill ${styleIndex}: ${textureType}`);
  }

  setupLineStyle(command) {
    const styleIndex = command.styleIndex;
    
    if (!this.lineStyles) this.lineStyles = new Map();
    this.lineStyles.set(styleIndex, {
      width: command.width,
      color: command.color,
      caps: command.caps,
      joins: command.joins,
      miterLimit: command.miterLimit
    });
    
    this.output.push(`Line style ${styleIndex}: ${command.width}px, ${command.caps} caps`);
  }

  drawPath(command) {
    const path = command.path;
    const fillStyle0 = command.fillStyle0;
    const fillStyle1 = command.fillStyle1;
    const lineStyle = command.lineStyle;
    
    // Convert path commands to WebGL vertices
    const vertices = this.pathCommandsToVertices(path);
    
    if (vertices.length === 0) {
      return;
    }
    
    // Draw fill if present
    if (fillStyle0 > 0 && this.fillStyles && this.fillStyles.has(fillStyle0)) {
      this.drawFill(vertices, this.fillStyles.get(fillStyle0));
    }
    
    // Draw stroke if present
    if (lineStyle > 0 && this.lineStyles && this.lineStyles.has(lineStyle)) {
      this.drawStroke(vertices, this.lineStyles.get(lineStyle));
    }
    
    this.output.push(`Path drawn: ${vertices.length/2} vertices, fill: ${fillStyle0}, stroke: ${lineStyle}`);
  }

  placeObject(command) {
    const depth = command.depth;
    const characterId = command.characterId;
    const transform = command.transform;
    
    // Store object in display list
    this.displayList.set(depth, {
      characterId: characterId,
      transform: transform,
      visible: command.visible !== false,
      blendMode: command.blendMode,
      filters: command.filters,
      operation: command.operation
    });
    
    this.output.push(`Object placed: Character ${characterId} at depth ${depth} (${command.operation})`);
  }

  removeObject(command) {
    const depth = command.depth;
    
    if (this.displayList.has(depth)) {
      this.displayList.delete(depth);
      this.output.push(`Object removed from depth ${depth}`);
    }
  }

  setupAdvancedRendering(command) {
    const depth = command.depth;
    const complexity = command.complexity;
    const features = command.features;
    
    // Advanced rendering features would be implemented here
    // For now, just log the setup
    this.output.push(`Advanced rendering setup for depth ${depth}: ${complexity}`);
    
    if (features.hasFilters) {
      this.output.push("  • Filters enabled");
    }
    if (features.hasBlending) {
      this.output.push("  • Custom blending enabled");
    }
    if (features.hasCaching) {
      this.output.push("  • Bitmap caching enabled");
    }
  }

  // ==================== PATH RENDERING ====================

  pathCommandsToVertices(pathCommands) {
    const vertices = [];
    let currentX = 0;
    let currentY = 0;
    
    pathCommands.forEach(command => {
      switch (command.type) {
        case "move_to":
          currentX = command.position.x;
          currentY = command.position.y;
          break;
          
        case "line_to":
          // Add line as two triangles for WebGL
          vertices.push(currentX, currentY);
          vertices.push(command.endPosition.x, command.endPosition.y);
          currentX = command.endPosition.x;
          currentY = command.endPosition.y;
          break;
          
        case "curve_to":
          // Approximate curve with line segments
          const steps = 10;
          for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            const x = this.quadraticBezier(currentX, command.controlPoint.x, command.endPosition.x, t);
            const y = this.quadraticBezier(currentY, command.controlPoint.y, command.endPosition.y, t);
            vertices.push(x, y);
          }
          currentX = command.endPosition.x;
          currentY = command.endPosition.y;
          break;
      }
    });
    
    return vertices;
  }

  quadraticBezier(p0, p1, p2, t) {
    const invT = 1 - t;
    return invT * invT * p0 + 2 * invT * t * p1 + t * t * p2;
  }

  drawFill(vertices, fillStyle) {
    if (vertices.length < 6) return; // Need at least a triangle
    
    // Triangulate the vertices for filling
    const triangulatedVertices = this.triangulateVertices(vertices);
    
    if (fillStyle.type === "solid") {
      this.drawSolidFill(triangulatedVertices, fillStyle.color);
    } else if (fillStyle.type === "texture") {
      this.drawTextureFill(triangulatedVertices, fillStyle.texture);
    }
  }

  drawStroke(vertices, lineStyle) {
    if (vertices.length < 4) return; // Need at least a line
    
    // Convert path to stroke geometry
    const strokeVertices = this.createStrokeGeometry(vertices, lineStyle.width);
    this.drawSolidFill(strokeVertices, lineStyle.color);
  }

  triangulateVertices(vertices) {
    // Simple fan triangulation for convex shapes
    if (vertices.length < 6) return vertices;
    
    const triangulated = [];
    const centerX = vertices.reduce((sum, v, i) => i % 2 === 0 ? sum + v : sum, 0) / (vertices.length / 2);
    const centerY = vertices.reduce((sum, v, i) => i % 2 === 1 ? sum + v : sum, 0) / (vertices.length / 2);
    
    for (let i = 0; i < vertices.length - 2; i += 2) {
      triangulated.push(
        centerX, centerY,
        vertices[i], vertices[i + 1],
        vertices[i + 2], vertices[i + 3]
      );
    }
    
    return triangulated;
  }

  createStrokeGeometry(vertices, width) {
    const strokeVertices = [];
    const halfWidth = width / 2;
    
    for (let i = 0; i < vertices.length - 2; i += 2) {
      const x1 = vertices[i];
      const y1 = vertices[i + 1];
      const x2 = vertices[i + 2];
      const y2 = vertices[i + 3];
      
      // Calculate perpendicular vector
      const dx = x2 - x1;
      const dy = y2 - y1;
      const length = Math.sqrt(dx * dx + dy * dy);
      
      if (length > 0) {
        const nx = -dy / length * halfWidth;
        const ny = dx / length * halfWidth;
        
        // Create rectangle for line segment
        strokeVertices.push(
          x1 + nx, y1 + ny,
          x1 - nx, y1 - ny,
          x2 - nx, y2 - ny,
          x1 + nx, y1 + ny,
          x2 - nx, y2 - ny,
          x2 + nx, y2 + ny
        );
      }
    }
    
    return strokeVertices;
  }

  drawSolidFill(vertices, color) {
    if (vertices.length === 0) return;
    
    // Upload vertex data
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(vertices), this.gl.DYNAMIC_DRAW);
    
    // Create color data
    const colors = [];
    for (let i = 0; i < vertices.length / 2; i++) {
      colors.push(color[0], color[1], color[2], color[3]);
    }
    
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.colorBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(colors), this.gl.DYNAMIC_DRAW);
    
    // Set up attributes
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);
    this.gl.enableVertexAttribArray(this.shaderLocations.position);
    this.gl.vertexAttribPointer(this.shaderLocations.position, 2, this.gl.FLOAT, false, 0, 0);
    
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.colorBuffer);
    this.gl.enableVertexAttribArray(this.shaderLocations.color);
    this.gl.vertexAttribPointer(this.shaderLocations.color, 4, this.gl.FLOAT, false, 0, 0);
    
    // Disable texture
    this.gl.uniform1i(this.shaderLocations.useTexture, false);
    
    // Set transformation matrix
    this.gl.uniformMatrix3fv(this.shaderLocations.transform, false, this.currentTransform);
    
    // Draw
    this.gl.drawArrays(this.gl.TRIANGLES, 0, vertices.length / 2);
  }

  drawTextureFill(vertices, texture) {
    // Texture rendering would be implemented here
    // For now, fall back to solid color
    this.drawSolidFill(vertices, [0.5, 0.5, 0.5, 1.0]);
  }

  // ==================== TEXTURE MANAGEMENT ====================

  createProceduralTexture(textureType, gradientData) {
    const size = 256;
    const texture = this.gl.createTexture();
    const data = new Uint8Array(size * size * 4);
    
    switch (textureType) {
      case "linear_gradient":
        this.generateLinearGradientTexture(data, size, gradientData);
        break;
      case "radial_gradient":
        this.generateRadialGradientTexture(data, size, gradientData);
        break;
      default:
        // Solid color fallback
        for (let i = 0; i < data.length; i += 4) {
          data[i] = 128;     // R
          data[i + 1] = 128; // G
          data[i + 2] = 128; // B
          data[i + 3] = 255; // A
        }
        break;
    }
    
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, size, size, 0, this.gl.RGBA, this.gl.UNSIGNED_BYTE, data);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
    
    return texture;
  }

  generateLinearGradientTexture(data, size, gradientData) {
    if (!gradientData || !gradientData.colors || gradientData.colors.length === 0) {
      return; // Use default solid color
    }
    
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const t = x / (size - 1);
        const color = this.interpolateGradient(t, gradientData);
        const index = (y * size + x) * 4;
        
        data[index] = color[0] * 255;
        data[index + 1] = color[1] * 255;
        data[index + 2] = color[2] * 255;
        data[index + 3] = color[3] * 255;
      }
    }
  }

  generateRadialGradientTexture(data, size, gradientData) {
    if (!gradientData || !gradientData.colors || gradientData.colors.length === 0) {
      return; // Use default solid color
    }
    
    const centerX = size / 2;
    const centerY = size / 2;
    const maxRadius = size / 2;
    
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x - centerX;
        const dy = y - centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const t = Math.min(distance / maxRadius, 1.0);
        
        const color = this.interpolateGradient(t, gradientData);
        const index = (y * size + x) * 4;
        
        data[index] = color[0] * 255;
        data[index + 1] = color[1] * 255;
        data[index + 2] = color[2] * 255;
        data[index + 3] = color[3] * 255;
      }
    }
  }

  interpolateGradient(t, gradientData) {
    if (!gradientData.colors || gradientData.colors.length === 0) {
      return [0.5, 0.5, 0.5, 1.0];
    }
    
    if (gradientData.colors.length === 1) {
      return gradientData.colors[0];
    }
    
    // Find the two colors to interpolate between
    const numColors = gradientData.colors.length;
    const segment = t * (numColors - 1);
    const index = Math.floor(segment);
    const localT = segment - index;
    
    if (index >= numColors - 1) {
      return gradientData.colors[numColors - 1];
    }
    
    const color1 = gradientData.colors[index];
    const color2 = gradientData.colors[index + 1];
    
    return [
      color1[0] * (1 - localT) + color2[0] * localT,
      color1[1] * (1 - localT) + color2[1] * localT,
      color1[2] * (1 - localT) + color2[2] * localT,
      color1[3] * (1 - localT) + color2[3] * localT
    ];
  }

  // ==================== UTILITY METHODS ====================

  updateDisplayList(displayListState) {
    if (!displayListState || !Array.isArray(displayListState)) {
      return;
    }
    
    this.output.push(`Display list updated: ${displayListState.length} objects`);
    
    // Sort by depth for proper rendering order
    displayListState.sort((a, b) => a.depth - b.depth);
    
    // Update internal display list
    displayListState.forEach(object => {
      this.displayList.set(object.depth, object);
    });
  }

  clear() {
    this.gl.clearColor(1.0, 1.0, 1.0, 1.0); // White background
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
  }

  resize(width, height) {
    this.canvas.width = width;
    this.canvas.height = height;
    this.gl.viewport(0, 0, width, height);
    this.gl.uniform2f(this.shaderLocations.resolution, width, height);
    this.output.push(`Canvas resized to ${width}×${height}`);
  }

  createIdentityMatrix() {
    return [
      1, 0, 0,
      0, 1, 0,
      0, 0, 1
    ];
  }

  setTransform(matrix) {
    if (matrix && matrix.webglMatrix) {
      this.currentTransform = matrix.webglMatrix;
    } else {
      this.currentTransform = this.createIdentityMatrix();
    }
  }

  // ==================== DEBUG AND OUTPUT ====================

  getDebugOutput() {
    return this.output.join('\n');
  }

  getPerformanceStats() {
    return {
      isInitialized: this.isInitialized,
      shapeCacheSize: this.shapeCache.size,
      pathCacheSize: this.pathCache.size,
      displayListSize: this.displayList.size,
      textureCount: this.textures.size,
      canvasSize: `${this.canvas.width}×${this.canvas.height}`,
      autoRenderEnabled: this.autoRenderEnabled,
      totalTranslatedItems: this.totalTranslatedItems,
      queuedItems: this.translatedDataQueue.length,
      pendingUIUpdates: this.pendingUIUpdates.length,
      uiCallbackReady: this.uiUpdateCallback !== null,
      uiReadyCheckCount: this.uiReadyCheckCount
    };
  }

  // ==================== PUBLIC API ====================

  // Main rendering method - simplified to just start rendering
  render() {
    return this.startRendering();
  }

  // Get current status
  isReady() {
    return this.isInitialized;
  }

  // Get rendering output for debugging
  getOutput() {
    return this.getDebugOutput();
  }

  // Get performance information
  getStats() {
    return this.getPerformanceStats();
  }

  // Reset for new SWF (public method)
  reset() {
    this.resetForNewSWF();
  }
}

// Ensure WebGLRenderer is available globally before any initialization
window.WebGLRenderer = WebGLRenderer;

// Export for use by rendering pipeline
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WebGLRenderer;
}
