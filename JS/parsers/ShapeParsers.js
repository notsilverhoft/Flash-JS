/* 
 * SWF Shape Definition Tags Parser - v1.2
 * Handles shape definition tags that define vector graphics
 * DefineShape (2), DefineShape2 (22), DefineShape3 (32), DefineShape4 (83)
 * FIXED: Corrected formatRect to formatRECT method name
 * RESTORED: All original functionality that was accidentally truncated
 */
class ShapeParsers {
  constructor() {
    this.dataTypes = new SWFDataTypes();
    
    // Fill type constants
    this.fillTypes = {
      0x00: "Solid Color",
      0x10: "Linear Gradient",
      0x12: "Radial Gradient", 
      0x13: "Focal Radial Gradient",
      0x40: "Repeating Bitmap",
      0x41: "Clipped Bitmap",
      0x42: "Non-smoothed Repeating Bitmap",
      0x43: "Non-smoothed Clipped Bitmap"
    };
    
    // Line cap styles
    this.capStyles = {
      0: "Round",
      1: "None", 
      2: "Square"
    };
    
    // Line join styles
    this.joinStyles = {
      0: "Round",
      1: "Bevel",
      2: "Miter"
    };

    // Shape record types for analysis
    this.shapeRecordTypes = {
      0: "StyleChange",
      1: "StraightEdge", 
      2: "CurvedEdge",
      3: "EndShape"
    };

    // Gradient spread modes
    this.spreadModes = {
      0: "Pad",
      1: "Reflect", 
      2: "Repeat",
      3: "Reserved"
    };

    // Gradient interpolation modes
    this.interpolationModes = {
      0: "RGB",
      1: "Linear RGB",
      2: "Reserved",
      3: "Reserved"
    };
  }
  
  // ==================== TAG PARSING DISPATCHER ====================
  
  parseTag(tagType, tagData, offset, length) {
    const reader = new BitReader(tagData, offset);
    
    switch (tagType) {
      case 2:
        return this.parseDefineShape(reader, length);
      case 22:
        return this.parseDefineShape2(reader, length);
      case 32:
        return this.parseDefineShape3(reader, length);
      case 83:
        return this.parseDefineShape4(reader, length);
      default:
        return this.parseUnknownShapeTag(tagType, reader, length);
    }
  }
  
  // ==================== SHAPE TAG PARSERS ====================
  
  parseDefineShape(reader, length) {
    try {
      const shapeId = this.dataTypes.parseUI16(reader);
      const shapeBounds = this.dataTypes.parseRECT(reader);
      
      // Parse shape styles and records
      const shapeData = this.parseShapeWithStyle(reader, 1); // Shape version 1
      
      return {
        tagType: "DefineShape",
        description: "Defines a vector shape with basic styling",
        data: {
          shapeId: shapeId,
          bounds: this.dataTypes.formatRECT(shapeBounds),
          fillStyles: shapeData.fillStyles,
          lineStyles: shapeData.lineStyles,
          shapeRecords: shapeData.shapeRecords,
          complexity: this.analyzeShapeComplexity(shapeData),
          version: 1,
          features: {
            alpha: false,
            enhancedStrokes: false,
            gradientInterpolation: false,
            extendedColors: false,
            edgeBounds: false
          },
          capabilities: this.getShapeCapabilities(1),
          performance: this.estimatePerformance(shapeData),
          renderingHints: this.generateRenderingHints(shapeData, 1)
        }
      };
      
    } catch (error) {
      return {
        tagType: "DefineShape",
        description: "Defines a vector shape with basic styling",
        error: `Parse error: ${error.message}`,
        data: {}
      };
    }
  }
  
  parseDefineShape2(reader, length) {
    try {
      const shapeId = this.dataTypes.parseUI16(reader);
      const shapeBounds = this.dataTypes.parseRECT(reader);
      
      // Parse shape styles and records
      const shapeData = this.parseShapeWithStyle(reader, 2); // Shape version 2
      
      return {
        tagType: "DefineShape2",
        description: "Defines a vector shape with enhanced styling (supports more colors)",
        data: {
          shapeId: shapeId,
          bounds: this.dataTypes.formatRECT(shapeBounds),
          fillStyles: shapeData.fillStyles,
          lineStyles: shapeData.lineStyles,
          shapeRecords: shapeData.shapeRecords,
          complexity: this.analyzeShapeComplexity(shapeData),
          version: 2,
          features: {
            alpha: false,
            enhancedStrokes: false,
            gradientInterpolation: false,
            extendedColors: true,
            edgeBounds: false
          },
          capabilities: this.getShapeCapabilities(2),
          performance: this.estimatePerformance(shapeData),
          renderingHints: this.generateRenderingHints(shapeData, 2)
        }
      };
      
    } catch (error) {
      return {
        tagType: "DefineShape2",
        description: "Defines a vector shape with enhanced styling (supports more colors)",
        error: `Parse error: ${error.message}`,
        data: {}
      };
    }
  }
  
