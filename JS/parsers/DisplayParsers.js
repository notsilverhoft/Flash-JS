/* 
 * SWF Display List Tags Parser - v2.0
 * Handles display list management tags
 * PlaceObject family, RemoveObject family
 * ENHANCED: Added PlaceObject3 support with filters and advanced features
 */
class DisplayParsers {
  constructor() {
    this.dataTypes = new SWFDataTypes();
  }
  
  // ==================== TAG PARSING DISPATCHER ====================
  
  parseTag(tagType, tagData, offset, length) {
    const reader = new BitReader(tagData, offset);
    
    switch (tagType) {
      case 4:
        return this.parsePlaceObject(reader, length);
      case 5:
        return this.parseRemoveObject(reader, length);
      case 26:
        return this.parsePlaceObject2(reader, length);
      case 28:
        return this.parseRemoveObject2(reader, length);
      case 70:
        return this.parsePlaceObject3(reader, length);
      default:
        return this.parseUnknownDisplayTag(tagType, reader, length);
    }
  }
  
  // ==================== SPECIFIC TAG PARSERS ====================
  
  parsePlaceObject(reader, length) {
    try {
      // PlaceObject format:
      // - CharacterID (UI16)
      // - Depth (UI16)
      // - Matrix (MATRIX)
      // - ColorTransform (CXFORM) - optional
      
      const characterId = this.dataTypes.parseUI16(reader);
      const depth = this.dataTypes.parseUI16(reader);
      const matrix = this.dataTypes.parseMATRIX(reader);
      
      let colorTransform = null;
      // Check if there's enough data for a color transform
      // This is a bit tricky to determine exactly, so we'll estimate
      const bytesUsed = 4; // CharacterID + Depth
      const matrixBits = this.estimateMatrixBits(matrix);
      const matrixBytes = Math.ceil(matrixBits / 8);
      const remainingBytes = length - bytesUsed - matrixBytes;
      
      if (remainingBytes > 0) {
        try {
          colorTransform = this.dataTypes.parseCXFORM(reader);
        } catch (e) {
          // Color transform parsing failed, that's okay
        }
      }
      
      return {
        tagType: "PlaceObject",
        description: "Places a character on the display list",
        data: {
          characterId: characterId,
          depth: depth,
          matrix: matrix,
          matrixFormatted: this.dataTypes.formatMatrix(matrix),
          colorTransform: colorTransform,
          hasColorTransform: colorTransform !== null
        }
      };
      
    } catch (error) {
      return {
        tagType: "PlaceObject",
        description: "Places a character on the display list",
        error: `Parse error: ${error.message}`,
        data: {}
      };
    }
  }
  
  parseRemoveObject(reader, length) {
    try {
      if (length !== 4) {
        return {
          tagType: "RemoveObject",
          description: "Removes a character from the display list",
          error: `Invalid length: expected 4 bytes, got ${length} bytes`,
          data: {}
        };
      }
      
      const characterId = this.dataTypes.parseUI16(reader);
      const depth = this.dataTypes.parseUI16(reader);
      
      return {
        tagType: "RemoveObject",
        description: "Removes a character from the display list",
        data: {
          characterId: characterId,
          depth: depth
        }
      };
      
    } catch (error) {
      return {
        tagType: "RemoveObject",
        description: "Removes a character from the display list",
        error: `Parse error: ${error.message}`,
        data: {}
      };
    }
  }
  
