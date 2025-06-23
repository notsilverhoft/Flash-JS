/* 
 * SWF Display Parser Translator - v1.0
 * Converts parsed display list data from DisplayParsers.js into WebGL-ready rendering commands
 * Handles transformation matrices, display list management, and advanced features
 * Part of the Flash-JS rendering pipeline translation layer
 */
class DisplayParserTranslator {
  constructor() {
    this.output = [];
    this.twipsToPixels = 1 / 20; // SWF uses twips (1/20th pixel)
    this.displayList = new Map(); // Track display list state
  }

  // ==================== MAIN TRANSLATION ENTRY POINT ====================
  
  translateDisplayData(parsedDisplayData) {
    try {
      this.output = [];
      this.output.push("Display Translation Results:");
      this.output.push("============================");

      if (!parsedDisplayData || !parsedDisplayData.data) {
        this.output.push("Error: No display data provided for translation");
        return {
          success: false,
          error: "No display data provided",
          output: this.output.join('\n'),
          renderCommands: []
        };
      }

      const data = parsedDisplayData.data;
      
      this.output.push(`Translating ${parsedDisplayData.tagType}`);

      // Generate render commands based on display operation type
      const renderCommands = this.generateDisplayRenderCommands(parsedDisplayData);
      this.output.push(`Render Commands: ${renderCommands.length} operations generated`);

      // Update display list state
      this.updateDisplayListState(parsedDisplayData);

      this.output.push("Display translation completed successfully");

      return {
        success: true,
        tagType: parsedDisplayData.tagType,
        renderCommands: renderCommands,
        displayListState: this.getDisplayListSnapshot(),
        output: this.output.join('\n'),
        optimizationHints: this.generateDisplayOptimizationHints(parsedDisplayData)
      };

    } catch (error) {
      this.output.push(`Translation error: ${error.message}`);
      return {
        success: false,
        error: error.message,
        output: this.output.join('\n'),
        renderCommands: []
      };
    }
  }

  // ==================== DISPLAY COMMAND GENERATION ====================

  generateDisplayRenderCommands(parsedDisplayData) {
    const commands = [];
    const tagType = parsedDisplayData.tagType;
    const data = parsedDisplayData.data;

    switch (tagType) {
      case "PlaceObject":
        commands.push(...this.generatePlaceObjectCommands(data, 1));
        break;

      case "PlaceObject2":
        commands.push(...this.generatePlaceObject2Commands(data, 2));
        break;

      case "PlaceObject3":
        commands.push(...this.generatePlaceObject3Commands(data, 3));
        break;

      case "RemoveObject":
        commands.push(...this.generateRemoveObjectCommands(data, 1));
        break;

      case "RemoveObject2":
        commands.push(...this.generateRemoveObject2Commands(data, 2));
        break;

      default:
        this.output.push(`Warning: Unsupported display tag type: ${tagType}`);
        commands.push({
          type: "unknown_display_operation",
          tagType: tagType,
          note: "Unsupported display operation"
        });
        break;
    }

    return commands;
  }

  generatePlaceObjectCommands(data, version) {
    const commands = [];

    this.output.push(`Processing PlaceObject (Character: ${data.characterId}, Depth: ${data.depth})`);

    // Basic placement command
    commands.push({
      type: "place_object",
      version: version,
      characterId: data.characterId,
      depth: data.depth,
      transform: this.translateMatrix(data.matrix),
      colorTransform: data.colorTransform ? this.translateColorTransform(data.colorTransform) : null,
      hasColorTransform: data.hasColorTransform,
      operation: "place_new"
    });

    // Add debug info
    if (data.matrix) {
      this.output.push(`  • Transform: ${this.formatTransformSummary(data.matrix)}`);
    }
    if (data.hasColorTransform) {
      this.output.push(`  • Color transform applied`);
    }

    return commands;
  }