  parseDefineShape3(reader, length) {
    try {
      const shapeId = this.dataTypes.parseUI16(reader);
      const shapeBounds = this.dataTypes.parseRECT(reader);
      
      // Parse shape styles and records
      const shapeData = this.parseShapeWithStyle(reader, 3); // Shape version 3
      
      return {
        tagType: "DefineShape3",
        description: "Defines a vector shape with alpha transparency support",
        data: {
          shapeId: shapeId,
          bounds: this.dataTypes.formatRECT(shapeBounds),
          fillStyles: shapeData.fillStyles,
          lineStyles: shapeData.lineStyles,
          shapeRecords: shapeData.shapeRecords,
          complexity: this.analyzeShapeComplexity(shapeData),
          version: 3,
          features: {
            alpha: true,
            enhancedStrokes: false,
            gradientInterpolation: false,
            extendedColors: true,
            edgeBounds: false
          },
          capabilities: this.getShapeCapabilities(3),
          performance: this.estimatePerformance(shapeData),
          renderingHints: this.generateRenderingHints(shapeData, 3),
          alphaAnalysis: this.analyzeAlphaUsage(shapeData)
        }
      };
      
    } catch (error) {
      return {
        tagType: "DefineShape3",
        description: "Defines a vector shape with alpha transparency support",
        error: `Parse error: ${error.message}`,
        data: {}
      };
    }
  }
  
  parseDefineShape4(reader, length) {
    try {
      const shapeId = this.dataTypes.parseUI16(reader);
      const shapeBounds = this.dataTypes.parseRECT(reader);
      const edgeBounds = this.dataTypes.parseRECT(reader);
      
      // Parse flags
      const flags = this.dataTypes.parseUI8(reader);
      const usesNonScalingStrokes = (flags & 0x01) !== 0;
      const usesScalingStrokes = (flags & 0x02) !== 0;
      
      // Parse shape styles and records
      const shapeData = this.parseShapeWithStyle(reader, 4); // Shape version 4
      
      return {
        tagType: "DefineShape4",
        description: "Defines a vector shape with advanced stroke options",
        data: {
          shapeId: shapeId,
          bounds: this.dataTypes.formatRECT(shapeBounds),
          edgeBounds: this.dataTypes.formatRECT(edgeBounds),
          fillStyles: shapeData.fillStyles,
          lineStyles: shapeData.lineStyles,
          shapeRecords: shapeData.shapeRecords,
          complexity: this.analyzeShapeComplexity(shapeData),
          strokeFlags: {
            usesNonScalingStrokes: usesNonScalingStrokes,
            usesScalingStrokes: usesScalingStrokes,
            description: this.describeStrokeFlags(usesNonScalingStrokes, usesScalingStrokes)
          },
          version: 4,
          features: {
            alpha: true,
            enhancedStrokes: true,
            gradientInterpolation: true,
            extendedColors: true,
            edgeBounds: true
          },
          capabilities: this.getShapeCapabilities(4),
          performance: this.estimatePerformance(shapeData),
          renderingHints: this.generateRenderingHints(shapeData, 4),
          alphaAnalysis: this.analyzeAlphaUsage(shapeData),
          strokeAnalysis: this.analyzeStrokeComplexity(shapeData)
        }
      };
      
    } catch (error) {
      return {
        tagType: "DefineShape4",
        description: "Defines a vector shape with advanced stroke options",
        error: `Parse error: ${error.message}`,
        data: {}
      };
    }
  }
  
  // ==================== SHAPE PARSING HELPERS ====================
  
  parseShapeWithStyle(reader, shapeVersion) {
    // Parse fill styles
    const fillStyles = this.parseFillStyleArray(reader, shapeVersion);
    
    // Parse line styles
    const lineStyles = this.parseLineStyleArray(reader, shapeVersion);
    
    // Parse shape records
    const shapeRecords = this.parseShapeRecords(reader, shapeVersion, fillStyles.count, lineStyles.count);
    
    return {
      fillStyles: fillStyles,
      lineStyles: lineStyles,
      shapeRecords: shapeRecords
    };
  }
  
  parseFillStyleArray(reader, shapeVersion) {
    let fillStyleCount = this.dataTypes.parseUI8(reader);
    
    // Extended count for large arrays
    if (fillStyleCount === 255) {
      fillStyleCount = this.dataTypes.parseUI16(reader);
    }
    
    const fillStyles = [];
    
    for (let i = 0; i < Math.min(fillStyleCount, 20); i++) {
      const fillStyle = this.parseFillStyle(reader, shapeVersion);
      fillStyles.push(fillStyle);
    }
    
    return {
      count: fillStyleCount,
      styles: fillStyles,
      truncated: fillStyleCount > 20,
      analysis: this.analyzeFillStyles(fillStyles)
    };
  }
  
