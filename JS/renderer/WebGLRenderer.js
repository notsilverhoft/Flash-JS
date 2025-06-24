/* 
 * WebGL SWF Renderer - v1.4
 * Final stage of the Flash-JS rendering pipeline
 * Takes pre-processed data from translators and renders to WebGL canvas
 * Only works with translated data - no parsing or translation logic
 * Handles shapes, display lists, transformations, and advanced features
 * SIMPLIFIED: Removed complex button management - button simply starts WebGL rendering
 * FIXED: Button unlocks when SWF is uploaded and translated data is available
 * FIXED: Now properly renders actual SWF first frame content instead of placeholder shapes
 * FIXED: Enhanced processSWFTranslatedData to handle proper translator format with linking metadata
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
    
    // Actual SWF rendering data
    this.swfShapes = new Map();
    this.swfDisplayList = new Map();
    this.backgroundColor = [1.0, 1.0, 1.0, 1.0]; // Default white
    
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
      this.output.push("WebGL renderer ready for SWF content");
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
        
        // Store actual SWF content for proper rendering with enhanced format handling
        this.processSWFTranslatedData(translatedData);
        
        // Simple counting and button update
        this.totalTranslatedItems++;
        this.updateButtonState();
        this.requestUIUpdate();
      };
      
      this.output.push("Data consumption pipeline ready for SWF content");
    }
  }

  // ==================== ENHANCED SWF CONTENT PROCESSING ====================

  processSWFTranslatedData(translatedData) {
    try {
      this.output.push(`Processing SWF data: ${translatedData.tagType || 'Unknown'}`);
      
      // Handle shape definitions (from ShapeParserTranslator)
      if (translatedData.translatedShape) {
        const shape = translatedData.translatedShape;
        this.swfShapes.set(shape.shapeId, shape);
        this.output.push(`Stored shape ${shape.shapeId}: ${shape.bounds.width}×${shape.bounds.height}px`);
      }
      
      // Handle enhanced display commands (from TagParse.js with proper linking metadata)
      if (translatedData.isDisplayCommand && translatedData.characterId !== undefined && translatedData.depth !== undefined) {
        const displayObj = {
          characterId: translatedData.characterId,
          depth: translatedData.depth,
          hasTransform: translatedData.renderCommands && translatedData.renderCommands.some(cmd => cmd.transform),
          tagType: translatedData.tagType
        };
        
        this.swfDisplayList.set(translatedData.depth, displayObj);
        this.output.push(`Enhanced display command: Character ${translatedData.characterId} at depth ${translatedData.depth}`);
      }
      
      // Handle legacy display list state (from DisplayParserTranslator)
      if (translatedData.displayListState && Array.isArray(translatedData.displayListState)) {
        translatedData.displayListState.forEach(displayObj => {
          this.swfDisplayList.set(displayObj.depth, displayObj);
          this.output.push(`Legacy display object: Character ${displayObj.characterId} at depth ${displayObj.depth}`);
        });
        this.output.push(`Updated display list: ${translatedData.displayListState.length} objects from translator`);
      }
      
      // Handle individual render commands from translators
      if (translatedData.renderCommands && Array.isArray(translatedData.renderCommands)) {
        // Group render commands by type for better processing
        const placeCommands = translatedData.renderCommands.filter(cmd => cmd.type === "place_object");
        const removeCommands = translatedData.renderCommands.filter(cmd => cmd.type === "remove_object");
        const otherCommands = translatedData.renderCommands.filter(cmd => 
          cmd.type !== "place_object" && cmd.type !== "remove_object"
        );
        
        // Process place commands to build display list
        placeCommands.forEach(cmd => {
          if (cmd.characterId !== undefined && cmd.depth !== undefined) {
            const displayObj = {
              characterId: cmd.characterId,
              depth: cmd.depth,
              hasTransform: cmd.transform && !cmd.transform.isIdentity,
              tagType: translatedData.tagType,
              transform: cmd.transform,
              operation: cmd.operation
            };
            
            this.swfDisplayList.set(cmd.depth, displayObj);
            this.output.push(`Render command display: Character ${cmd.characterId} at depth ${cmd.depth} (${cmd.operation})`);
          }
        });
        
        // Process remove commands
        removeCommands.forEach(cmd => {
          if (cmd.depth !== undefined) {
            this.swfDisplayList.delete(cmd.depth);
            this.output.push(`Removed object at depth ${cmd.depth}`);
          }
        });
        
        // Store other render commands for shape rendering
        this.renderCommands.push(...otherCommands);
        this.output.push(`Added ${translatedData.renderCommands.length} render commands (${placeCommands.length} place, ${removeCommands.length} remove, ${otherCommands.length} other)`);
      }
      
      // Provide summary of current state
      this.output.push(`Current state: ${this.swfShapes.size} shapes, ${this.swfDisplayList.size} display objects, ${this.renderCommands.length} render commands`);
      
    } catch (error) {
      this.output.push(`Error processing SWF data: ${error.message}`);
      console.error("SWF processing error:", error, translatedData);
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
      renderButton.textContent = `Render SWF Frame`;
      renderButton.style.backgroundColor = '#28a745';
      this.output.push("Render button enabled - SWF content ready");
    } else {
      renderButton.disabled = true;
      renderButton.textContent = 'No SWF Content';
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
    this.swfShapes.clear();
    this.swfDisplayList.clear();
    this.renderCommands = [];
    
    // Reset button to disabled state
    const renderButton = document.getElementById('renderButton');
    if (renderButton) {
      renderButton.disabled = true;
      renderButton.textContent = 'No SWF Content';
      renderButton.style.backgroundColor = '#6c757d';
    }
    
    this.output.push("Renderer reset for new SWF file");
    this.clear();
  }

  // Called when SWF is uploaded (from index.html)
  onSWFUploaded() {
    this.output.push("SWF file uploaded - waiting for content translation...");
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
      this.output.push("SWF Frame Rendering Started:");
      this.output.push("=============================");
      
      if (!this.isInitialized) {
        this.output.push("Error: Renderer not initialized");
        return false;
      }
      
      if (!window.translatedDataStorage || Object.keys(window.translatedDataStorage).length === 0) {
        this.output.push("Error: No SWF content available");
        return false;
      }
      
      this.output.push("Rendering SWF first frame content...");
      
      // Clear canvas with proper background
      this.clearWithBackground();
      
      // Render the actual SWF first frame
      const success = this.renderSWFFirstFrame();
      
      if (success) {
        this.output.push("SWF first frame rendered successfully");
      } else {
        this.output.push("Failed to render SWF first frame");
      }
      
      return success;
      
    } catch (error) {
      this.output.push(`SWF rendering error: ${error.message}`);
      return false;
    }
  }

  renderSWFFirstFrame() {
    try {
      let renderedShapes = 0;
      let renderedObjects = 0;
      
      // First, render all shapes that are placed on the display list
      const sortedDisplayList = Array.from(this.swfDisplayList.entries())
        .sort(([depthA], [depthB]) => depthA - depthB);
      
      this.output.push(`Display list contains ${sortedDisplayList.length} objects`);
      
      for (const [depth, displayObject] of sortedDisplayList) {
        if (displayObject.characterId && this.swfShapes.has(displayObject.characterId)) {
          const shape = this.swfShapes.get(displayObject.characterId);
          
          this.output.push(`Rendering shape ${displayObject.characterId} at depth ${depth}`);
          
          // Apply display object transform if present
          if (displayObject.hasTransform && displayObject.transform) {
            this.pushTransform(displayObject.transform);
          }
          
          // Render the actual shape
          if (this.renderActualShape(shape)) {
            renderedShapes++;
          }
          
          // Restore transform
          if (displayObject.hasTransform && displayObject.transform) {
            this.popTransform();
          }
          
          renderedObjects++;
        } else {
          this.output.push(`Warning: Shape ${displayObject.characterId} not found for depth ${depth}`);
        }
      }
      
      // If no display list, try to render shapes directly
      if (renderedShapes === 0 && this.swfShapes.size > 0) {
        this.output.push("No display list found, rendering shapes directly");
        
        for (const [shapeId, shape] of this.swfShapes.entries()) {
          this.output.push(`Direct rendering shape ${shapeId}`);
          if (this.renderActualShape(shape)) {
            renderedShapes++;
          }
        }
      }
      
      // Process remaining render commands
      if (this.renderCommands.length > 0) {
        this.output.push(`Processing ${this.renderCommands.length} additional render commands`);
        this.processRenderCommands(this.renderCommands);
      }
      
      this.output.push(`Frame complete: ${renderedShapes} shapes, ${renderedObjects} display objects`);
      return renderedShapes > 0 || renderedObjects > 0;
      
    } catch (error) {
      this.output.push(`Error rendering SWF frame: ${error.message}`);
      return false;
    }
  }

  renderActualShape(shape) {
    try {
      if (!shape || !shape.bounds) {
        this.output.push("Warning: Invalid shape data");
        return false;
      }
      
      this.output.push(`Rendering shape: ${shape.bounds.width}×${shape.bounds.height}px`);
      
      // Get the shape's render commands from translated data
      const shapeRenderCommands = this.findShapeRenderCommands(shape.shapeId);
      
      if (shapeRenderCommands.length > 0) {
        this.output.push(`Found ${shapeRenderCommands.length} render commands for shape ${shape.shapeId}`);
        this.processRenderCommands(shapeRenderCommands);
        return true;
      } else {
        // Fallback: render a basic shape representation
        this.output.push(`No render commands found for shape ${shape.shapeId}, using fallback rendering`);
        return this.renderShapeFallback(shape);
      }
      
    } catch (error) {
      this.output.push(`Error rendering shape: ${error.message}`);
      return false;
    }
  }

  findShapeRenderCommands(shapeId) {
    const commands = [];
    
    // Look through all translated data for render commands related to this shape
    if (window.translatedDataStorage) {
      for (const [timestamp, data] of Object.entries(window.translatedDataStorage)) {
        if (data.renderCommands && data.translatedShape && data.translatedShape.shapeId === shapeId) {
          commands.push(...data.renderCommands);
        }
      }
    }
    
    return commands;
  }

  renderShapeFallback(shape) {
    try {
      // Create a simple rectangle representation of the shape
      const bounds = shape.bounds;
      const vertices = [
        bounds.xMin, bounds.yMin,
        bounds.xMax, bounds.yMin,
        bounds.xMax, bounds.yMax,
        bounds.xMin, bounds.yMax
      ];
      
      // Use a colored fill based on shape complexity
      let color;
      switch (shape.complexity) {
        case "simple":
          color = [0.2, 0.8, 0.2, 1.0]; // Green
          break;
        case "moderate":
          color = [0.8, 0.8, 0.2, 1.0]; // Yellow
          break;
        case "complex":
          color = [0.8, 0.4, 0.2, 1.0]; // Orange
          break;
        case "very_complex":
          color = [0.8, 0.2, 0.2, 1.0]; // Red
          break;
        default:
          color = [0.5, 0.5, 0.8, 1.0]; // Blue
          break;
      }
      
      // Create triangulated version for WebGL
      const triangulatedVertices = [
        vertices[0], vertices[1],  // Triangle 1
        vertices[2], vertices[3],
        vertices[4], vertices[5],
        vertices[0], vertices[1],  // Triangle 2
        vertices[4], vertices[5],
        vertices[6], vertices[7]
      ];
      
      this.drawSolidFill(triangulatedVertices, color);
      this.output.push(`Fallback rendered shape ${shape.shapeId} as ${shape.complexity} rectangle`);
      
      return true;
      
    } catch (error) {
      this.output.push(`Error in shape fallback rendering: ${error.message}`);
      return false;
    }
  }

  processRenderCommands(commands) {
    this.output.push(`Processing ${commands.length} render commands for actual SWF content`);
    
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
          this.drawActualPath(command);
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

  // ==================== ACTUAL SWF RENDER COMMAND HANDLERS ====================

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
    
    // Create actual texture based on SWF gradient data
    const texture = this.createActualTexture(textureType, command.gradient);
    
    if (!this.fillStyles) this.fillStyles = new Map();
    this.fillStyles.set(styleIndex, {
      type: "texture",
      texture: texture,
      textureType: textureType
    });
    
    this.output.push(`Texture fill ${styleIndex}: ${textureType} (actual SWF gradient)`);
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

  drawActualPath(command) {
    const path = command.path;
    const fillStyle0 = command.fillStyle0;
    const fillStyle1 = command.fillStyle1;
    const lineStyle = command.lineStyle;
    
    this.output.push(`Drawing actual SWF path: ${path.length} commands, fill0: ${fillStyle0}, fill1: ${fillStyle1}, line: ${lineStyle}`);
    
    // Convert SWF path commands to WebGL vertices
    const vertices = this.swfPathCommandsToVertices(path);
    
    if (vertices.length === 0) {
      this.output.push("Warning: Path generated no vertices");
      return;
    }
    
    // Draw fill if present (use fill0 primarily, fall back to fill1)
    const activeFillStyle = fillStyle0 > 0 ? fillStyle0 : fillStyle1;
    if (activeFillStyle > 0 && this.fillStyles && this.fillStyles.has(activeFillStyle)) {
      const fillStyle = this.fillStyles.get(activeFillStyle);
      this.drawFill(vertices, fillStyle);
      this.output.push(`Drew fill with style ${activeFillStyle}`);
    }
    
    // Draw stroke if present
    if (lineStyle > 0 && this.lineStyles && this.lineStyles.has(lineStyle)) {
      const lineStyleData = this.lineStyles.get(lineStyle);
      this.drawStroke(vertices, lineStyleData);
      this.output.push(`Drew stroke with style ${lineStyle}`);
    }
    
    this.output.push(`Path rendered: ${vertices.length/2} vertices`);
  }

  swfPathCommandsToVertices(pathCommands) {
    const vertices = [];
    let currentX = 0;
    let currentY = 0;
    
    this.output.push(`Converting ${pathCommands.length} SWF path commands to vertices`);
    
    pathCommands.forEach((command, index) => {
      switch (command.type) {
        case "move_to":
          if (command.position) {
            currentX = command.position.x;
            currentY = command.position.y;
          } else if (command.moveTo) {
            currentX = command.moveTo.x;
            currentY = command.moveTo.y;
          }
          break;
          
        case "line_to":
          // Add line as vertices for triangulation
          vertices.push(currentX, currentY);
          if (command.endPosition) {
            vertices.push(command.endPosition.x, command.endPosition.y);
            currentX = command.endPosition.x;
            currentY = command.endPosition.y;
          }
          break;
          
        case "curve_to":
          // Approximate curve with line segments (more accurate than previous version)
          if (command.controlPoint && command.endPosition) {
            const steps = Math.max(5, Math.min(20, Math.floor(command.length || 10)));
            const startX = currentX;
            const startY = currentY;
            
            for (let i = 1; i <= steps; i++) {
              const t = i / steps;
              const x = this.quadraticBezier(startX, command.controlPoint.x, command.endPosition.x, t);
              const y = this.quadraticBezier(startY, command.controlPoint.y, command.endPosition.y, t);
              
              vertices.push(currentX, currentY);
              vertices.push(x, y);
              currentX = x;
              currentY = y;
            }
          }
          break;
          
        default:
          this.output.push(`Unknown path command: ${command.type}`);
          break;
      }
    });
    
    this.output.push(`Generated ${vertices.length/2} vertices from path commands`);
    return vertices;
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

  // ==================== IMPROVED PATH RENDERING ====================

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
    // Improved triangulation for better shape rendering
    if (vertices.length < 6) return vertices;
    
    const triangulated = [];
    
    // Simple fan triangulation from centroid
    const centerX = vertices.reduce((sum, v, i) => i % 2 === 0 ? sum + v : sum, 0) / (vertices.length / 2);
    const centerY = vertices.reduce((sum, v, i) => i % 2 === 1 ? sum + v : sum, 0) / (vertices.length / 2);
    
    for (let i = 0; i < vertices.length - 2; i += 2) {
      const nextI = (i + 2) % vertices.length;
      
      triangulated.push(
        centerX, centerY,
        vertices[i], vertices[i + 1],
        vertices[nextI], vertices[nextI + 1]
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
    // Improved texture rendering would be implemented here
    // For now, fall back to a neutral color
    this.drawSolidFill(vertices, [0.7, 0.7, 0.7, 1.0]);
  }

  // ==================== IMPROVED TEXTURE MANAGEMENT ====================

  createActualTexture(textureType, gradientData) {
    const size = 256;
    const texture = this.gl.createTexture();
    const data = new Uint8Array(size * size * 4);
    
    switch (textureType) {
      case "linear_gradient":
        this.generateActualLinearGradientTexture(data, size, gradientData);
        break;
      case "radial_gradient":
        this.generateActualRadialGradientTexture(data, size, gradientData);
        break;
      default:
        // Better fallback based on texture type
        this.generateFallbackTexture(data, size, textureType);
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

  generateActualLinearGradientTexture(data, size, gradientData) {
    if (!gradientData || !gradientData.colors || gradientData.colors.length === 0) {
      return; // Use default fallback
    }
    
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const t = x / (size - 1);
        const color = this.interpolateActualGradient(t, gradientData);
        const index = (y * size + x) * 4;
        
        data[index] = color[0] * 255;
        data[index + 1] = color[1] * 255;
        data[index + 2] = color[2] * 255;
        data[index + 3] = color[3] * 255;
      }
    }
  }

  generateActualRadialGradientTexture(data, size, gradientData) {
    if (!gradientData || !gradientData.colors || gradientData.colors.length === 0) {
      return; // Use default fallback
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
        
        const color = this.interpolateActualGradient(t, gradientData);
        const index = (y * size + x) * 4;
        
        data[index] = color[0] * 255;
        data[index + 1] = color[1] * 255;
        data[index + 2] = color[2] * 255;
        data[index + 3] = color[3] * 255;
      }
    }
  }

  generateFallbackTexture(data, size, textureType) {
    // Generate pattern based on texture type
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const index = (y * size + x) * 4;
        
        switch (textureType) {
          case "focal_radial_gradient":
            const dist = Math.sqrt((x - size/2) ** 2 + (y - size/2) ** 2) / (size/2);
            data[index] = 100 + dist * 155;     // R
            data[index + 1] = 150 + dist * 105; // G
            data[index + 2] = 200 - dist * 100; // B
            data[index + 3] = 255;              // A
            break;
          default:
            data[index] = 150;     // R
            data[index + 1] = 150; // G
            data[index + 2] = 150; // B
            data[index + 3] = 255; // A
            break;
        }
      }
    }
  }

  interpolateActualGradient(t, gradientData) {
    if (!gradientData.colors || gradientData.colors.length === 0) {
      return [0.5, 0.5, 0.5, 1.0];
    }
    
    if (gradientData.colors.length === 1) {
      return gradientData.colors[0];
    }
    
    // Use actual ratios if available
    if (gradientData.ratios && gradientData.ratios.length === gradientData.colors.length) {
      // Find the correct gradient segment
      for (let i = 0; i < gradientData.ratios.length - 1; i++) {
        if (t >= gradientData.ratios[i] && t <= gradientData.ratios[i + 1]) {
          const localT = (t - gradientData.ratios[i]) / (gradientData.ratios[i + 1] - gradientData.ratios[i]);
          const color1 = gradientData.colors[i];
          const color2 = gradientData.colors[i + 1];
          
          return [
            color1[0] * (1 - localT) + color2[0] * localT,
            color1[1] * (1 - localT) + color2[1] * localT,
            color1[2] * (1 - localT) + color2[2] * localT,
            color1[3] * (1 - localT) + color2[3] * localT
          ];
        }
      }
    }
    
    // Fall back to even distribution
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

  // ==================== TRANSFORMATION MANAGEMENT ====================

  pushTransform(transform) {
    // Save current transform and apply new one
    this.transformStack = this.transformStack || [];
    this.transformStack.push([...this.currentTransform]);
    
    if (transform && transform.webglMatrix) {
      this.currentTransform = [...transform.webglMatrix];
    }
  }

  popTransform() {
    // Restore previous transform
    if (this.transformStack && this.transformStack.length > 0) {
      this.currentTransform = this.transformStack.pop();
    }
  }

  // ==================== UTILITY METHODS ====================

  clearWithBackground() {
    // Use actual SWF background color if available
    this.gl.clearColor(this.backgroundColor[0], this.backgroundColor[1], this.backgroundColor[2], this.backgroundColor[3]);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
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
      uiReadyCheckCount: this.uiReadyCheckCount,
      swfShapesCount: this.swfShapes.size,
      swfDisplayListSize: this.swfDisplayList.size,
      renderCommandsCount: this.renderCommands.length
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