  generatePlaceObject2Commands(data, version) {
    const commands = [];
    const flags = data.flags;

    this.output.push(`Processing PlaceObject2 (Depth: ${data.depth})`);

    // Determine operation type
    let operation = "modify_existing";
    if (flags.hasCharacter && !flags.hasMove) {
      operation = "place_new";
    } else if (flags.hasMove && !flags.hasCharacter) {
      operation = "move_existing";
    } else if (flags.hasCharacter && flags.hasMove) {
      operation = "replace_character";
    }

    this.output.push(`  • Operation: ${operation}`);

    // Main placement command
    const placeCommand = {
      type: "place_object",
      version: version,
      depth: data.depth,
      operation: operation,
      flags: flags
    };

    // Add character ID if present
    if (flags.hasCharacter) {
      placeCommand.characterId = data.characterId;
      this.output.push(`  • Character ID: ${data.characterId}`);
    }

    // Add transform if present
    if (flags.hasMatrix && data.matrix) {
      placeCommand.transform = this.translateMatrix(data.matrix);
      this.output.push(`  • Transform: ${this.formatTransformSummary(data.matrix)}`);
    }

    // Add color transform if present
    if (flags.hasColorTransform && data.colorTransform) {
      placeCommand.colorTransform = this.translateColorTransform(data.colorTransform);
      this.output.push(`  • Color transform applied`);
    }

    // Add ratio (for morphing shapes)
    if (flags.hasRatio && data.ratio !== null) {
      placeCommand.ratio = data.ratio;
      this.output.push(`  • Morph ratio: ${data.ratio}`);
    }

    // Add instance name
    if (flags.hasName && data.name) {
      placeCommand.instanceName = data.name;
      this.output.push(`  • Instance name: "${data.name}"`);
    }

    // Add clip depth (for masking)
    if (flags.hasClipDepth && data.clipDepth !== null) {
      placeCommand.clipDepth = data.clipDepth;
      this.output.push(`  • Clip depth: ${data.clipDepth} (masking)`);
    }

    // Add clip actions note
    if (flags.hasClipActions) {
      placeCommand.hasClipActions = true;
      this.output.push(`  • Has clip actions (ActionScript events)`);
    }

    commands.push(placeCommand);

    return commands;
  }