  parseFillStyle(reader, shapeVersion) {
    const type = this.dataTypes.parseUI8(reader);
    const typeName = this.fillTypes[type] || `Unknown (0x${type.toString(16)})`;
    
    const fillStyle = {
      type: type,
      typeName: typeName,
      index: reader.byteOffset // For debugging
    };
    
    try {
      switch (type) {
        case 0x00: // Solid color
          if (shapeVersion >= 3) {
            fillStyle.color = this.dataTypes.parseRGBA(reader);
          } else {
            fillStyle.color = this.dataTypes.parseRGB(reader);
          }
          fillStyle.colorFormatted = this.dataTypes.formatColor(fillStyle.color);
          fillStyle.colorAnalysis = this.analyzeColor(fillStyle.color);
          break;
          
        case 0x10: // Linear gradient
        case 0x12: // Radial gradient
        case 0x13: // Focal radial gradient (Shape3+)
          fillStyle.gradientMatrix = this.dataTypes.parseMATRIX(reader);
          fillStyle.gradientMatrixFormatted = this.dataTypes.formatMatrix(fillStyle.gradientMatrix);
          fillStyle.gradient = this.parseGradient(reader, shapeVersion);
          if (type === 0x13) {
            fillStyle.focalPoint = this.dataTypes.parseFIXED8(reader);
            fillStyle.focalPointPercent = (fillStyle.focalPoint * 100).toFixed(1) + "%";
          }
          fillStyle.gradientAnalysis = this.analyzeGradient(fillStyle.gradient, type);
          break;
          
        case 0x40: // Repeating bitmap
        case 0x41: // Clipped bitmap
        case 0x42: // Non-smoothed repeating bitmap
        case 0x43: // Non-smoothed clipped bitmap
          fillStyle.bitmapId = this.dataTypes.parseUI16(reader);
          fillStyle.bitmapMatrix = this.dataTypes.parseMATRIX(reader);
          fillStyle.bitmapMatrixFormatted = this.dataTypes.formatMatrix(fillStyle.bitmapMatrix);
          fillStyle.smoothed = (type === 0x40 || type === 0x41);
          fillStyle.repeating = (type === 0x40 || type === 0x42);
          fillStyle.bitmapAnalysis = {
            renderQuality: fillStyle.smoothed ? "smooth" : "pixelated",
            tiling: fillStyle.repeating ? "repeat" : "clamp",
            performance: fillStyle.smoothed ? "slower" : "faster"
          };
          break;
          
        default:
          fillStyle.parseError = `Unknown fill type: 0x${type.toString(16)}`;
          break;
      }
    } catch (error) {
      fillStyle.parseError = error.message;
    }
    
    return fillStyle;
  }
  
  parseLineStyleArray(reader, shapeVersion) {
    let lineStyleCount = this.dataTypes.parseUI8(reader);
    
    // Extended count for large arrays
    if (lineStyleCount === 255) {
      lineStyleCount = this.dataTypes.parseUI16(reader);
    }
    
    const lineStyles = [];
    
    for (let i = 0; i < Math.min(lineStyleCount, 20); i++) {
      const lineStyle = this.parseLineStyle(reader, shapeVersion);
      lineStyles.push(lineStyle);
    }
    
    return {
      count: lineStyleCount,
      styles: lineStyles,
      truncated: lineStyleCount > 20,
      analysis: this.analyzeLineStyles(lineStyles)
    };
  }
  
  parseLineStyle(reader, shapeVersion) {
    const lineStyle = {
      width: this.dataTypes.parseUI16(reader)
    };
    
    try {
      if (shapeVersion >= 4) {
        // Enhanced line style (Shape4)
        const flags = this.dataTypes.parseUI16(reader);
        
        lineStyle.startCapStyle = (flags >> 14) & 0x03;
        lineStyle.joinStyle = (flags >> 12) & 0x03;
        lineStyle.hasFillFlag = (flags & 0x08) !== 0;
        lineStyle.noHScaleFlag = (flags & 0x04) !== 0;
        lineStyle.noVScaleFlag = (flags & 0x02) !== 0;
        lineStyle.pixelHintingFlag = (flags & 0x01) !== 0;
        lineStyle.noClose = (flags & 0x04) !== 0;
        lineStyle.endCapStyle = flags & 0x03;
        
        lineStyle.startCapStyleName = this.capStyles[lineStyle.startCapStyle] || "Unknown";
        lineStyle.endCapStyleName = this.capStyles[lineStyle.endCapStyle] || "Unknown";
        lineStyle.joinStyleName = this.joinStyles[lineStyle.joinStyle] || "Unknown";
        
        if (lineStyle.joinStyle === 2) { // Miter join
          lineStyle.miterLimitFactor = this.dataTypes.parseUI8(reader);
        }
        
        if (lineStyle.hasFillFlag) {
          lineStyle.fillType = this.parseFillStyle(reader, shapeVersion);
        } else {
          lineStyle.color = this.dataTypes.parseRGBA(reader);
          lineStyle.colorFormatted = this.dataTypes.formatColor(lineStyle.color);
        }
        
        lineStyle.enhancedFeatures = {
          variableWidth: lineStyle.noHScaleFlag || lineStyle.noVScaleFlag,
          pixelHinting: lineStyle.pixelHintingFlag,
          complexCaps: lineStyle.startCapStyle !== lineStyle.endCapStyle,
          fillStroke: lineStyle.hasFillFlag
        };
      } else {
        // Basic line style
        if (shapeVersion >= 3) {
          lineStyle.color = this.dataTypes.parseRGBA(reader);
        } else {
          lineStyle.color = this.dataTypes.parseRGB(reader);
        }
        lineStyle.colorFormatted = this.dataTypes.formatColor(lineStyle.color);
      }
      
      // Convert width from twips to pixels
      lineStyle.widthPixels = lineStyle.width / 20;
      lineStyle.widthCategory = this.categorizeLineWidth(lineStyle.widthPixels);
      
    } catch (error) {
      lineStyle.parseError = error.message;
    }
    
    return lineStyle;
  }
  