  parsePlaceObject2(reader, length) {
    try {
      // PlaceObject2 has flags in the first byte
      const flags = this.dataTypes.parseUI8(reader);
      
      const hasClipActions = (flags & 0x80) !== 0;
      const hasClipDepth = (flags & 0x40) !== 0;
      const hasName = (flags & 0x20) !== 0;
      const hasRatio = (flags & 0x10) !== 0;
      const hasColorTransform = (flags & 0x08) !== 0;
      const hasMatrix = (flags & 0x04) !== 0;
      const hasCharacter = (flags & 0x02) !== 0;
      const hasMove = (flags & 0x01) !== 0;
      
      const depth = this.dataTypes.parseUI16(reader);
      
      let characterId = null;
      if (hasCharacter) {
        characterId = this.dataTypes.parseUI16(reader);
      }
      
      let matrix = null;
      if (hasMatrix) {
        matrix = this.dataTypes.parseMATRIX(reader);
      }
      
      let colorTransform = null;
      if (hasColorTransform) {
        colorTransform = this.dataTypes.parseCXFORMA(reader);
      }
      
      let ratio = null;
      if (hasRatio) {
        ratio = this.dataTypes.parseUI16(reader);
      }
      
      let name = null;
      if (hasName) {
        name = this.dataTypes.parseString(reader);
      }
      
      let clipDepth = null;
      if (hasClipDepth) {
        clipDepth = this.dataTypes.parseUI16(reader);
      }
      
      // Skip clip actions for now (complex ActionScript data)
      let clipActionsLength = null;
      if (hasClipActions) {
        clipActionsLength = "Present but not parsed";
      }
      
      return {
        tagType: "PlaceObject2",
        description: "Places/modifies a character on the display list (extended)",
        data: {
          flags: {
            hasClipActions,
            hasClipDepth,
            hasName,
            hasRatio,
            hasColorTransform,
            hasMatrix,
            hasCharacter,
            hasMove
          },
          depth: depth,
          characterId: characterId,
          matrix: matrix,
          matrixFormatted: matrix ? this.dataTypes.formatMatrix(matrix) : null,
          colorTransform: colorTransform,
          ratio: ratio,
          name: name,
          clipDepth: clipDepth,
          clipActionsLength: clipActionsLength,
          isMove: hasMove,
          isNewPlacement: hasCharacter
        }
      };
      
    } catch (error) {
      return {
        tagType: "PlaceObject2",
        description: "Places/modifies a character on the display list (extended)",
        error: `Parse error: ${error.message}`,
        data: {}
      };
    }
  }
  