  generatePlaceObject3Commands(data, version) {
    const commands = [];
    const flags = data.flags;

    this.output.push(`Processing PlaceObject3 (Depth: ${data.depth}) - Advanced Features`);

    // Determine operation type (same logic as PlaceObject2)
    let operation = "modify_existing";
    if (flags.hasCharacter && !flags.hasMove) {
      operation = "place_new";
    } else if (flags.hasMove && !flags.hasCharacter) {
      operation = "move_existing";
    } else if (flags.hasCharacter && flags.hasMove) {
      operation = "replace_character";
    }

    this.output.push(`  • Operation: ${operation}`);

    // Main placement command with PlaceObject3 features
    const placeCommand = {
      type: "place_object",
      version: version,
      depth: data.depth,
      operation: operation,
      flags: flags,
      advancedFeatures: data.advancedFeatures
    };

    // Standard PlaceObject2 features
    if (flags.hasCharacter) {
      placeCommand.characterId = data.characterId;
      this.output.push(`  • Character ID: ${data.characterId}`);
    }

    if (flags.hasClassName && data.className) {
      placeCommand.className = data.className;
      this.output.push(`  • Class name: "${data.className}"`);
    }

    if (flags.hasMatrix && data.matrix) {
      placeCommand.transform = this.translateMatrix(data.matrix);
      this.output.push(`  • Transform: ${this.formatTransformSummary(data.matrix)}`);
    }

    if (flags.hasColorTransform && data.colorTransform) {
      placeCommand.colorTransform = this.translateColorTransform(data.colorTransform);
      this.output.push(`  • Color transform applied`);
    }

    if (flags.hasRatio && data.ratio !== null) {
      placeCommand.ratio = data.ratio;
      this.output.push(`  • Morph ratio: ${data.ratio}`);
    }

    if (flags.hasName && data.name) {
      placeCommand.instanceName = data.name;
      this.output.push(`  • Instance name: "${data.name}"`);
    }

    if (flags.hasClipDepth && data.clipDepth !== null) {
      placeCommand.clipDepth = data.clipDepth;
      this.output.push(`  • Clip depth: ${data.clipDepth} (masking)`);
    }

    // PlaceObject3 specific features
    if (flags.hasFilterList && data.filterList) {
      placeCommand.filters = this.translateFilterList(data.filterList);
      this.output.push(`  • Filters: ${data.filterList.numberOfFilters} (${data.filterList.complexity})`);
    }

    if (flags.hasBlendMode && data.blendMode) {
      placeCommand.blendMode = this.translateBlendMode(data.blendMode);
      this.output.push(`  • Blend mode: ${data.blendMode}`);
    }

    if (flags.hasCacheAsBitmap && data.cacheAsBitmap !== null) {
      placeCommand.cacheAsBitmap = data.cacheAsBitmap;
      this.output.push(`  • Cache as bitmap: ${data.cacheAsBitmap ? 'Yes' : 'No'}`);
    }

    if (flags.hasVisible && data.visible !== null) {
      placeCommand.visible = data.visible;
      this.output.push(`  • Visible: ${data.visible ? 'Yes' : 'No'}`);
    }

    if (flags.hasOpaqueBackground && data.backgroundColor) {
      placeCommand.backgroundColor = this.translateColor(data.backgroundColor);
      this.output.push(`  • Background color: ${data.backgroundColorFormatted}`);
    }

    if (flags.hasClipActions) {
      placeCommand.hasClipActions = true;
      this.output.push(`  • Has clip actions (ActionScript events)`);
    }

    commands.push(placeCommand);

    // Generate additional commands for advanced features
    if (data.advancedFeatures.complexity !== "simple") {
      commands.push({
        type: "setup_advanced_rendering",
        depth: data.depth,
        complexity: data.advancedFeatures.complexity,
        features: {
          hasFilters: data.advancedFeatures.hasFilters,
          hasBlending: data.advancedFeatures.hasBlending,
          hasCaching: data.advancedFeatures.hasCaching,
          hasVisibilityControl: data.advancedFeatures.hasVisibilityControl,
          hasBackground: data.advancedFeatures.hasBackground
        }
      });

      this.output.push(`  • Advanced rendering setup: ${data.advancedFeatures.complexity}`);
    }

    return commands;
  }

  generateRemoveObjectCommands(data, version) {
    const commands = [];

    this.output.push(`Processing RemoveObject (Character: ${data.characterId}, Depth: ${data.depth})`);

    commands.push({
      type: "remove_object",
      version: version,
      characterId: data.characterId,
      depth: data.depth,
      operation: "remove_specific"
    });

    return commands;
  }

  generateRemoveObject2Commands(data, version) {
    const commands = [];

    this.output.push(`Processing RemoveObject2 (Depth: ${data.depth})`);

    commands.push({
      type: "remove_object",
      version: version,
      depth: data.depth,
      operation: "remove_at_depth",
      note: data.note
    });

    return commands;
  }

  // ==================== TRANSFORMATION TRANSLATION ====================

  translateMatrix(matrix) {
    if (!matrix) return this.getIdentityTransform();

    const transform = {
      scaleX: matrix.scaleX || 1.0,
      scaleY: matrix.scaleY || 1.0,
      rotateSkew0: matrix.rotateSkew0 || 0.0,
      rotateSkew1: matrix.rotateSkew1 || 0.0,
      translateX: (matrix.translateX || 0) * this.twipsToPixels,
      translateY: (matrix.translateY || 0) * this.twipsToPixels
    };

    // Generate WebGL-compatible transformation matrix (3x3 for 2D)
    transform.webglMatrix = [
      transform.scaleX, transform.rotateSkew0, 0,
      transform.rotateSkew1, transform.scaleY, 0,
      transform.translateX, transform.translateY, 1
    ];

    // Calculate derived properties for optimization
    transform.isIdentity = this.isIdentityTransform(transform);
    transform.hasTranslation = transform.translateX !== 0 || transform.translateY !== 0;
    transform.hasRotation = transform.rotateSkew0 !== 0 || transform.rotateSkew1 !== 0;
    transform.hasScale = transform.scaleX !== 1.0 || transform.scaleY !== 1.0;

    return transform;
  }