  parseGradient(reader, shapeVersion) {
    const spreadMode = this.dataTypes.parseUB(reader, 2);
    const interpolationMode = this.dataTypes.parseUB(reader, 2);
    const numGradients = this.dataTypes.parseUB(reader, 4);
    
    const gradientRecords = [];
    
    for (let i = 0; i < Math.min(numGradients, 15); i++) {
      const ratio = this.dataTypes.parseUI8(reader);
      let color;
      
      if (shapeVersion >= 3) {
        color = this.dataTypes.parseRGBA(reader);
      } else {
        color = this.dataTypes.parseRGB(reader);
      }
      
      gradientRecords.push({
        ratio: ratio,
        ratioPercent: (ratio / 255 * 100).toFixed(1),
        color: color,
        colorFormatted: this.dataTypes.formatColor(color)
      });
    }
    
    return {
      spreadMode: spreadMode,
      spreadModeName: this.spreadModes[spreadMode] || "Unknown",
      interpolationMode: interpolationMode,
      interpolationModeName: this.interpolationModes[interpolationMode] || "Unknown",
      numGradients: numGradients,
      gradientRecords: gradientRecords,
      truncated: numGradients > 15,
      gradientRange: this.calculateGradientRange(gradientRecords),
      colorComplexity: this.analyzeGradientColors(gradientRecords)
    };
  }
  