  parsePlaceObject3(reader, length) {
    try {
      // PlaceObject3 format (Flash Player 8+):
      // - PlaceFlagHasClipActions, PlaceFlagHasClipDepth, PlaceFlagHasName, PlaceFlagHasRatio, 
      //   PlaceFlagHasColorTransform, PlaceFlagHasMatrix, PlaceFlagHasCharacter, PlaceFlagMove (UB[1] each)
      // - PlaceFlagOpaqueBackground, PlaceFlagHasVisible, PlaceFlagHasImage, PlaceFlagHasClassName,
      //   PlaceFlagHasCacheAsBitmap, PlaceFlagHasBlendMode, PlaceFlagHasFilterList, Reserved (UB[1] each)
      // - Depth (UI16)
      // - ClassName (STRING) if PlaceFlagHasClassName
      // - CharacterId (UI16) if PlaceFlagHasCharacter
      // - Matrix (MATRIX) if PlaceFlagHasMatrix
      // - ColorTransform (CXFORMWITHALPHA) if PlaceFlagHasColorTransform
      // - Ratio (UI16) if PlaceFlagHasRatio
      // - Name (STRING) if PlaceFlagHasName
      // - ClipDepth (UI16) if PlaceFlagHasClipDepth
      // - FilterList (FILTERLIST) if PlaceFlagHasFilterList
      // - BlendMode (UI8) if PlaceFlagHasBlendMode
      // - BitmapCache (UI8) if PlaceFlagHasCacheAsBitmap
      // - Visible (UI8) if PlaceFlagHasVisible
      // - BackgroundColor (RGBA) if PlaceFlagOpaqueBackground
      // - ClipActions (CLIPACTIONS) if PlaceFlagHasClipActions
      
      // Parse 16-bit flags (2 bytes)
      const flags1 = this.dataTypes.parseUI8(reader);
      const flags2 = this.dataTypes.parseUI8(reader);
      
      // First byte flags
      const hasClipActions = (flags1 & 0x80) !== 0;
      const hasClipDepth = (flags1 & 0x40) !== 0;
      const hasName = (flags1 & 0x20) !== 0;
      const hasRatio = (flags1 & 0x10) !== 0;
      const hasColorTransform = (flags1 & 0x08) !== 0;
      const hasMatrix = (flags1 & 0x04) !== 0;
      const hasCharacter = (flags1 & 0x02) !== 0;
      const hasMove = (flags1 & 0x01) !== 0;
      
      // Second byte flags (PlaceObject3 specific)
      const hasOpaqueBackground = (flags2 & 0x80) !== 0;
      const hasVisible = (flags2 & 0x40) !== 0;
      const hasImage = (flags2 & 0x20) !== 0;
      const hasClassName = (flags2 & 0x10) !== 0;
      const hasCacheAsBitmap = (flags2 & 0x08) !== 0;
      const hasBlendMode = (flags2 & 0x04) !== 0;
      const hasFilterList = (flags2 & 0x02) !== 0;
      const reserved = (flags2 & 0x01) !== 0;
      
      const depth = this.dataTypes.parseUI16(reader);
      
      let className = null;
      if (hasClassName) {
        className = this.dataTypes.parseString(reader);
      }
      
      let characterId = null;
      if (hasCharacter) {
        characterId = this.dataTypes.parseUI16(reader);
      }
      
      let matrix = null;
      if (hasMatrix) {
        matrix = this.dataTypes.parseMATRIX(reader);
      }
      
      let colorTransform = null;
      if (hasColorTransform) {
        colorTransform = this.dataTypes.parseCXFORMA(reader);
      }
      
      let ratio = null;
      if (hasRatio) {
        ratio = this.dataTypes.parseUI16(reader);
      }
      
      let name = null;
      if (hasName) {
        name = this.dataTypes.parseString(reader);
      }
      
      let clipDepth = null;
      if (hasClipDepth) {
        clipDepth = this.dataTypes.parseUI16(reader);
      }
      
      let filterList = null;
      if (hasFilterList) {
        filterList = this.parseFilterList(reader);
      }
      
      let blendMode = null;
      if (hasBlendMode) {
        const blendModeValue = this.dataTypes.parseUI8(reader);
        blendMode = this.getBlendModeName(blendModeValue);
      }
      
      let cacheAsBitmap = null;
      if (hasCacheAsBitmap) {
        cacheAsBitmap = this.dataTypes.parseUI8(reader) !== 0;
      }
      
      let visible = null;
      if (hasVisible) {
        visible = this.dataTypes.parseUI8(reader) !== 0;
      }
      
      let backgroundColor = null;
      if (hasOpaqueBackground) {
        backgroundColor = this.dataTypes.parseRGBA(reader);
      }
      
      // Skip clip actions for now (complex ActionScript data)
      let clipActionsLength = null;
      if (hasClipActions) {
        clipActionsLength = "Present but not parsed";
      }
      
      return {
        tagType: "PlaceObject3",
        description: "Places/modifies a character on the display list with advanced features (Flash 8+)",
        data: {
          flags: {
            // Standard PlaceObject2 flags
            hasClipActions,
            hasClipDepth,
            hasName,
            hasRatio,
            hasColorTransform,
            hasMatrix,
            hasCharacter,
            hasMove,
            // PlaceObject3 specific flags
            hasOpaqueBackground,
            hasVisible,
            hasImage,
            hasClassName,
            hasCacheAsBitmap,
            hasBlendMode,
            hasFilterList,
            reserved
          },
          depth: depth,
          className: className,
          characterId: characterId,
          matrix: matrix,
          matrixFormatted: matrix ? this.dataTypes.formatMatrix(matrix) : null,
          colorTransform: colorTransform,
          ratio: ratio,
          name: name,
          clipDepth: clipDepth,
          filterList: filterList,
          blendMode: blendMode,
          cacheAsBitmap: cacheAsBitmap,
          visible: visible,
          backgroundColor: backgroundColor,
          backgroundColorFormatted: backgroundColor ? this.dataTypes.formatColor(backgroundColor) : null,
          clipActionsLength: clipActionsLength,
          isMove: hasMove,
          isNewPlacement: hasCharacter,
          advancedFeatures: {
            hasFilters: hasFilterList,
            hasBlending: hasBlendMode,
            hasCaching: hasCacheAsBitmap,
            hasVisibilityControl: hasVisible,
            hasBackground: hasOpaqueBackground,
            complexity: this.calculatePlaceObject3Complexity(hasFilterList, hasBlendMode, hasCacheAsBitmap)
          },
          version: 3
        }
      };
      
    } catch (error) {
      return {
        tagType: "PlaceObject3",
        description: "Places/modifies a character on the display list with advanced features (Flash 8+)",
        error: `Parse error: ${error.message}`,
        data: {}
      };
    }
  }
  