  translateColorTransform(colorTransform) {
    if (!colorTransform) return null;

    // Convert color transform to WebGL-friendly format
    return {
      redMultiplier: (colorTransform.redMultiplier || 256) / 256,
      greenMultiplier: (colorTransform.greenMultiplier || 256) / 256,
      blueMultiplier: (colorTransform.blueMultiplier || 256) / 256,
      alphaMultiplier: (colorTransform.alphaMultiplier || 256) / 256,
      redOffset: (colorTransform.redOffset || 0) / 255,
      greenOffset: (colorTransform.greenOffset || 0) / 255,
      blueOffset: (colorTransform.blueOffset || 0) / 255,
      alphaOffset: (colorTransform.alphaOffset || 0) / 255,
      hasEffect: this.colorTransformHasEffect(colorTransform)
    };
  }

  translateFilterList(filterList) {
    if (!filterList || !filterList.filters) return [];

    const translatedFilters = [];

    filterList.filters.forEach((filter, index) => {
      const translatedFilter = this.translateFilter(filter, index);
      if (translatedFilter) {
        translatedFilters.push(translatedFilter);
      }
    });

    return {
      count: filterList.numberOfFilters,
      filters: translatedFilters,
      complexity: filterList.complexity,
      requiresOffscreenBuffer: translatedFilters.length > 0
    };
  }

  translateFilter(filter, index) {
    const baseFilter = {
      index: index,
      type: filter.type
    };

    switch (filter.type) {
      case "drop_shadow":
        return {
          ...baseFilter,
          color: this.translateColor(filter.color),
          blurX: filter.blurX,
          blurY: filter.blurY,
          angle: filter.angle,
          distance: filter.distance * this.twipsToPixels,
          strength: filter.strength,
          innerShadow: filter.innerShadow,
          knockout: filter.knockout,
          passes: filter.passes,
          webglType: "drop_shadow"
        };

      case "blur":
        return {
          ...baseFilter,
          blurX: filter.blurX,
          blurY: filter.blurY,
          passes: filter.passes,
          quality: filter.quality,
          webglType: "gaussian_blur"
        };

      case "glow":
        return {
          ...baseFilter,
          color: this.translateColor(filter.color),
          blurX: filter.blurX,
          blurY: filter.blurY,
          strength: filter.strength,
          innerGlow: filter.innerGlow,
          knockout: filter.knockout,
          passes: filter.passes,
          webglType: "glow"
        };

      case "color_matrix":
        return {
          ...baseFilter,
          matrix: filter.matrix,
          webglType: "color_matrix"
        };

      default:
        return {
          ...baseFilter,
          webglType: "unsupported",
          note: `Filter type ${filter.type} not yet supported`
        };
    }
  }

  translateBlendMode(blendMode) {
    const blendModeMap = {
      "normal": "NORMAL",
      "layer": "NORMAL",
      "multiply": "MULTIPLY",
      "screen": "SCREEN",
      "lighten": "LIGHTEN",
      "darken": "DARKEN",
      "difference": "DIFFERENCE",
      "add": "ADD",
      "subtract": "SUBTRACT",
      "overlay": "OVERLAY",
      "hardlight": "HARD_LIGHT"
    };

    return {
      swfMode: blendMode,
      webglMode: blendModeMap[blendMode] || "NORMAL",
      requiresBlending: blendMode !== "normal"
    };
  }

  translateColor(color) {
    if (!color) return { r: 0, g: 0, b: 0, a: 1.0 };

    return {
      r: (color.r || 0) / 255,
      g: (color.g || 0) / 255,
      b: (color.b || 0) / 255,
      a: color.a !== undefined ? color.a / 255 : 1.0
    };
  }

  // ==================== DISPLAY LIST STATE MANAGEMENT ====================