  parseShapeRecords(reader, shapeVersion, fillStyleCount, lineStyleCount) {
    const records = [];
    let recordIndex = 0;
    let currentPosition = { x: 0, y: 0 };
    let pathCount = 0;
    
    // Calculate bit widths for style indices
    const fillBits = fillStyleCount > 0 ? Math.ceil(Math.log2(fillStyleCount + 1)) : 0;
    const lineBits = lineStyleCount > 0 ? Math.ceil(Math.log2(lineStyleCount + 1)) : 0;
    
    // Parse shape records until EndShapeRecord
    while (recordIndex < 500) { // Increased limit for complex shapes
      try {
        const typeFlag = this.dataTypes.parseUB(reader, 1);
        
        if (typeFlag === 0) {
          // Style change record or end record
          const stateNewStyles = this.dataTypes.parseUB(reader, 1);
          const stateLineStyle = this.dataTypes.parseUB(reader, 1);
          const stateFillStyle1 = this.dataTypes.parseUB(reader, 1);
          const stateFillStyle0 = this.dataTypes.parseUB(reader, 1);
          const stateMoveTo = this.dataTypes.parseUB(reader, 1);
          
          if (stateNewStyles === 0 && stateLineStyle === 0 && 
              stateFillStyle1 === 0 && stateFillStyle0 === 0 && stateMoveTo === 0) {
            // End shape record
            records.push({
              type: "EndShape",
              description: "End of shape definition",
              recordIndex: recordIndex
            });
            break;
          }
          
          const record = {
            type: "StyleChange",
            recordIndex: recordIndex,
            stateNewStyles: stateNewStyles,
            stateLineStyle: stateLineStyle,
            stateFillStyle1: stateFillStyle1,
            stateFillStyle0: stateFillStyle0,
            stateMoveTo: stateMoveTo
          };
          
          // Parse move to coordinates
          if (stateMoveTo) {
            const moveBits = this.dataTypes.parseUB(reader, 5);
            record.moveDeltaX = this.dataTypes.parseSB(reader, moveBits);
            record.moveDeltaY = this.dataTypes.parseSB(reader, moveBits);
            record.moveToPixels = {
              x: record.moveDeltaX / 20,
              y: record.moveDeltaY / 20
            };
            currentPosition.x += record.moveDeltaX;
            currentPosition.y += record.moveDeltaY;
            record.absolutePosition = {
              x: currentPosition.x / 20,
              y: currentPosition.y / 20
            };
            pathCount++;
          }
          
          // Parse fill style indices
          if (stateFillStyle0) {
            record.fillStyle0 = this.parseStyleIndex(reader, fillBits);
          }
          if (stateFillStyle1) {
            record.fillStyle1 = this.parseStyleIndex(reader, fillBits);
          }
          if (stateLineStyle) {
            record.lineStyle = this.parseStyleIndex(reader, lineBits);
          }
          
          // Parse new styles if present
          if (stateNewStyles) {
            record.newFillStyles = this.parseFillStyleArray(reader, shapeVersion);
            record.newLineStyles = this.parseLineStyleArray(reader, shapeVersion);
            // Update bit widths for new style counts
            fillStyleCount = record.newFillStyles.count;
            lineStyleCount = record.newLineStyles.count;
          }
          
          records.push(record);
          
        } else {
          // Edge record
          const straightFlag = this.dataTypes.parseUB(reader, 1);
          const numBits = this.dataTypes.parseUB(reader, 4) + 2;
          
          if (straightFlag) {
            // Straight edge record
            const generalLineFlag = this.dataTypes.parseUB(reader, 1);
            const record = {
              type: "StraightEdge",
              recordIndex: recordIndex,
              numBits: numBits
            };
            
            if (generalLineFlag) {
              record.deltaX = this.dataTypes.parseSB(reader, numBits);
              record.deltaY = this.dataTypes.parseSB(reader, numBits);
            } else {
              const vertLineFlag = this.dataTypes.parseUB(reader, 1);
              if (vertLineFlag) {
                record.deltaY = this.dataTypes.parseSB(reader, numBits);
                record.deltaX = 0;
                record.direction = "vertical";
              } else {
                record.deltaX = this.dataTypes.parseSB(reader, numBits);
                record.deltaY = 0;
                record.direction = "horizontal";
              }
            }
            
            record.deltaPixels = {
              x: record.deltaX / 20,
              y: record.deltaY / 20
            };
            
            currentPosition.x += record.deltaX;
            currentPosition.y += record.deltaY;
            record.absolutePosition = {
              x: currentPosition.x / 20,
              y: currentPosition.y / 20
            };
            
            record.length = Math.sqrt(record.deltaX * record.deltaX + record.deltaY * record.deltaY) / 20;
            
            records.push(record);
            
          } else {
            // Curved edge record
            const record = {
              type: "CurvedEdge",
              recordIndex: recordIndex,
              numBits: numBits,
              controlDeltaX: this.dataTypes.parseSB(reader, numBits),
              controlDeltaY: this.dataTypes.parseSB(reader, numBits),
              anchorDeltaX: this.dataTypes.parseSB(reader, numBits),
              anchorDeltaY: this.dataTypes.parseSB(reader, numBits)
            };
            
            record.controlDeltaPixels = {
              x: record.controlDeltaX / 20,
              y: record.controlDeltaY / 20
            };
            record.anchorDeltaPixels = {
              x: record.anchorDeltaX / 20,
              y: record.anchorDeltaY / 20
            };
            
            // Calculate control point position
            const controlX = currentPosition.x + record.controlDeltaX;
            const controlY = currentPosition.y + record.controlDeltaY;
            record.controlPoint = {
              x: controlX / 20,
              y: controlY / 20
            };
            
            // Update current position to anchor point
            currentPosition.x = controlX + record.anchorDeltaX;
            currentPosition.y = controlY + record.anchorDeltaY;
            record.absolutePosition = {
              x: currentPosition.x / 20,
              y: currentPosition.y / 20
            };
            
            // Estimate curve length (approximation)
            const dx1 = record.controlDeltaX;
            const dy1 = record.controlDeltaY;
            const dx2 = record.anchorDeltaX;
            const dy2 = record.anchorDeltaY;
            record.estimatedLength = (Math.sqrt(dx1*dx1 + dy1*dy1) + Math.sqrt(dx2*dx2 + dy2*dy2)) / 20;
            
            records.push(record);
          }
        }
        
        recordIndex++;
        
      } catch (error) {
        records.push({
          type: "ParseError",
          error: error.message,
          recordIndex: recordIndex
        });
        break;
      }
    }
    
    return {
      count: records.length,
      records: records,
      truncated: recordIndex >= 500,
      pathCount: pathCount,
      statistics: this.calculateShapeStatistics(records)
    };
  }
  
  parseStyleIndex(reader, bitWidth) {
    if (bitWidth <= 0) return 0;
    return this.dataTypes.parseUB(reader, Math.min(bitWidth, 16));
  }
  
  // ==================== ANALYSIS METHODS ====================
  