  parseRemoveObject2(reader, length) {
    try {
      if (length !== 2) {
        return {
          tagType: "RemoveObject2",
          description: "Removes a character from the display list by depth",
          error: `Invalid length: expected 2 bytes, got ${length} bytes`,
          data: {}
        };
      }
      
      const depth = this.dataTypes.parseUI16(reader);
      
      return {
        tagType: "RemoveObject2",
        description: "Removes a character from the display list by depth",
        data: {
          depth: depth,
          note: "Removes whatever character is at this depth"
        }
      };
      
    } catch (error) {
      return {
        tagType: "RemoveObject2",
        description: "Removes a character from the display list by depth",
        error: `Parse error: ${error.message}`,
        data: {}
      };
    }
  }
  
  parseUnknownDisplayTag(tagType, reader, length) {
    const data = [];
    
    // Read raw bytes (limited to prevent memory issues)
    const bytesToRead = Math.min(length, 32);
    for (let i = 0; i < bytesToRead; i++) {
      data.push(this.dataTypes.parseUI8(reader));
    }
    
    return {
      tagType: `Unknown Display Tag ${tagType}`,
      description: "Unknown or unsupported display list tag",
      data: {
        rawBytes: data,
        totalLength: length,
        truncated: length > 32,
        note: length > 32 ? "Data truncated to first 32 bytes" : "Complete data shown"
      }
    };
  }
  
  // ==================== PLACEOBJECT3 FILTER PARSING ====================
  
  parseFilterList(reader) {
    try {
      const numberOfFilters = this.dataTypes.parseUI8(reader);
      const filters = [];
      
      for (let i = 0; i < Math.min(numberOfFilters, 10); i++) { // Limit for performance
        const filter = this.parseFilter(reader);
        filters.push(filter);
      }
      
      return {
        numberOfFilters: numberOfFilters,
        filters: filters,
        truncated: numberOfFilters > 10,
        complexity: numberOfFilters > 3 ? "complex" : numberOfFilters > 1 ? "moderate" : "simple"
      };
      
    } catch (error) {
      return {
        numberOfFilters: 0,
        filters: [],
        parseError: error.message
      };
    }
  }
  
  parseFilter(reader) {
    try {
      const filterId = this.dataTypes.parseUI8(reader);
      
      switch (filterId) {
        case 0: // Drop Shadow Filter
          return this.parseDropShadowFilter(reader);
        case 1: // Blur Filter  
          return this.parseBlurFilter(reader);
        case 2: // Glow Filter
          return this.parseGlowFilter(reader);
        case 3: // Bevel Filter
          return this.parseBevelFilter(reader);
        case 4: // Gradient Glow Filter
          return this.parseGradientGlowFilter(reader);
        case 5: // Convolution Filter
          return this.parseConvolutionFilter(reader);
        case 6: // Color Matrix Filter
          return this.parseColorMatrixFilter(reader);
        case 7: // Gradient Bevel Filter
          return this.parseGradientBevelFilter(reader);
        default:
          return {
            type: "unknown",
            filterId: filterId,
            note: "Unsupported filter type"
          };
      }
      
    } catch (error) {
      return {
        type: "error",
        parseError: error.message
      };
    }
  }
  