  updateDisplayListState(parsedDisplayData) {
    const tagType = parsedDisplayData.tagType;
    const data = parsedDisplayData.data;

    switch (tagType) {
      case "PlaceObject":
      case "PlaceObject2":
      case "PlaceObject3":
        this.displayList.set(data.depth, {
          characterId: data.characterId,
          depth: data.depth,
          instanceName: data.name || null,
          transform: data.matrix ? this.translateMatrix(data.matrix) : this.getIdentityTransform(),
          lastUpdate: Date.now(),
          tagType: tagType
        });
        break;

      case "RemoveObject":
      case "RemoveObject2":
        this.displayList.delete(data.depth);
        break;
    }

    this.output.push(`Display list now contains ${this.displayList.size} objects`);
  }

  getDisplayListSnapshot() {
    const snapshot = [];
    for (const [depth, object] of this.displayList.entries()) {
      snapshot.push({
        depth: depth,
        characterId: object.characterId,
        instanceName: object.instanceName,
        hasTransform: !object.transform.isIdentity,
        tagType: object.tagType
      });
    }
    
    // Sort by depth for rendering order
    snapshot.sort((a, b) => a.depth - b.depth);
    return snapshot;
  }

  // ==================== UTILITY METHODS ====================

  getIdentityTransform() {
    return {
      scaleX: 1.0,
      scaleY: 1.0,
      rotateSkew0: 0.0,
      rotateSkew1: 0.0,
      translateX: 0.0,
      translateY: 0.0,
      webglMatrix: [1, 0, 0, 0, 1, 0, 0, 0, 1],
      isIdentity: true,
      hasTranslation: false,
      hasRotation: false,
      hasScale: false
    };
  }

  isIdentityTransform(transform) {
    return transform.scaleX === 1.0 && 
           transform.scaleY === 1.0 && 
           transform.rotateSkew0 === 0.0 && 
           transform.rotateSkew1 === 0.0 && 
           transform.translateX === 0.0 && 
           transform.translateY === 0.0;
  }

  colorTransformHasEffect(colorTransform) {
    return (colorTransform.redMultiplier !== 256) ||
           (colorTransform.greenMultiplier !== 256) ||
           (colorTransform.blueMultiplier !== 256) ||
           (colorTransform.alphaMultiplier !== 256) ||
           (colorTransform.redOffset !== 0) ||
           (colorTransform.greenOffset !== 0) ||
           (colorTransform.blueOffset !== 0) ||
           (colorTransform.alphaOffset !== 0);
  }

  formatTransformSummary(matrix) {
    if (!matrix) return "Identity";
    
    const parts = [];
    if (matrix.translateX !== 0 || matrix.translateY !== 0) {
      const x = (matrix.translateX * this.twipsToPixels).toFixed(1);
      const y = (matrix.translateY * this.twipsToPixels).toFixed(1);
      parts.push(`translate(${x}, ${y})`);
    }
    if (matrix.scaleX !== 1.0 || matrix.scaleY !== 1.0) {
      parts.push(`scale(${matrix.scaleX.toFixed(2)}, ${matrix.scaleY.toFixed(2)})`);
    }
    if (matrix.rotateSkew0 !== 0.0 || matrix.rotateSkew1 !== 0.0) {
      parts.push(`rotate/skew`);
    }
    
    return parts.length > 0 ? parts.join(' ') : "Identity";
  }

  generateDisplayOptimizationHints(parsedDisplayData) {
    const hints = [];
    const data = parsedDisplayData.data;

    // Transformation complexity
    if (data.matrix && !this.isIdentityTransform(this.translateMatrix(data.matrix))) {
      hints.push("Complex transformation - consider matrix caching");
    }

    // Filter complexity (PlaceObject3)
    if (data.filterList && data.filterList.numberOfFilters > 2) {
      hints.push("Multiple filters - requires offscreen rendering");
    }

    // Blend mode usage
    if (data.blendMode && data.blendMode !== "normal") {
      hints.push("Custom blend mode - impacts rendering performance");
    }

    // Display list depth management
    if (this.displayList.size > 50) {
      hints.push("Large display list - consider depth optimization");
    }

    return hints;
  }

  getDebugOutput() {
    return this.output.join('\n');
  }
}

// Export for use by rendering pipeline
window.DisplayParserTranslator = DisplayParserTranslator;