  analyzeShapeComplexity(shapeData) {
    const fillCount = shapeData.fillStyles.count;
    const lineCount = shapeData.lineStyles.count;
    const recordCount = shapeData.shapeRecords.count;
    
    let complexity = "simple";
    let score = 0;
    
    // Calculate complexity score
    score += fillCount * 2;
    score += lineCount * 1;
    score += recordCount * 0.5;
    
    // Check for advanced features
    const hasGradients = shapeData.fillStyles.styles.some(style => 
      style.type === 0x10 || style.type === 0x12 || style.type === 0x13
    );
    const hasBitmaps = shapeData.fillStyles.styles.some(style => 
      style.type >= 0x40 && style.type <= 0x43
    );
    const hasCurves = shapeData.shapeRecords.records.some(record => 
      record.type === "CurvedEdge"
    );
    const hasMultiplePaths = shapeData.shapeRecords.pathCount > 1;
    
    if (hasGradients) score += 10;
    if (hasBitmaps) score += 5;
    if (hasCurves) score += 3;
    if (hasMultiplePaths) score += 2;
    
    if (score < 5) complexity = "simple";
    else if (score < 15) complexity = "moderate";
    else if (score < 30) complexity = "complex";
    else complexity = "very_complex";
    
    return {
      level: complexity,
      score: score,
      features: {
        hasGradients: hasGradients,
        hasBitmaps: hasBitmaps,
        hasCurves: hasCurves,
        hasMultiplePaths: hasMultiplePaths,
        multipleStyles: (fillCount + lineCount) > 3
      },
      counts: {
        fillStyles: fillCount,
        lineStyles: lineCount,
        shapeRecords: recordCount,
        paths: shapeData.shapeRecords.pathCount
      },
      recommendations: this.generateComplexityRecommendations(score, {
        hasGradients, hasBitmaps, hasCurves, hasMultiplePaths
      })
    };
  }

  getShapeCapabilities(version) {
    const capabilities = {
      version: version,
      basicShapes: true,
      solidFills: true,
      basicStrokes: true
    };

    if (version >= 2) {
      capabilities.extendedColors = true;
      capabilities.moreStyleSlots = true;
    }

    if (version >= 3) {
      capabilities.alphaTransparency = true;
      capabilities.alphaGradients = true;
    }

    if (version >= 4) {
      capabilities.enhancedStrokes = true;
      capabilities.strokeCaps = true;
      capabilities.strokeJoins = true;
      capabilities.strokeFills = true;
      capabilities.edgeBounds = true;
      capabilities.scalingControl = true;
    }

    return capabilities;
  }

  estimatePerformance(shapeData) {
    let renderingCost = 0;
    
    // Base cost for fills
    renderingCost += shapeData.fillStyles.count * 2;
    
    // Additional cost for complex fills
    shapeData.fillStyles.styles.forEach(style => {
      if (style.type >= 0x10 && style.type <= 0x13) {
        renderingCost += 5; // Gradients are expensive
      }
      if (style.type >= 0x40 && style.type <= 0x43) {
        renderingCost += 3; // Bitmap fills are moderately expensive
      }
    });
    
    // Cost for strokes
    renderingCost += shapeData.lineStyles.count * 1;
    
    // Cost for shape complexity
    const curveCount = shapeData.shapeRecords.records.filter(r => r.type === "CurvedEdge").length;
    renderingCost += curveCount * 0.5;
    
    const edgeCount = shapeData.shapeRecords.records.filter(r => 
      r.type === "StraightEdge" || r.type === "CurvedEdge"
    ).length;
    renderingCost += edgeCount * 0.1;

    let category = "fast";
    if (renderingCost > 50) category = "slow";
    else if (renderingCost > 20) category = "moderate";

    return {
      renderingCost: Math.round(renderingCost),
      category: category,
      factors: {
        fillComplexity: shapeData.fillStyles.styles.some(s => s.type >= 0x10),
        strokeComplexity: shapeData.lineStyles.count > 3,
        geometricComplexity: curveCount > 10,
        pathComplexity: shapeData.shapeRecords.pathCount > 5
      }
    };
  }

  generateRenderingHints(shapeData, version) {
    const hints = [];
    
    // Check for performance issues
    if (shapeData.fillStyles.count > 10) {
      hints.push("Consider reducing the number of fill styles for better performance");
    }
    
    const gradientCount = shapeData.fillStyles.styles.filter(s => 
      s.type >= 0x10 && s.type <= 0x13
    ).length;
    if (gradientCount > 3) {
      hints.push("Multiple gradients may impact rendering performance");
    }
    
    const bitmapCount = shapeData.fillStyles.styles.filter(s => 
      s.type >= 0x40 && s.type <= 0x43
    ).length;
    if (bitmapCount > 2) {
      hints.push("Multiple bitmap fills increase memory usage");
    }
    
    // Check for compatibility issues
    if (version < 3) {
      const hasAlpha = shapeData.fillStyles.styles.some(s => 
        s.color && s.color.alpha !== undefined && s.color.alpha < 255
      );
      if (hasAlpha) {
        hints.push("Alpha transparency requires Flash Player 6+ (Shape3+)");
      }
    }
    
    return hints;
  }