  parseDropShadowFilter(reader) {
    const dropShadowColor = this.dataTypes.parseRGBA(reader);
    const blurX = this.dataTypes.parseFIXED(reader);
    const blurY = this.dataTypes.parseFIXED(reader);
    const angle = this.dataTypes.parseFIXED(reader);
    const distance = this.dataTypes.parseFIXED(reader);
    const strength = this.dataTypes.parseFIXED8(reader);
    const flags = this.dataTypes.parseUI8(reader);
    
    const innerShadow = (flags & 0x80) !== 0;
    const knockout = (flags & 0x40) !== 0;
    const compositeSource = (flags & 0x20) !== 0;
    const passes = flags & 0x1F;
    
    return {
      type: "drop_shadow",
      color: dropShadowColor,
      colorFormatted: this.dataTypes.formatColor(dropShadowColor),
      blurX: blurX,
      blurY: blurY,
      angle: angle,
      distance: distance,
      strength: strength,
      innerShadow: innerShadow,
      knockout: knockout,
      compositeSource: compositeSource,
      passes: passes
    };
  }
  
  parseBlurFilter(reader) {
    const blurX = this.dataTypes.parseFIXED(reader);
    const blurY = this.dataTypes.parseFIXED(reader);
    const flags = this.dataTypes.parseUI8(reader);
    
    const passes = flags & 0x1F;
    
    return {
      type: "blur",
      blurX: blurX,
      blurY: blurY,
      passes: passes,
      quality: passes > 2 ? "high" : passes > 1 ? "medium" : "low"
    };
  }
  
  parseGlowFilter(reader) {
    const glowColor = this.dataTypes.parseRGBA(reader);
    const blurX = this.dataTypes.parseFIXED(reader);
    const blurY = this.dataTypes.parseFIXED(reader);
    const strength = this.dataTypes.parseFIXED8(reader);
    const flags = this.dataTypes.parseUI8(reader);
    
    const innerGlow = (flags & 0x80) !== 0;
    const knockout = (flags & 0x40) !== 0;
    const compositeSource = (flags & 0x20) !== 0;
    const passes = flags & 0x1F;
    
    return {
      type: "glow",
      color: glowColor,
      colorFormatted: this.dataTypes.formatColor(glowColor),
      blurX: blurX,
      blurY: blurY,
      strength: strength,
      innerGlow: innerGlow,
      knockout: knockout,
      compositeSource: compositeSource,
      passes: passes
    };
  }
  
  parseBevelFilter(reader) {
    const shadowColor = this.dataTypes.parseRGBA(reader);
    const highlightColor = this.dataTypes.parseRGBA(reader);
    const blurX = this.dataTypes.parseFIXED(reader);
    const blurY = this.dataTypes.parseFIXED(reader);
    const angle = this.dataTypes.parseFIXED(reader);
    const distance = this.dataTypes.parseFIXED(reader);
    const strength = this.dataTypes.parseFIXED8(reader);
    const flags = this.dataTypes.parseUI8(reader);
    
    const innerShadow = (flags & 0x80) !== 0;
    const knockout = (flags & 0x40) !== 0;
    const compositeSource = (flags & 0x20) !== 0;
    const onTop = (flags & 0x10) !== 0;
    const passes = flags & 0x0F;
    
    return {
      type: "bevel",
      shadowColor: shadowColor,
      shadowColorFormatted: this.dataTypes.formatColor(shadowColor),
      highlightColor: highlightColor,
      highlightColorFormatted: this.dataTypes.formatColor(highlightColor),
      blurX: blurX,
      blurY: blurY,
      angle: angle,
      distance: distance,
      strength: strength,
      innerShadow: innerShadow,
      knockout: knockout,
      compositeSource: compositeSource,
      onTop: onTop,
      passes: passes
    };
  }
  
