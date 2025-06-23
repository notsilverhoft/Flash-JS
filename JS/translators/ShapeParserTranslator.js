/* 
 * SWF Shape Parser Translator - v1.0
 * Converts parsed shape data from ShapeParsers.js into WebGL-ready rendering commands
 * Handles coordinate transformation, style conversion, and path optimization
 * Part of the Flash-JS rendering pipeline translation layer
 */
class ShapeParserTranslator {
  constructor() {
    this.output = [];
    this.twipsToPixels = 1 / 20; // SWF uses twips (1/20th pixel)
  }

  // ==================== MAIN TRANSLATION ENTRY POINT ====================
  
  translateShapeData(parsedShapeData) {
    try {
      this.output = [];
      this.output.push("Shape Translation Results:");
      this.output.push("==========================");

      if (!parsedShapeData || !parsedShapeData.data) {
        this.output.push("Error: No shape data provided for translation");
        return {
          success: false,
          error: "No shape data provided",
          output: this.output.join('\n'),
          renderCommands: []
        };
      }

      const data = parsedShapeData.data;
      
      // Translate basic shape properties
      const translatedShape = {
        shapeId: data.shapeId,
        tagType: parsedShapeData.tagType,
        version: data.version || 1,
        bounds: this.translateBounds(data.bounds),
        edgeBounds: data.edgeBounds ? this.translateBounds(data.edgeBounds) : null,
        hasTransparency: data.hasTransparency || false,
        complexity: data.complexity || "simple"
      };

      this.output.push(`Translating ${parsedShapeData.tagType} (ID: ${data.shapeId})`);
      this.output.push(`Version: ${translatedShape.version}`);
      this.output.push(`Bounds: ${translatedShape.bounds.width}×${translatedShape.bounds.height} px`);

      // Translate fill styles into WebGL-compatible formats
      const fillStyles = this.translateFillStyles(data.fillStyles, data.version);
      this.output.push(`Fill Styles: ${fillStyles.length} translated`);

      // Translate line styles into WebGL-compatible formats
      const lineStyles = this.translateLineStyles(data.lineStyles, data.version);
      this.output.push(`Line Styles: ${lineStyles.length} translated`);

      // Translate shape records into drawable path commands
      const pathCommands = this.translateShapeRecords(data.shapeRecords, fillStyles, lineStyles);
      this.output.push(`Path Commands: ${pathCommands.length} generated`);

      // Generate optimized render commands
      const renderCommands = this.generateRenderCommands(translatedShape, fillStyles, lineStyles, pathCommands);
      this.output.push(`Render Commands: ${renderCommands.length} optimized operations`);

      // Advanced features for DefineShape4
      if (data.version >= 4) {
        this.output.push("Advanced Features:");
        if (data.usesFillWindingRule) {
          this.output.push("  • Fill winding rule enabled");
        }
        if (data.usesNonScalingStrokes) {
          this.output.push("  • Non-scaling strokes enabled");
        }
        if (data.usesScalingStrokes) {
          this.output.push("  • Scaling strokes enabled");
        }
      }

      this.output.push("Translation completed successfully");

      return {
        success: true,
        translatedShape: translatedShape,
        fillStyles: fillStyles,
        lineStyles: lineStyles,
        pathCommands: pathCommands,
        renderCommands: renderCommands,
        output: this.output.join('\n'),
        optimizationHints: this.generateOptimizationHints(translatedShape, pathCommands)
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

  // ==================== COORDINATE TRANSFORMATION ====================

  translateBounds(bounds) {
    if (!bounds) return null;

    const pixelBounds = {
      xMin: bounds.xMin * this.twipsToPixels,
      yMin: bounds.yMin * this.twipsToPixels,
      xMax: bounds.xMax * this.twipsToPixels,
      yMax: bounds.yMax * this.twipsToPixels
    };

    return {
      ...pixelBounds,
      width: pixelBounds.xMax - pixelBounds.xMin,
      height: pixelBounds.yMax - pixelBounds.yMin,
      centerX: (pixelBounds.xMin + pixelBounds.xMax) / 2,
      centerY: (pixelBounds.yMin + pixelBounds.yMax) / 2
    };
  }

  translateCoordinate(x, y) {
    return {
      x: x * this.twipsToPixels,
      y: y * this.twipsToPixels
    };
  }

  translateMatrix(matrix) {
    if (!matrix) return null;

    // Convert SWF matrix to WebGL-compatible 2D transformation matrix
    return {
      scaleX: matrix.scaleX || 1.0,
      scaleY: matrix.scaleY || 1.0,
      rotateSkew0: matrix.rotateSkew0 || 0.0,
      rotateSkew1: matrix.rotateSkew1 || 0.0,
      translateX: (matrix.translateX || 0) * this.twipsToPixels,
      translateY: (matrix.translateY || 0) * this.twipsToPixels,
      // WebGL matrix format (column-major)
      webglMatrix: [
        matrix.scaleX || 1.0, matrix.rotateSkew0 || 0.0, 0,
        matrix.rotateSkew1 || 0.0, matrix.scaleY || 1.0, 0,
        (matrix.translateX || 0) * this.twipsToPixels, 
        (matrix.translateY || 0) * this.twipsToPixels, 1
      ]
    };
  }

  // ==================== FILL STYLE TRANSLATION ====================

  translateFillStyles(fillStylesData, version) {
    if (!fillStylesData || !fillStylesData.styles) {
      return [];
    }

    const translatedStyles = [];

    fillStylesData.styles.forEach((style, index) => {
      const translatedStyle = this.translateFillStyle(style, index, version);
      if (translatedStyle) {
        translatedStyles.push(translatedStyle);
      }
    });

    return translatedStyles;
  }

  translateFillStyle(style, index, version) {
    const baseStyle = {
      index: index,
      originalType: style.type
    };

    switch (style.type) {
      case "solid":
        return {
          ...baseStyle,
          type: "solid",
          color: this.translateColor(style.color),
          webglColor: this.colorToWebGL(style.color),
          hasAlpha: version >= 3 && style.color.a !== undefined
        };

      case "linear_gradient":
      case "radial_gradient":
      case "focal_radial_gradient":
        return {
          ...baseStyle,
          type: style.type,
          matrix: this.translateMatrix(style.matrix),
          gradient: this.translateGradient(style.gradient, version),
          focalPoint: style.focalPoint || 0,
          textureCoords: this.generateGradientTextureCoords(style.type, style.matrix),
          requiresTexture: true
        };

      case "bitmap":
        return {
          ...baseStyle,
          type: "bitmap",
          bitmapId: style.bitmapId,
          matrix: this.translateMatrix(style.matrix),
          repeat: style.repeat || false,
          smoothed: style.smoothed || false,
          textureCoords: this.generateBitmapTextureCoords(style.matrix),
          requiresTexture: true
        };

      default:
        this.output.push(`  Warning: Unsupported fill style type: ${style.type}`);
        return {
          ...baseStyle,
          type: "solid",
          color: { r: 1.0, g: 0.0, b: 1.0, a: 1.0 }, // Magenta fallback
          webglColor: [1.0, 0.0, 1.0, 1.0],
          hasAlpha: false,
          isError: true
        };
    }
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

  colorToWebGL(color) {
    const translated = this.translateColor(color);
    return [translated.r, translated.g, translated.b, translated.a];
  }

  translateGradient(gradient, version) {
    if (!gradient || !gradient.gradientRecords) {
      return { colors: [], ratios: [], spreadMode: "pad" };
    }

    const colors = [];
    const ratios = [];

    gradient.gradientRecords.forEach(record => {
      colors.push(this.colorToWebGL(record.color));
      ratios.push(record.ratio / 255); // Normalize to 0-1 range
    });

    return {
      colors: colors,
      ratios: ratios,
      spreadMode: gradient.spreadMode || "pad",
      interpolationMode: gradient.interpolationMode || "RGB",
      colorStops: gradient.gradientRecords.length
    };
  }

  generateGradientTextureCoords(gradientType, matrix) {
    // Generate texture coordinates for gradient rendering
    const baseCoords = {
      type: gradientType,
      needsMatrix: true,
      textureSize: 256 // Standard gradient texture resolution
    };

    switch (gradientType) {
      case "linear_gradient":
        return {
          ...baseCoords,
          direction: "horizontal", // Can be calculated from matrix
          startPoint: [0, 0.5],
          endPoint: [1, 0.5]
        };

      case "radial_gradient":
        return {
          ...baseCoords,
          center: [0.5, 0.5],
          radius: 0.5,
          aspectRatio: 1.0
        };

      case "focal_radial_gradient":
        return {
          ...baseCoords,
          center: [0.5, 0.5],
          focalPoint: [0.5, 0.5], // Will be adjusted by focalPoint value
          radius: 0.5
        };

      default:
        return baseCoords;
    }
  }

  generateBitmapTextureCoords(matrix) {
    return {
      type: "bitmap",
      needsMatrix: true,
      uvMapping: "standard", // Standard UV coordinates
      transform: this.translateMatrix(matrix)
    };
  }

  // ==================== LINE STYLE TRANSLATION ====================

  translateLineStyles(lineStylesData, version) {
    if (!lineStylesData || !lineStylesData.styles) {
      return [];
    }

    const translatedStyles = [];

    lineStylesData.styles.forEach((style, index) => {
      const translatedStyle = this.translateLineStyle(style, index, version);
      if (translatedStyle) {
        translatedStyles.push(translatedStyle);
      }
    });

    return translatedStyles;
  }

  translateLineStyle(style, index, version) {
    const baseStyle = {
      index: index,
      originalType: style.type,
      width: (style.width || 0) * this.twipsToPixels
    };

    if (style.type === "basic") {
      return {
        ...baseStyle,
        type: "basic",
        color: this.translateColor(style.color),
        webglColor: this.colorToWebGL(style.color),
        hasAlpha: version >= 3 && style.color.a !== undefined,
        caps: "round",
        joins: "round",
        miterLimit: 4.0
      };
    } else if (style.type === "enhanced") {
      return {
        ...baseStyle,
        type: "enhanced",
        startCap: style.startCap || "round",
        endCap: style.endCap || "round",
        join: style.join || "round",
        miterLimit: (style.miterLimitFactor || 4.0) / 256.0,
        fillType: style.fillType ? this.translateFillStyle(style.fillType, -1, version) : null,
        flags: style.flags || {},
        pixelHinting: style.flags && style.flags.pixelHinting
      };
    }

    return {
      ...baseStyle,
      type: "basic",
      color: { r: 0, g: 0, b: 0, a: 1.0 },
      webglColor: [0, 0, 0, 1],
      hasAlpha: false,
      isError: true
    };
  }

  // ==================== SHAPE RECORD TRANSLATION ====================

  translateShapeRecords(shapeRecordsData, fillStyles, lineStyles) {
    if (!shapeRecordsData || !shapeRecordsData.records) {
      return [];
    }

    const pathCommands = [];
    let currentPosition = { x: 0, y: 0 };
    let currentFillStyle0 = 0;
    let currentFillStyle1 = 0;
    let currentLineStyle = 0;

    shapeRecordsData.records.forEach((record, index) => {
      const command = this.translateShapeRecord(
        record, 
        currentPosition, 
        fillStyles, 
        lineStyles,
        { currentFillStyle0, currentFillStyle1, currentLineStyle }
      );

      if (command) {
        pathCommands.push(command);

        // Update current position for next record
        if (command.endPosition) {
          currentPosition = command.endPosition;
        }

        // Update current styles
        if (command.styleChanges) {
          if (command.styleChanges.fillStyle0 !== undefined) {
            currentFillStyle0 = command.styleChanges.fillStyle0;
          }
          if (command.styleChanges.fillStyle1 !== undefined) {
            currentFillStyle1 = command.styleChanges.fillStyle1;
          }
          if (command.styleChanges.lineStyle !== undefined) {
            currentLineStyle = command.styleChanges.lineStyle;
          }
        }
      }
    });

    return pathCommands;
  }

  translateShapeRecord(record, currentPosition, fillStyles, lineStyles, currentStyles) {
    const baseCommand = {
      index: record.index,
      type: record.type,
      startPosition: { ...currentPosition }
    };

    switch (record.type) {
      case "end":
        return {
          ...baseCommand,
          type: "path_end",
          endPosition: currentPosition
        };

      case "style_change":
        return this.translateStyleChangeRecord(record, currentPosition, currentStyles);

      case "straight_edge":
        const straightEnd = {
          x: currentPosition.x + (record.deltaX * this.twipsToPixels),
          y: currentPosition.y + (record.deltaY * this.twipsToPixels)
        };
        return {
          ...baseCommand,
          type: "line_to",
          endPosition: straightEnd,
          delta: {
            x: record.deltaX * this.twipsToPixels,
            y: record.deltaY * this.twipsToPixels
          },
          length: Math.sqrt(
            Math.pow(record.deltaX * this.twipsToPixels, 2) + 
            Math.pow(record.deltaY * this.twipsToPixels, 2)
          )
        };

      case "curved_edge":
        const controlPoint = {
          x: currentPosition.x + (record.controlDeltaX * this.twipsToPixels),
          y: currentPosition.y + (record.controlDeltaY * this.twipsToPixels)
        };
        const curvedEnd = {
          x: controlPoint.x + (record.anchorDeltaX * this.twipsToPixels),
          y: controlPoint.y + (record.anchorDeltaY * this.twipsToPixels)
        };
        return {
          ...baseCommand,
          type: "curve_to",
          controlPoint: controlPoint,
          endPosition: curvedEnd,
          controlDelta: {
            x: record.controlDeltaX * this.twipsToPixels,
            y: record.controlDeltaY * this.twipsToPixels
          },
          anchorDelta: {
            x: record.anchorDeltaX * this.twipsToPixels,
            y: record.anchorDeltaY * this.twipsToPixels
          }
        };

      case "parse_error":
        return {
          ...baseCommand,
          type: "error",
          error: record.error,
          endPosition: currentPosition
        };

      default:
        return null;
    }
  }

  translateStyleChangeRecord(record, currentPosition, currentStyles) {
    const command = {
      type: "style_change",
      startPosition: { ...currentPosition },
      flags: record.flags,
      styleChanges: {}
    };

    let newPosition = { ...currentPosition };

    // Handle move operation
    if (record.flags && record.flags.moveTo) {
      newPosition = {
        x: record.moveToX * this.twipsToPixels,
        y: record.moveToY * this.twipsToPixels
      };
      command.moveTo = newPosition;
      command.type = "move_to";
    }

    // Handle style changes
    if (record.fillStyle0 !== undefined) {
      command.styleChanges.fillStyle0 = record.fillStyle0;
    }
    if (record.fillStyle1 !== undefined) {
      command.styleChanges.fillStyle1 = record.fillStyle1;
    }
    if (record.lineStyle !== undefined) {
      command.styleChanges.lineStyle = record.lineStyle;
    }

    // Handle new styles (inline style definitions)
    if (record.newFillStyles && record.newFillStyles.styles) {
      command.newFillStyles = this.translateFillStyles(record.newFillStyles, 4);
    }
    if (record.newLineStyles && record.newLineStyles.styles) {
      command.newLineStyles = this.translateLineStyles(record.newLineStyles, 4);
    }

    command.endPosition = newPosition;
    return command;
  }

  // ==================== RENDER COMMAND GENERATION ====================

  generateRenderCommands(translatedShape, fillStyles, lineStyles, pathCommands) {
    const renderCommands = [];

    // Generate setup commands
    renderCommands.push({
      type: "setup_shape",
      shapeId: translatedShape.shapeId,
      bounds: translatedShape.bounds,
      hasTransparency: translatedShape.hasTransparency
    });

    // Generate fill style setup commands
    fillStyles.forEach(style => {
      if (style.requiresTexture) {
        renderCommands.push({
          type: "setup_texture",
          styleIndex: style.index,
          textureType: style.type,
          textureCoords: style.textureCoords,
          gradient: style.gradient
        });
      } else {
        renderCommands.push({
          type: "setup_solid_fill",
          styleIndex: style.index,
          color: style.webglColor
        });
      }
    });

    // Generate line style setup commands
    lineStyles.forEach(style => {
      renderCommands.push({
        type: "setup_line_style",
        styleIndex: style.index,
        width: style.width,
        color: style.webglColor,
        caps: style.caps || "round",
        joins: style.joins || "round",
        miterLimit: style.miterLimit || 4.0
      });
    });

    // Generate path drawing commands
    const optimizedPaths = this.optimizePathCommands(pathCommands);
    optimizedPaths.forEach(path => {
      renderCommands.push({
        type: "draw_path",
        path: path.commands,
        fillStyle0: path.fillStyle0,
        fillStyle1: path.fillStyle1,
        lineStyle: path.lineStyle,
        bounds: path.bounds
      });
    });

    return renderCommands;
  }

  optimizePathCommands(pathCommands) {
    // Group consecutive drawing commands with the same styles
    const optimizedPaths = [];
    let currentPath = null;
    let currentFillStyle0 = 0;
    let currentFillStyle1 = 0;
    let currentLineStyle = 0;

    pathCommands.forEach(command => {
      if (command.type === "style_change" || command.type === "move_to") {
        // Finish current path if exists
        if (currentPath && currentPath.commands.length > 0) {
          currentPath.bounds = this.calculatePathBounds(currentPath.commands);
          optimizedPaths.push(currentPath);
        }

        // Start new path
        currentPath = {
          commands: [],
          fillStyle0: currentFillStyle0,
          fillStyle1: currentFillStyle1,
          lineStyle: currentLineStyle
        };

        // Update current styles
        if (command.styleChanges) {
          if (command.styleChanges.fillStyle0 !== undefined) {
            currentFillStyle0 = command.styleChanges.fillStyle0;
            currentPath.fillStyle0 = currentFillStyle0;
          }
          if (command.styleChanges.fillStyle1 !== undefined) {
            currentFillStyle1 = command.styleChanges.fillStyle1;
            currentPath.fillStyle1 = currentFillStyle1;
          }
          if (command.styleChanges.lineStyle !== undefined) {
            currentLineStyle = command.styleChanges.lineStyle;
            currentPath.lineStyle = currentLineStyle;
          }
        }

        // Add move command if present
        if (command.moveTo) {
          currentPath.commands.push({
            type: "move_to",
            position: command.moveTo
          });
        }
      } else if (command.type === "line_to" || command.type === "curve_to") {
        // Ensure we have a current path
        if (!currentPath) {
          currentPath = {
            commands: [],
            fillStyle0: currentFillStyle0,
            fillStyle1: currentFillStyle1,
            lineStyle: currentLineStyle
          };
        }

        currentPath.commands.push({
          type: command.type,
          endPosition: command.endPosition,
          controlPoint: command.controlPoint,
          length: command.length
        });
      }
    });

    // Add final path
    if (currentPath && currentPath.commands.length > 0) {
      currentPath.bounds = this.calculatePathBounds(currentPath.commands);
      optimizedPaths.push(currentPath);
    }

    return optimizedPaths;
  }

  calculatePathBounds(commands) {
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    commands.forEach(command => {
      if (command.endPosition) {
        minX = Math.min(minX, command.endPosition.x);
        minY = Math.min(minY, command.endPosition.y);
        maxX = Math.max(maxX, command.endPosition.x);
        maxY = Math.max(maxY, command.endPosition.y);
      }
      if (command.controlPoint) {
        minX = Math.min(minX, command.controlPoint.x);
        minY = Math.min(minY, command.controlPoint.y);
        maxX = Math.max(maxX, command.controlPoint.x);
        maxY = Math.max(maxY, command.controlPoint.y);
      }
      if (command.position) {
        minX = Math.min(minX, command.position.x);
        minY = Math.min(minY, command.position.y);
        maxX = Math.max(maxX, command.position.x);
        maxY = Math.max(maxY, command.position.y);
      }
    });

    return {
      xMin: minX === Infinity ? 0 : minX,
      yMin: minY === Infinity ? 0 : minY,
      xMax: maxX === -Infinity ? 0 : maxX,
      yMax: maxY === -Infinity ? 0 : maxY,
      width: (maxX === -Infinity || minX === Infinity) ? 0 : maxX - minX,
      height: (maxY === -Infinity || minY === Infinity) ? 0 : maxY - minY
    };
  }

  // ==================== OPTIMIZATION HINTS ====================

  generateOptimizationHints(translatedShape, pathCommands) {
    const hints = [];

    // Complexity analysis
    const totalCommands = pathCommands.length;
    const curveCommands = pathCommands.filter(cmd => cmd.type === "curve_to").length;
    const lineCommands = pathCommands.filter(cmd => cmd.type === "line_to").length;

    if (totalCommands > 100) {
      hints.push("High path complexity - consider tessellation for better performance");
    }

    if (curveCommands > lineCommands) {
      hints.push("Curve-heavy shape - may benefit from curve approximation");
    }

    // Rendering hints
    if (translatedShape.hasTransparency) {
      hints.push("Shape uses transparency - requires alpha blending");
    }

    if (translatedShape.bounds && translatedShape.bounds.width * translatedShape.bounds.height > 1000000) {
      hints.push("Large shape bounds - consider level-of-detail optimization");
    }

    return hints;
  }

  // ==================== DEBUG OUTPUT ====================

  getDebugOutput() {
    return this.output.join('\n');
  }
}

// Export for use by rendering pipeline
window.ShapeParserTranslator = ShapeParserTranslator;