  analyzeAlphaUsage(shapeData) {
    let hasAlpha = false;
    let minAlpha = 255;
    let maxAlpha = 0;
    let alphaCount = 0;

    shapeData.fillStyles.styles.forEach(style => {
      if (style.color && style.color.alpha !== undefined) {
        hasAlpha = true;
        minAlpha = Math.min(minAlpha, style.color.alpha);
        maxAlpha = Math.max(maxAlpha, style.color.alpha);
        if (style.color.alpha < 255) alphaCount++;
      }
      
      if (style.gradient) {
        style.gradient.gradientRecords.forEach(record => {
          if (record.color.alpha !== undefined) {
            hasAlpha = true;
            minAlpha = Math.min(minAlpha, record.color.alpha);
            maxAlpha = Math.max(maxAlpha, record.color.alpha);
            if (record.color.alpha < 255) alphaCount++;
          }
        });
      }
    });

    return {
      hasAlpha: hasAlpha,
      transparentElements: alphaCount,
      alphaRange: hasAlpha ? {
        min: minAlpha,
        max: maxAlpha,
        minPercent: (minAlpha / 255 * 100).toFixed(1),
        maxPercent: (maxAlpha / 255 * 100).toFixed(1)
      } : null,
      usage: alphaCount === 0 ? "none" : 
             alphaCount < 3 ? "minimal" : 
             alphaCount < 8 ? "moderate" : "extensive"
    };
  }

  analyzeStrokeComplexity(shapeData) {
    let hasEnhancedStrokes = false;
    let hasVariableWidth = false;
    let hasComplexCaps = false;
    let hasStrokeFills = false;

    shapeData.lineStyles.styles.forEach(style => {
      if (style.enhancedFeatures) {
        hasEnhancedStrokes = true;
        if (style.enhancedFeatures.variableWidth) hasVariableWidth = true;
        if (style.enhancedFeatures.complexCaps) hasComplexCaps = true;
        if (style.enhancedFeatures.fillStroke) hasStrokeFills = true;
      }
    });

    return {
      hasEnhancedStrokes: hasEnhancedStrokes,
      features: {
        variableWidth: hasVariableWidth,
        complexCaps: hasComplexCaps,
        fillStrokes: hasStrokeFills
      },
      complexity: hasStrokeFills ? "high" : 
                  hasVariableWidth || hasComplexCaps ? "medium" : "low"
    };
  }

  analyzeFillStyles(fillStyles) {
    const typeCount = {};
    fillStyles.forEach(style => {
      typeCount[style.typeName] = (typeCount[style.typeName] || 0) + 1;
    });

    return {
      typeDistribution: typeCount,
      mostCommon: Object.keys(typeCount).reduce((a, b) => 
        typeCount[a] > typeCount[b] ? a : b, "none"),
      hasAdvancedFills: fillStyles.some(s => s.type >= 0x10)
    };
  }

  analyzeLineStyles(lineStyles) {
    const widths = lineStyles.map(s => s.widthPixels);
    return {
      count: lineStyles.length,
      widthRange: {
        min: Math.min(...widths),
        max: Math.max(...widths),
        average: widths.reduce((a, b) => a + b, 0) / widths.length
      },
      hasVariableWidth: new Set(widths).size > 1
    };
  }

  analyzeColor(color) {
    const r = color.red || 0;
    const g = color.green || 0; 
    const b = color.blue || 0;
    const a = color.alpha !== undefined ? color.alpha : 255;

    return {
      brightness: Math.round((r * 0.299 + g * 0.587 + b * 0.114)),
      saturation: this.calculateSaturation(r, g, b),
      isGrayscale: r === g && g === b,
      isTransparent: a < 255,
      opacity: (a / 255 * 100).toFixed(1) + "%"
    };
  }

  analyzeGradient(gradient, type) {
    return {
      colorStops: gradient.numGradients,
      hasTransparency: gradient.gradientRecords.some(r => 
        r.color.alpha !== undefined && r.color.alpha < 255),
      colorRange: gradient.gradientRecords.length > 1 ? {
        start: gradient.gradientRecords[0].colorFormatted,
        end: gradient.gradientRecords[gradient.gradientRecords.length - 1].colorFormatted
      } : null,
      gradientType: type === 0x10 ? "linear" : 
                   type === 0x12 ? "radial" : 
                   type === 0x13 ? "focal_radial" : "unknown"
    };
  }