  parseGradientGlowFilter(reader) {
    const numColors = this.dataTypes.parseUI8(reader);
    const gradientColors = [];
    
    for (let i = 0; i < Math.min(numColors, 15); i++) {
      gradientColors.push(this.dataTypes.parseRGBA(reader));
    }
    
    const gradientRatios = [];
    for (let i = 0; i < Math.min(numColors, 15); i++) {
      gradientRatios.push(this.dataTypes.parseUI8(reader));
    }
    
    const blurX = this.dataTypes.parseFIXED(reader);
    const blurY = this.dataTypes.parseFIXED(reader);
    const angle = this.dataTypes.parseFIXED(reader);
    const distance = this.dataTypes.parseFIXED(reader);
    const strength = this.dataTypes.parseFIXED8(reader);
    const flags = this.dataTypes.parseUI8(reader);
    
    const innerGlow = (flags & 0x80) !== 0;
    const knockout = (flags & 0x40) !== 0;
    const compositeSource = (flags & 0x20) !== 0;
    const onTop = (flags & 0x10) !== 0;
    const passes = flags & 0x0F;
    
    return {
      type: "gradient_glow",
      numColors: numColors,
      gradientColors: gradientColors.map(color => this.dataTypes.formatColor(color)),
      gradientRatios: gradientRatios,
      blurX: blurX,
      blurY: blurY,
      angle: angle,
      distance: distance,
      strength: strength,
      innerGlow: innerGlow,
      knockout: knockout,
      compositeSource: compositeSource,
      onTop: onTop,
      passes: passes,
      truncated: numColors > 15
    };
  }
  
  parseConvolutionFilter(reader) {
    const matrixX = this.dataTypes.parseUI8(reader);
    const matrixY = this.dataTypes.parseUI8(reader);
    const divisor = this.dataTypes.parseFLOAT(reader);
    const bias = this.dataTypes.parseFLOAT(reader);
    
    const matrixSize = matrixX * matrixY;
    const matrix = [];
    for (let i = 0; i < Math.min(matrixSize, 25); i++) { // Limit matrix size
      matrix.push(this.dataTypes.parseFLOAT(reader));
    }
    
    const defaultColor = this.dataTypes.parseRGBA(reader);
    const flags = this.dataTypes.parseUI8(reader);
    
    const clamp = (flags & 0x02) !== 0;
    const preserveAlpha = (flags & 0x01) !== 0;
    
    return {
      type: "convolution",
      matrixX: matrixX,
      matrixY: matrixY,
      divisor: divisor,
      bias: bias,
      matrix: matrix,
      defaultColor: this.dataTypes.formatColor(defaultColor),
      clamp: clamp,
      preserveAlpha: preserveAlpha,
      truncated: matrixSize > 25
    };
  }
  
  parseColorMatrixFilter(reader) {
    const matrix = [];
    for (let i = 0; i < 20; i++) {
      matrix.push(this.dataTypes.parseFLOAT(reader));
    }
    
    return {
      type: "color_matrix",
      matrix: matrix,
      note: "4x5 color transformation matrix"
    };
  }
  
