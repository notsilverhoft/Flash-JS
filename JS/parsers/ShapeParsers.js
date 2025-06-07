/* 
 * SWF Shape Definition Tags Parser - v1.3
 * Handles vector graphics definitions - the visual core of Flash content
 * DefineShape family (Tags 2, 22, 32, 83)
 * Fixed: Use DataTypes.formatRect for consistency
 */
class ShapeParsers {
  constructor() {
    this.dataTypes = new SWFDataTypes();
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
  
  // ==================== SPECIFIC TAG PARSERS ====================
  
  parseDefineShape(reader, length) {
    try {
      // DefineShape format:
      // - ShapeID (UI16)
      // - ShapeBounds (RECT)
      // - Shapes (SHAPEWITHSTYLE)
      
      const shapeId = this.dataTypes.parseUI16(reader);
      const shapeBounds = this.dataTypes.parseRECT(reader);
      
      // Parse SHAPEWITHSTYLE
      const shapeData = this.parseShapeWithStyle(reader, 1); // version 1
      
      return {
        tagType: "DefineShape",
        description: "Defines a vector shape with basic styling",
        data: {
          shapeId: shapeId,
          bounds: shapeBounds,
          boundsFormatted: this.dataTypes.formatRect(shapeBounds), // FIXED: use dataTypes
          fillStyles: shapeData.fillStyles,
          lineStyles: shapeData.lineStyles,
          shapeRecords: shapeData.shapeRecords,
          complexity: this.calculateComplexity(shapeData),
          hasTransparency: false,
          version: 1
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
      
      // Parse SHAPEWITHSTYLE (version 2 supports color transforms)
      const shapeData = this.parseShapeWithStyle(reader, 2);
      
      return {
        tagType: "DefineShape2",
        description: "Defines a vector shape with color transforms",
        data: {
          shapeId: shapeId,
          bounds: shapeBounds,
          boundsFormatted: this.dataTypes.formatRect(shapeBounds), // FIXED: use dataTypes
          fillStyles: shapeData.fillStyles,
          lineStyles: shapeData.lineStyles,
          shapeRecords: shapeData.shapeRecords,
          complexity: this.calculateComplexity(shapeData),
          hasTransparency: false,
          version: 2
        }
      };
      
    } catch (error) {
      return {
        tagType: "DefineShape2",
        description: "Defines a vector shape with color transforms",
        error: `Parse error: ${error.message}`,
        data: {}
      };
    }
  }
  
  parseDefineShape3(reader, length) {
    try {
      const shapeId = this.dataTypes.parseUI16(reader);
      const shapeBounds = this.dataTypes.parseRECT(reader);
      
      // Parse SHAPEWITHSTYLE (version 3 supports transparency)
      const shapeData = this.parseShapeWithStyle(reader, 3);
      
      return {
        tagType: "DefineShape3",
        description: "Defines a vector shape with transparency support",
        data: {
          shapeId: shapeId,
          bounds: shapeBounds,
          boundsFormatted: this.dataTypes.formatRect(shapeBounds), // FIXED: use dataTypes
          fillStyles: shapeData.fillStyles,
          lineStyles: shapeData.lineStyles,
          shapeRecords: shapeData.shapeRecords,
          complexity: this.calculateComplexity(shapeData),
          hasTransparency: true,
          version: 3
        }
      };
      
    } catch (error) {
      return {
        tagType: "DefineShape3",
        description: "Defines a vector shape with transparency support",
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
      
      const reserved = reader.readBits(5);
      const usesFillWindingRule = reader.readBits(1) !== 0;
      const usesNonScalingStrokes = reader.readBits(1) !== 0;
      const usesScalingStrokes = reader.readBits(1) !== 0;
      
      // Parse SHAPEWITHSTYLE (version 4 - enhanced)
      const shapeData = this.parseShapeWithStyle(reader, 4);
      
      return {
        tagType: "DefineShape4",
        description: "Defines a vector shape with enhanced features",
        data: {
          shapeId: shapeId,
          bounds: shapeBounds,
          edgeBounds: edgeBounds,
          boundsFormatted: this.dataTypes.formatRect(shapeBounds), // FIXED: use dataTypes
          edgeBoundsFormatted: this.dataTypes.formatRect(edgeBounds), // FIXED: use dataTypes
          usesFillWindingRule: usesFillWindingRule,
          usesNonScalingStrokes: usesNonScalingStrokes,
          usesScalingStrokes: usesScalingStrokes,
          fillStyles: shapeData.fillStyles,
          lineStyles: shapeData.lineStyles,
          shapeRecords: shapeData.shapeRecords,
          complexity: this.calculateComplexity(shapeData),
          hasTransparency: true,
          version: 4
        }
      };
      
    } catch (error) {
      return {
        tagType: "DefineShape4",
        description: "Defines a vector shape with enhanced features",
        error: `Parse error: ${error.message}`,
        data: {}
      };
    }
  }
  
  parseUnknownShapeTag(tagType, reader, length) {
    const data = [];
    const bytesToRead = Math.min(length, 32);
    
    for (let i = 0; i < bytesToRead; i++) {
      data.push(this.dataTypes.parseUI8(reader));
    }
    
    return {
      tagType: `Unknown Shape Tag ${tagType}`,
      description: "Unknown or unsupported shape definition tag",
      data: {
        rawBytes: data,
        totalLength: length,
        truncated: length > 32,
        note: length > 32 ? "Data truncated to first 32 bytes" : "Complete data shown"
      }
    };
  }
  
  // ==================== SHAPE PARSING METHODS ====================
  
  parseShapeWithStyle(reader, version) {
    try {
      // Parse fill styles
      const fillStyles = this.parseFillStyleArray(reader, version);
      
      // Parse line styles
      const lineStyles = this.parseLineStyleArray(reader, version);
      
      // Parse shape records
      const shapeRecords = this.parseShapeRecords(reader, version);
      
      return {
        fillStyles: fillStyles,
        lineStyles: lineStyles,
        shapeRecords: shapeRecords
      };
      
    } catch (error) {
      return {
        fillStyles: [],
        lineStyles: [],
        shapeRecords: [],
        parseError: error.message
      };
    }
  }
  
  parseFillStyleArray(reader, version) {
    try {
      let fillStyleCount = this.dataTypes.parseUI8(reader);
      
      // Extended count for large numbers of styles
      if (fillStyleCount === 0xFF) {
        fillStyleCount = this.dataTypes.parseUI16(reader);
      }
      
      const fillStyles = [];
      
      for (let i = 0; i < fillStyleCount && i < 100; i++) { // Limit to prevent memory issues
        const fillStyle = this.parseFillStyle(reader, version);
        fillStyles.push(fillStyle);
      }
      
      return {
        count: fillStyleCount,
        styles: fillStyles,
        truncated: fillStyleCount > 100
      };
      
    } catch (error) {
      return {
        count: 0,
        styles: [],
        parseError: error.message
      };
    }
  }
  
  parseFillStyle(reader, version) {
    try {
      const type = this.dataTypes.parseUI8(reader);
      
      switch (type) {
        case 0x00: // Solid fill
          const color = version >= 3 ? 
            this.dataTypes.parseRGBA(reader) : 
            this.dataTypes.parseRGB(reader);
          
          return {
            type: "solid",
            color: color,
            colorFormatted: this.dataTypes.formatColor(color)
          };
          
        case 0x10: // Linear gradient
        case 0x12: // Radial gradient
        case 0x13: // Focal radial gradient (Shape4 only)
          return this.parseGradientFill(reader, type, version);
          
        case 0x40: // Repeating bitmap
        case 0x41: // Clipped bitmap
        case 0x42: // Non-smoothed repeating bitmap
        case 0x43: // Non-smoothed clipped bitmap
          return this.parseBitmapFill(reader, type);
          
        default:
          return {
            type: "unknown",
            typeCode: type,
            note: "Unknown fill style type"
          };
      }
      
    } catch (error) {
      return {
        type: "error",
        error: error.message
      };
    }
  }
  
  parseGradientFill(reader, type, version) {
    try {
      const matrix = this.dataTypes.parseMATRIX(reader);
      
      // Parse gradient
      const gradient = this.parseGradient(reader, version);
      
      let focalPoint = null;
      if (type === 0x13) { // Focal radial gradient
        focalPoint = this.dataTypes.parseFIXED8(reader);
      }
      
      return {
        type: type === 0x10 ? "linear_gradient" : 
              type === 0x12 ? "radial_gradient" : "focal_radial_gradient",
        matrix: matrix,
        matrixFormatted: this.dataTypes.formatMatrix(matrix),
        gradient: gradient,
        focalPoint: focalPoint
      };
      
    } catch (error) {
      return {
        type: "gradient_error",
        error: error.message
      };
    }
  }
  
  parseGradient(reader, version) {
    try {
      const spreadMode = reader.readBits(2);
      const interpolationMode = reader.readBits(2);
      const numGradients = reader.readBits(4);
      
      const gradientRecords = [];
      
      for (let i = 0; i < numGradients && i < 16; i++) {
        const ratio = this.dataTypes.parseUI8(reader);
        const color = version >= 3 ? 
          this.dataTypes.parseRGBA(reader) : 
          this.dataTypes.parseRGB(reader);
          
        gradientRecords.push({
          ratio: ratio,
          color: color,
          colorFormatted: this.dataTypes.formatColor(color)
        });
      }
      
      return {
        spreadMode: spreadMode,
        interpolationMode: interpolationMode,
        numGradients: numGradients,
        records: gradientRecords
      };
      
    } catch (error) {
      return {
        numGradients: 0,
        records: [],
        error: error.message
      };
    }
  }
  
  parseBitmapFill(reader, type) {
    try {
      const bitmapId = this.dataTypes.parseUI16(reader);
      const matrix = this.dataTypes.parseMATRIX(reader);
      
      const fillType = {
        0x40: "repeating_bitmap",
        0x41: "clipped_bitmap", 
        0x42: "non_smoothed_repeating_bitmap",
        0x43: "non_smoothed_clipped_bitmap"
      }[type] || "unknown_bitmap";
      
      return {
        type: fillType,
        bitmapId: bitmapId,
        matrix: matrix,
        matrixFormatted: this.dataTypes.formatMatrix(matrix),
        isSmoothed: type <= 0x41
      };
      
    } catch (error) {
      return {
        type: "bitmap_error",
        error: error.message
      };
    }
  }
  
  parseLineStyleArray(reader, version) {
    try {
      let lineStyleCount = this.dataTypes.parseUI8(reader);
      
      if (lineStyleCount === 0xFF) {
        lineStyleCount = this.dataTypes.parseUI16(reader);
      }
      
      const lineStyles = [];
      
      for (let i = 0; i < lineStyleCount && i < 50; i++) {
        const lineStyle = this.parseLineStyle(reader, version);
        lineStyles.push(lineStyle);
      }
      
      return {
        count: lineStyleCount,
        styles: lineStyles,
        truncated: lineStyleCount > 50
      };
      
    } catch (error) {
      return {
        count: 0,
        styles: [],
        parseError: error.message
      };
    }
  }
  
  parseLineStyle(reader, version) {
    try {
      const width = this.dataTypes.parseUI16(reader);
      
      if (version >= 4) {
        // Enhanced line style for Shape4
        return this.parseLineStyle2(reader, width);
      } else {
        // Basic line style
        const color = version >= 3 ? 
          this.dataTypes.parseRGBA(reader) : 
          this.dataTypes.parseRGB(reader);
          
        return {
          width: width,
          color: color,
          colorFormatted: this.dataTypes.formatColor(color),
          type: "basic"
        };
      }
      
    } catch (error) {
      return {
        width: 0,
        type: "error",
        error: error.message
      };
    }
  }
  
  parseLineStyle2(reader, width) {
    try {
      const startCapStyle = reader.readBits(2);
      const joinStyle = reader.readBits(2);
      const hasFillFlag = reader.readBits(1) !== 0;
      const noHScaleFlag = reader.readBits(1) !== 0;
      const noVScaleFlag = reader.readBits(1) !== 0;
      const pixelHintingFlag = reader.readBits(1) !== 0;
      const reserved = reader.readBits(5);
      const noClose = reader.readBits(1) !== 0;
      const endCapStyle = reader.readBits(2);
      
      let miterLimitFactor = null;
      if (joinStyle === 2) {
        miterLimitFactor = this.dataTypes.parseFIXED8(reader);
      }
      
      let fillType = null;
      if (hasFillFlag) {
        fillType = this.parseFillStyle(reader, 4);
      } else {
        const color = this.dataTypes.parseRGBA(reader);
        fillType = {
          type: "solid",
          color: color,
          colorFormatted: this.dataTypes.formatColor(color)
        };
      }
      
      return {
        width: width,
        startCapStyle: startCapStyle,
        joinStyle: joinStyle,
        endCapStyle: endCapStyle,
        miterLimitFactor: miterLimitFactor,
        noHScale: noHScaleFlag,
        noVScale: noVScaleFlag,
        pixelHinting: pixelHintingFlag,
        noClose: noClose,
        fillType: fillType,
        type: "enhanced"
      };
      
    } catch (error) {
      return {
        width: width,
        type: "enhanced_error",
        error: error.message
      };
    }
  }
  
  parseShapeRecords(reader, version) {
    try {
      const records = [];
      let recordCount = 0;
      
      // Read number of fill and line bits
      const numFillBits = reader.readBits(4);
      const numLineBits = reader.readBits(4);
      
      while (recordCount < 1000) { // Prevent infinite loops
        // Check if this is the end record (all zeros)
        const typeFlag = reader.readBits(1);
        
        if (typeFlag === 0) {
          // Style change record or end record
          const stateRecord = this.parseStyleChangeRecord(reader, numFillBits, numLineBits);
          records.push(stateRecord);
          
          if (stateRecord.isEndRecord) {
            break;
          }
        } else {
          // Edge record
          const edgeRecord = this.parseEdgeRecord(reader);
          records.push(edgeRecord);
        }
        
        recordCount++;
      }
      
      return {
        numFillBits: numFillBits,
        numLineBits: numLineBits,
        records: records,
        recordCount: recordCount,
        truncated: recordCount >= 1000
      };
      
    } catch (error) {
      return {
        numFillBits: 0,
        numLineBits: 0,
        records: [],
        recordCount: 0,
        parseError: error.message
      };
    }
  }
  
  parseStyleChangeRecord(reader, numFillBits, numLineBits) {
    try {
      const stateNewStyles = reader.readBits(1) !== 0;
      const stateLineStyle = reader.readBits(1) !== 0;
      const stateFillStyle1 = reader.readBits(1) !== 0;
      const stateFillStyle0 = reader.readBits(1) !== 0;
      const stateMoveTo = reader.readBits(1) !== 0;
      
      // Check for end record
      if (!stateNewStyles && !stateLineStyle && !stateFillStyle1 && !stateFillStyle0 && !stateMoveTo) {
        return {
          type: "end_record",
          isEndRecord: true
        };
      }
      
      const record = {
        type: "style_change",
        isEndRecord: false,
        stateNewStyles: stateNewStyles,
        stateLineStyle: stateLineStyle,
        stateFillStyle1: stateFillStyle1,
        stateFillStyle0: stateFillStyle0,
        stateMoveTo: stateMoveTo
      };
      
      if (stateMoveTo) {
        const moveBits = reader.readBits(5);
        record.moveToX = reader.readSignedBits(moveBits);
        record.moveToY = reader.readSignedBits(moveBits);
      }
      
      if (stateFillStyle0) {
        record.fillStyle0 = reader.readBits(numFillBits);
      }
      
      if (stateFillStyle1) {
        record.fillStyle1 = reader.readBits(numFillBits);
      }
      
      if (stateLineStyle) {
        record.lineStyle = reader.readBits(numLineBits);
      }
      
      // Skip new styles parsing for now (complex)
      if (stateNewStyles) {
        record.note = "New styles present but not parsed";
      }
      
      return record;
      
    } catch (error) {
      return {
        type: "style_change_error",
        isEndRecord: false,
        error: error.message
      };
    }
  }
  
  parseEdgeRecord(reader) {
    try {
      const straightFlag = reader.readBits(1) !== 0;
      const numBits = reader.readBits(4) + 2;
      
      if (straightFlag) {
        // Straight edge
        const generalLineFlag = reader.readBits(1) !== 0;
        
        if (generalLineFlag) {
          // General line
          return {
            type: "straight_edge",
            deltaX: reader.readSignedBits(numBits),
            deltaY: reader.readSignedBits(numBits)
          };
        } else {
          // Horizontal or vertical line
          const vertLineFlag = reader.readBits(1) !== 0;
          
          if (vertLineFlag) {
            return {
              type: "vertical_line",
              deltaY: reader.readSignedBits(numBits)
            };
          } else {
            return {
              type: "horizontal_line",
              deltaX: reader.readSignedBits(numBits)
            };
          }
        }
      } else {
        // Curved edge
        return {
          type: "curved_edge",
          controlDeltaX: reader.readSignedBits(numBits),
          controlDeltaY: reader.readSignedBits(numBits),
          anchorDeltaX: reader.readSignedBits(numBits),
          anchorDeltaY: reader.readSignedBits(numBits)
        };
      }
      
    } catch (error) {
      return {
        type: "edge_error",
        error: error.message
      };
    }
  }
  
  // ==================== UTILITY METHODS ====================
  
  calculateComplexity(shapeData) {
    const fillCount = shapeData.fillStyles?.styles?.length || 0;
    const lineCount = shapeData.lineStyles?.styles?.length || 0;
    const recordCount = shapeData.shapeRecords?.recordCount || 0;
    
    let complexity = "simple";
    
    if (recordCount > 100 || fillCount > 10 || lineCount > 10) {
      complexity = "complex";
    } else if (recordCount > 20 || fillCount > 3 || lineCount > 3) {
      complexity = "moderate";
    }
    
    return {
      level: complexity,
      fillStyles: fillCount,
      lineStyles: lineCount,
      shapeRecords: recordCount
    };
  }
  
  formatTagOutput(parsedTag) {
    const lines = [];
    lines.push(`  └─ ${parsedTag.description}`);
    
    if (parsedTag.error) {
      lines.push(`  └─ ERROR: ${parsedTag.error}`);
    }
    
    if (parsedTag.data) {
      const data = parsedTag.data;
      
      lines.push(`  └─ Shape ID: ${data.shapeId}`);
      lines.push(`  └─ Version: ${data.version}`);
      
      if (data.boundsFormatted) {
        lines.push(`  └─ Bounds: ${data.boundsFormatted}`);
      }
      
      if (data.edgeBoundsFormatted) {
        lines.push(`  └─ Edge Bounds: ${data.edgeBoundsFormatted}`);
      }
      
      if (data.complexity) {
        lines.push(`  └─ Complexity: ${data.complexity.level} (${data.complexity.shapeRecords} records)`);
        lines.push(`  └─ Fill Styles: ${data.complexity.fillStyles}`);
        lines.push(`  └─ Line Styles: ${data.complexity.lineStyles}`);
      }
      
      if (data.hasTransparency) {
        lines.push(`  └─ Supports Transparency: Yes`);
      }
      
      // Shape4 specific features
      if (data.version === 4) {
        if (data.usesFillWindingRule) {
          lines.push(`  └─ Uses Fill Winding Rule: Yes`);
        }
        if (data.usesNonScalingStrokes) {
          lines.push(`  └─ Uses Non-Scaling Strokes: Yes`);
        }
      }
      
      // Show some fill style info
      if (data.fillStyles && data.fillStyles.styles && data.fillStyles.styles.length > 0) {
        lines.push(`  └─ Fill Types:`);
        data.fillStyles.styles.slice(0, 3).forEach((style, index) => {
          lines.push(`    • Style ${index + 1}: ${style.type}`);
        });
        if (data.fillStyles.styles.length > 3) {
          lines.push(`    • ... and ${data.fillStyles.styles.length - 3} more`);
        }
      }
    }
    
    return lines.join('\n');
  }
}

// Export for use by other parsers
window.ShapeParsers = ShapeParsers;