  calculateGradientRange(gradientRecords) {
    if (gradientRecords.length < 2) return null;
    
    const ratios = gradientRecords.map(r => r.ratio);
    return {
      start: Math.min(...ratios),
      end: Math.max(...ratios),
      span: Math.max(...ratios) - Math.min(...ratios),
      normalized: gradientRecords.map(r => ({
        position: r.ratioPercent,
        color: r.colorFormatted
      }))
    };
  }

  analyzeGradientColors(gradientRecords) {
    const colors = gradientRecords.map(r => r.color);
    return {
      colorCount: colors.length,
      hasAlpha: colors.some(c => c.alpha !== undefined && c.alpha < 255),
      colorHarmony: this.analyzeColorHarmony(colors)
    };
  }

  calculateShapeStatistics(records) {
    const stats = {
      totalRecords: records.length,
      styleChanges: 0,
      straightEdges: 0,
      curvedEdges: 0,
      moveTos: 0,
      parseErrors: 0
    };

    records.forEach(record => {
      switch (record.type) {
        case "StyleChange":
          stats.styleChanges++;
          if (record.stateMoveTo) stats.moveTos++;
          break;
        case "StraightEdge":
          stats.straightEdges++;
          break;
        case "CurvedEdge":
          stats.curvedEdges++;
          break;
        case "ParseError":
          stats.parseErrors++;
          break;
      }
    });

    stats.totalEdges = stats.straightEdges + stats.curvedEdges;
    stats.curveRatio = stats.totalEdges > 0 ? 
      (stats.curvedEdges / stats.totalEdges * 100).toFixed(1) + "%" : "0%";

    return stats;
  }

  categorizeLineWidth(widthPixels) {
    if (widthPixels < 0.5) return "hairline";
    if (widthPixels < 2) return "thin";
    if (widthPixels < 5) return "medium";
    if (widthPixels < 10) return "thick";
    return "very_thick";
  }

  calculateSaturation(r, g, b) {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const diff = max - min;
    return max === 0 ? 0 : Math.round(diff / max * 100);
  }

  analyzeColorHarmony(colors) {
    if (colors.length < 2) return "single_color";
    
    // Simplified color harmony analysis
    const hues = colors.map(this.rgbToHue);
    const hueDifferences = [];
    
    for (let i = 1; i < hues.length; i++) {
      const diff = Math.abs(hues[i] - hues[i-1]);
      hueDifferences.push(Math.min(diff, 360 - diff));
    }
    
    const avgDifference = hueDifferences.reduce((a, b) => a + b, 0) / hueDifferences.length;
    
    if (avgDifference < 30) return "analogous";
    if (avgDifference > 150) return "complementary";
    return "mixed";
  }

  rgbToHue(color) {
    const r = color.red / 255;
    const g = color.green / 255;
    const b = color.blue / 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const diff = max - min;
    
    if (diff === 0) return 0;
    
    let hue;
    switch (max) {
      case r: hue = ((g - b) / diff) % 6; break;
      case g: hue = (b - r) / diff + 2; break;
      case b: hue = (r - g) / diff + 4; break;
    }
    
    return Math.round(hue * 60);
  }

  describeStrokeFlags(usesNonScalingStrokes, usesScalingStrokes) {
    if (usesNonScalingStrokes && usesScalingStrokes) {
      return "Mixed scaling behavior - some strokes scale, others don't";
    } else if (usesNonScalingStrokes) {
      return "Non-scaling strokes - maintain constant width regardless of zoom";
    } else if (usesScalingStrokes) {
      return "Scaling strokes - width changes with zoom level";
    } else {
      return "Standard stroke scaling behavior";
    }
  }

  generateComplexityRecommendations(score, features) {
    const recommendations = [];
    
    if (score > 30) {
      recommendations.push("Consider simplifying this shape for better performance");
    }
    
    if (features.hasGradients && features.hasBitmaps) {
      recommendations.push("Mixing gradients and bitmaps may cause rendering slowdowns");
    }
    
    if (features.hasMultiplePaths) {
      recommendations.push("Multiple paths increase draw calls - consider merging if possible");
    }
    
    if (features.hasCurves && score > 20) {
      recommendations.push("High curve count with complex styling may impact performance");
    }
    
    return recommendations;
  }
  
  parseUnknownShapeTag(tagType, reader, length) {
    const data = [];
    const bytesToRead = Math.min(length, 32);
    
    for (let i = 0; i < bytesToRead; i++) {
      data.push(this.dataTypes.parseUI8(reader));
    }
    
    return {
      tagType: `Unknown Shape Tag ${tagType}`,
      description: "Unknown or unsupported shape-related tag",
      data: {
        rawBytes: data,
        totalLength: length,
        truncated: length > 32,
        note: length > 32 ? "Data truncated to first 32 bytes" : "Complete data shown"
      }
    };
  }
}

// Export for use by other parsers
window.ShapeParsers = ShapeParsers;