  parseGradientBevelFilter(reader) {
    const numColors = this.dataTypes.parseUI8(reader);
    const gradientColors = [];
    
    for (let i = 0; i < Math.min(numColors, 15); i++) {
      gradientColors.push(this.dataTypes.parseRGBA(reader));
    }
    
    const gradientRatios = [];
    for (let i = 0; i < Math.min(numColors, 15); i++) {
      gradientRatios.push(this.dataTypes.parseUI8(reader));
    }
    
    const blurX = this.dataTypes.parseFIXED(reader);
    const blurY = this.dataTypes.parseFIXED(reader);
    const angle = this.dataTypes.parseFIXED(reader);
    const distance = this.dataTypes.parseFIXED(reader);
    const strength = this.dataTypes.parseFIXED8(reader);
    const flags = this.dataTypes.parseUI8(reader);
    
    const innerShadow = (flags & 0x80) !== 0;
    const knockout = (flags & 0x40) !== 0;
    const compositeSource = (flags & 0x20) !== 0;
    const onTop = (flags & 0x10) !== 0;
    const passes = flags & 0x0F;
    
    return {
      type: "gradient_bevel",
      numColors: numColors,
      gradientColors: gradientColors.map(color => this.dataTypes.formatColor(color)),
      gradientRatios: gradientRatios,
      blurX: blurX,
      blurY: blurY,
      angle: angle,
      distance: distance,
      strength: strength,
      innerShadow: innerShadow,
      knockout: knockout,
      compositeSource: compositeSource,
      onTop: onTop,
      passes: passes,
      truncated: numColors > 15
    };
  }
  
  // ==================== UTILITY METHODS ====================
  
  estimateMatrixBits(matrix) {
    // Rough estimation of matrix bits for PlaceObject parsing
    // This is approximate since we need to reverse-engineer the bit count
    let bits = 1; // HasScale flag
    
    if (matrix.scaleX !== 1.0 || matrix.scaleY !== 1.0) {
      bits += 5; // NScaleBits
      bits += 32; // Scale values (estimated)
    }
    
    bits += 1; // HasRotate flag
    
    if (matrix.rotateSkew0 !== 0.0 || matrix.rotateSkew1 !== 0.0) {
      bits += 5; // NRotateBits  
      bits += 32; // Rotate values (estimated)
    }
    
    bits += 5; // NTranslateBits
    bits += 32; // Translate values (estimated)
    
    return bits;
  }
  
  getBlendModeName(blendMode) {
    const blendModes = {
      0: "normal",
      1: "normal",
      2: "layer", 
      3: "multiply",
      4: "screen",
      5: "lighten",
      6: "darken",
      7: "difference",
      8: "add",
      9: "subtract",
      10: "invert",
      11: "alpha",
      12: "erase",
      13: "overlay",
      14: "hardlight"
    };
    
    return blendModes[blendMode] || `unknown(${blendMode})`;
  }
  
  calculatePlaceObject3Complexity(hasFilters, hasBlendMode, hasCacheAsBitmap) {
    let complexity = 0;
    
    if (hasFilters) complexity += 3;
    if (hasBlendMode) complexity += 2;
    if (hasCacheAsBitmap) complexity += 1;
    
    if (complexity >= 5) return "very_complex";
    if (complexity >= 3) return "complex";
    if (complexity >= 1) return "moderate";
    return "simple";
  }
  
  formatTagOutput(parsedTag) {
    const lines = [];
    lines.push(`  └─ ${parsedTag.description}`);
    
    if (parsedTag.error) {
      lines.push(`  └─ ERROR: ${parsedTag.error}`);
    }
    
    // Format specific data based on tag type
    if (parsedTag.data) {
      switch (parsedTag.tagType) {
        case "PlaceObject":
          lines.push(`  └─ Character ID: ${parsedTag.data.characterId}`);
          lines.push(`  └─ Depth: ${parsedTag.data.depth}`);
          if (parsedTag.data.matrixFormatted) {
            lines.push(`  └─ Transform: ${parsedTag.data.matrixFormatted}`);
          }
          if (parsedTag.data.hasColorTransform) {
            lines.push(`  └─ Has Color Transform: Yes`);
          }
          break;
          
        case "RemoveObject":
          lines.push(`  └─ Character ID: ${parsedTag.data.characterId}`);
          lines.push(`  └─ Depth: ${parsedTag.data.depth}`);
          break;
          
        case "PlaceObject2":
          const data2 = parsedTag.data;
          if (data2.isMove) {
            lines.push(`  └─ Action: Move existing character`);
          } else if (data2.isNewPlacement) {
            lines.push(`  └─ Action: Place new character`);
            lines.push(`  └─ Character ID: ${data2.characterId}`);
          } else {
            lines.push(`  └─ Action: Modify existing character`);
          }
          lines.push(`  └─ Depth: ${data2.depth}`);
          
          if (data2.name) {
            lines.push(`  └─ Instance Name: "${data2.name}"`);
          }
          
          if (data2.matrixFormatted) {
            lines.push(`  └─ Transform: ${data2.matrixFormatted}`);
          }
          
          if (data2.ratio !== null) {
            lines.push(`  └─ Ratio: ${data2.ratio}`);
          }
          
          if (data2.clipDepth !== null) {
            lines.push(`  └─ Clip Depth: ${data2.clipDepth}`);
          }
          
          if (data2.flags.hasColorTransform) {
            lines.push(`  └─ Has Color Transform: Yes`);
          }
          
          if (data2.flags.hasClipActions) {
            lines.push(`  └─ Has Clip Actions: Yes`);
          }
          break;
          
        case "PlaceObject3":
          const data3 = parsedTag.data;
          if (data3.isMove) {
            lines.push(`  └─ Action: Move existing character`);
          } else if (data3.isNewPlacement) {
            lines.push(`  └─ Action: Place new character`);
            lines.push(`  └─ Character ID: ${data3.characterId}`);
          } else {
            lines.push(`  └─ Action: Modify existing character`);
          }
          lines.push(`  └─ Depth: ${data3.depth}`);
          lines.push(`  └─ Version: 3 (Flash Player 8+)`);
          
          if (data3.className) {
            lines.push(`  └─ Class Name: "${data3.className}"`);
          }
          
          if (data3.name) {
            lines.push(`  └─ Instance Name: "${data3.name}"`);
          }
          
          if (data3.matrixFormatted) {
            lines.push(`  └─ Transform: ${data3.matrixFormatted}`);
          }
          
          if (data3.blendMode) {
            lines.push(`  └─ Blend Mode: ${data3.blendMode}`);
          }
          
          if (data3.cacheAsBitmap !== null) {
            lines.push(`  └─ Cache as Bitmap: ${data3.cacheAsBitmap ? 'Yes' : 'No'}`);
          }
          
          if (data3.visible !== null) {
            lines.push(`  └─ Visible: ${data3.visible ? 'Yes' : 'No'}`);
          }
          
          if (data3.backgroundColorFormatted) {
            lines.push(`  └─ Background Color: ${data3.backgroundColorFormatted}`);
          }
          
          if (data3.filterList && data3.filterList.numberOfFilters > 0) {
            lines.push(`  └─ Filters: ${data3.filterList.numberOfFilters} (${data3.filterList.complexity})`);
            data3.filterList.filters.slice(0, 3).forEach((filter, index) => {
              lines.push(`    • Filter ${index + 1}: ${filter.type}`);
            });
            if (data3.filterList.numberOfFilters > 3) {
              lines.push(`    • ... and ${data3.filterList.numberOfFilters - 3} more`);
            }
          }
          
          if (data3.advancedFeatures.complexity !== "simple") {
            lines.push(`  └─ Complexity: ${data3.advancedFeatures.complexity}`);
          }
          break;
          
        case "RemoveObject2":
          lines.push(`  └─ Depth: ${parsedTag.data.depth}`);
          if (parsedTag.data.note) {
            lines.push(`  └─ ${parsedTag.data.note}`);
          }
          break;
          
        default:
          if (parsedTag.data.note) {
            lines.push(`  └─ ${parsedTag.data.note}`);
          }
          break;
      }
    }
    
    return lines.join('\n');
  }
}

// Export for use by other parsers
window.DisplayParsers = DisplayParsers;
