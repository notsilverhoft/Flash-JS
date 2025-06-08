/* 
 * SWF Shape Definition Tags Parser - v1.3
 * Handles vector graphics definitions - the visual core of Flash content
 * DefineShape family (Tags 2, 22, 32, 83)
 * Fixed: Use DataTypes.formatRECT for consistency
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
          boundsFormatted: this.dataTypes.formatRECT(shapeBounds), // FIXED: use formatRECT
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
          boundsFormatted: this.dataTypes.formatRECT(shapeBounds), // FIXED: use formatRECT
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
          boundsFormatted: this.dataTypes.formatRECT(shapeBounds), // FIXED: use formatRECT
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
          boundsFormatted: this.dataTypes.formatRECT(shapeBounds), // FIXED: use formatRECT
          edgeBoundsFormatted: this.dataTypes.formatRECT(edgeBounds), // FIXED: use formatRECT
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
          let color;
          if (version >= 3) {
            color = this.dataTypes.parseRGBA(reader);
          } else {
            color = this.dataTypes.parseRGB(reader);
          }
          return {
            type: "solid",
            color: color,
            colorFormatted: this.dataTypes.formatColor(color)
          };
          
        case 0x10: // Linear gradient
        case 0x12: // Radial gradient
        case 0x13: // Focal radial gradient (Flash 8+)
          const gradientMatrix = this.dataTypes.parseMATRIX(reader);
          const gradient = this.parseGradient(reader, version);
          
          let focalPoint = null;
          if (type === 0x13) {
            focalPoint = this.dataTypes.parseFIXED8(reader);
          }
          
          return {
            type: type === 0x10 ? "linear_gradient" : 
                  type === 0x12 ? "radial_gradient" : "focal_radial_gradient",
            matrix: gradientMatrix,
            matrixFormatted: this.dataTypes.formatMatrix(gradientMatrix),
            gradient: gradient,
            focalPoint: focalPoint
          };
          
        case 0x40: // Repeating bitmap
        case 0x41: // Clipped bitmap
        case 0x42: // Non-smoothed repeating bitmap
        case 0x43: // Non-smoothed clipped bitmap
          const bitmapId = this.dataTypes.parseUI16(reader);
          const bitmapMatrix = this.dataTypes.parseMATRIX(reader);
          
          return {
            type: "bitmap",
            bitmapId: bitmapId,
            matrix: bitmapMatrix,
            matrixFormatted: this.dataTypes.formatMatrix(bitmapMatrix),
            repeat: type === 0x40 || type === 0x42,
            smoothed: type === 0x40 || type === 0x41
          };
          
        default:
          return {
            type: "unknown",
            typeValue: type,
            note: "Unsupported fill style type"
          };
      }
      
    } catch (error) {
      return {
        type: "error",
        parseError: error.message
      };
    }
  }
  
  parseGradient(reader, version) {
    try {
      const spreadMode = reader.readBits(2);
      const interpolationMode = reader.readBits(2);
      const numGradients = reader.readBits(4);
      
      const gradientRecords = [];
      
      for (let i = 0; i < numGradients && i < 15; i++) { // Limit gradient records
        const ratio = this.dataTypes.parseUI8(reader);
        let color;
        
        if (version >= 3) {
          color = this.dataTypes.parseRGBA(reader);
        } else {
          color = this.dataTypes.parseRGB(reader);
        }
        
        gradientRecords.push({
          ratio: ratio,
          color: color,
          colorFormatted: this.dataTypes.formatColor(color)
        });
      }
      
      return {
        spreadMode: this.getSpreadModeName(spreadMode),
        interpolationMode: this.getInterpolationModeName(interpolationMode),
        numGradients: numGradients,
        gradientRecords: gradientRecords,
        truncated: numGradients > 15
      };
      
    } catch (error) {
      return {
        spreadMode: "unknown",
        numGradients: 0,
        gradientRecords: [],
        parseError: error.message
      };
    }
  }
  
  parseLineStyleArray(reader, version) {
    try {
      let lineStyleCount = this.dataTypes.parseUI8(reader);
      
      // Extended count for large numbers of styles
      if (lineStyleCount === 0xFF) {
        lineStyleCount = this.dataTypes.parseUI16(reader);
      }
      
      const lineStyles = [];
      
      for (let i = 0; i < lineStyleCount && i < 100; i++) { // Limit to prevent memory issues
        const lineStyle = this.parseLineStyle(reader, version);
        lineStyles.push(lineStyle);
      }
      
      return {
        count: lineStyleCount,
        styles: lineStyles,
        truncated: lineStyleCount > 100
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
        // Enhanced line style (DefineShape4)
        return this.parseLineStyle2(reader, width);
      } else {
        // Basic line style
        let color;
        if (version >= 3) {
          color = this.dataTypes.parseRGBA(reader);
        } else {
          color = this.dataTypes.parseRGB(reader);
        }
        
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
        parseError: error.message,
        type: "error"
      };
    }
  }
  
  parseLineStyle2(reader, width) {
    try {
      // Enhanced line style with caps and joins
      const startCapStyle = reader.readBits(2);
      const joinStyle = reader.readBits(2);
      const hasFillFlag = reader.readBits(1) === 1;
      const noHScaleFlag = reader.readBits(1) === 1;
      const noVScaleFlag = reader.readBits(1) === 1;
      const pixelHintingFlag = reader.readBits(1) === 1;
      
      const reserved = reader.readBits(5);
      const noClose = reader.readBits(1) === 1;
      const endCapStyle = reader.readBits(2);
      
      let miterLimitFactor = null;
      if (joinStyle === 2) { // Miter join
        miterLimitFactor = this.dataTypes.parseUI16(reader);
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
        startCap: this.getCapStyleName(startCapStyle),
        endCap: this.getCapStyleName(endCapStyle),
        join: this.getJoinStyleName(joinStyle),
        miterLimitFactor: miterLimitFactor,
        fillType: fillType,
        flags: {
          hasFill: hasFillFlag,
          noHScale: noHScaleFlag,
          noVScale: noVScaleFlag,
          pixelHinting: pixelHintingFlag,
          noClose: noClose
        },
        type: "enhanced"
      };
      
    } catch (error) {
      return {
        width: width,
        parseError: error.message,
        type: "enhanced_error"
      };
    }
  }
  
  parseShapeRecords(reader, version) {
    try {
      const records = [];
      let recordCount = 0;
      
      // Parse shape records until end record
      while (recordCount < 1000) { // Limit to prevent infinite loops
        try {
          const typeFlag = reader.readBits(1);
          
          if (typeFlag === 0) {
            // Non-edge record
            const flags = reader.readBits(5);
            
            if (flags === 0) {
              // End of shape records
              records.push({
                type: "end",
                index: recordCount
              });
              break;
            }
            
            // Style change record
            const styleChangeRecord = this.parseStyleChangeRecord(reader, flags, version);
            styleChangeRecord.index = recordCount;
            records.push(styleChangeRecord);
            
          } else {
            // Edge record
            const straightFlag = reader.readBits(1);
            const numBits = reader.readBits(4) + 2;
            
            if (straightFlag === 1) {
              // Straight edge record
              const generalLineFlag = reader.readBits(1);
              let deltaX = 0, deltaY = 0;
              
              if (generalLineFlag === 1) {
                deltaX = reader.readSignedBits(numBits);
                deltaY = reader.readSignedBits(numBits);
              } else {
                const vertLineFlag = reader.readBits(1);
                if (vertLineFlag === 0) {
                  deltaX = reader.readSignedBits(numBits);
                } else {
                  deltaY = reader.readSignedBits(numBits);
                }
              }
              
              records.push({
                type: "straight_edge",
                index: recordCount,
                deltaX: deltaX,
                deltaY: deltaY,
                numBits: numBits
              });
              
            } else {
              // Curved edge record
              const controlDeltaX = reader.readSignedBits(numBits);
              const controlDeltaY = reader.readSignedBits(numBits);
              const anchorDeltaX = reader.readSignedBits(numBits);
              const anchorDeltaY = reader.readSignedBits(numBits);
              
              records.push({
                type: "curved_edge",
                index: recordCount,
                controlDeltaX: controlDeltaX,
                controlDeltaY: controlDeltaY,
                anchorDeltaX: anchorDeltaX,
                anchorDeltaY: anchorDeltaY,
                numBits: numBits
              });
            }
          }
          
          recordCount++;
          
        } catch (e) {
          // End of readable data or parsing error
          records.push({
            type: "parse_error",
            index: recordCount,
            error: e.message
          });
          break;
        }
      }
      
      return {
        recordCount: recordCount,
        records: records.slice(0, 50), // Limit displayed records
        truncated: records.length > 50,
        edgeCount: records.filter(r => r.type === "straight_edge" || r.type === "curved_edge").length,
        styleChangeCount: records.filter(r => r.type === "style_change").length
      };
      
    } catch (error) {
      return {
        recordCount: 0,
        records: [],
        parseError: error.message
      };
    }
  }
  
  parseStyleChangeRecord(reader, flags, version) {
    try {
      const stateNewStyles = (flags & 0x10) !== 0;
      const stateLineStyle = (flags & 0x08) !== 0;
      const stateFillStyle1 = (flags & 0x04) !== 0;
      const stateFillStyle0 = (flags & 0x02) !== 0;
      const stateMoveTo = (flags & 0x01) !== 0;
      
      const record = {
        type: "style_change",
        flags: {
          newStyles: stateNewStyles,
          lineStyle: stateLineStyle,
          fillStyle1: stateFillStyle1,
          fillStyle0: stateFillStyle0,
          moveTo: stateMoveTo
        }
      };
      
      if (stateMoveTo) {
        const moveBits = reader.readBits(5);
        record.moveToX = reader.readSignedBits(moveBits);
        record.moveToY = reader.readSignedBits(moveBits);
        record.moveBits = moveBits;
      }
      
      if (stateFillStyle0) {
        const fillBits = this.calculateFillBits(reader);
        record.fillStyle0 = reader.readBits(fillBits);
      }
      
      if (stateFillStyle1) {
        const fillBits = this.calculateFillBits(reader);
        record.fillStyle1 = reader.readBits(fillBits);
      }
      
      if (stateLineStyle) {
        const lineBits = this.calculateLineBits(reader);
        record.lineStyle = reader.readBits(lineBits);
      }
      
      if (stateNewStyles) {
        // New styles are defined inline
        record.newFillStyles = this.parseFillStyleArray(reader, version);
        record.newLineStyles = this.parseLineStyleArray(reader, version);
        
        // Read new bit counts
        const numFillBits = reader.readBits(4);
        const numLineBits = reader.readBits(4);
        record.numFillBits = numFillBits;
        record.numLineBits = numLineBits;
      }
      
      return record;
      
    } catch (error) {
      return {
        type: "style_change",
        parseError: error.message
      };
    }
  }
  
  // ==================== UTILITY METHODS ====================
  
  calculateFillBits(reader) {
    // This should be determined from the initial shape parsing
    // For now, return a reasonable default
    return 1;
  }
  
  calculateLineBits(reader) {
    // This should be determined from the initial shape parsing
    // For now, return a reasonable default
    return 1;
  }
  
  getSpreadModeName(spreadMode) {
    const modes = ["pad", "reflect", "repeat", "reserved"];
    return modes[spreadMode] || "unknown";
  }
  
  getInterpolationModeName(interpolationMode) {
    const modes = ["RGB", "linear_RGB", "reserved1", "reserved2"];
    return modes[interpolationMode] || "unknown";
  }
  
  getCapStyleName(capStyle) {
    const caps = ["round", "none", "square", "reserved"];
    return caps[capStyle] || "unknown";
  }
  
  getJoinStyleName(joinStyle) {
    const joins = ["round", "bevel", "miter", "reserved"];
    return joins[joinStyle] || "unknown";
  }
  
  calculateComplexity(shapeData) {
    let complexity = 0;
    
    // Add complexity for fill styles
    if (shapeData.fillStyles && shapeData.fillStyles.count) {
      complexity += shapeData.fillStyles.count * 2;
    }
    
    // Add complexity for line styles
    if (shapeData.lineStyles && shapeData.lineStyles.count) {
      complexity += shapeData.lineStyles.count;
    }
    
    // Add complexity for shape records
    if (shapeData.shapeRecords && shapeData.shapeRecords.recordCount) {
      complexity += shapeData.shapeRecords.recordCount / 10;
    }
    
    if (complexity < 5) return "simple";
    if (complexity < 15) return "moderate";
    if (complexity < 30) return "complex";
    return "very_complex";
  }
  
  formatTagOutput(parsedTag) {
    const lines = [];
    lines.push(`  └─ ${parsedTag.description}`);
    
    if (parsedTag.error) {
      lines.push(`  └─ ERROR: ${parsedTag.error}`);
    }
    
    if (parsedTag.data) {
      const data = parsedTag.data;
      
      if (data.shapeId !== undefined) {
        lines.push(`  └─ Shape ID: ${data.shapeId}`);
      }
      
      if (data.boundsFormatted) {
        lines.push(`  └─ Bounds: ${data.boundsFormatted}`);
      }
      
      if (data.edgeBoundsFormatted) {
        lines.push(`  └─ Edge Bounds: ${data.edgeBoundsFormatted}`);
      }
      
      if (data.fillStyles && data.fillStyles.count > 0) {
        lines.push(`  └─ Fill Styles: ${data.fillStyles.count}`);
      }
      
      if (data.lineStyles && data.lineStyles.count > 0) {
        lines.push(`  └─ Line Styles: ${data.lineStyles.count}`);
      }
      
      if (data.shapeRecords) {
        lines.push(`  └─ Shape Records: ${data.shapeRecords.recordCount}`);
        if (data.shapeRecords.edgeCount > 0) {
          lines.push(`  └─ Edge Records: ${data.shapeRecords.edgeCount}`);
        }
        if (data.shapeRecords.styleChangeCount > 0) {
          lines.push(`  └─ Style Changes: ${data.shapeRecords.styleChangeCount}`);
        }
      }
      
      if (data.complexity) {
        lines.push(`  └─ Complexity: ${data.complexity}`);
      }
      
      if (data.hasTransparency) {
        lines.push(`  └─ Transparency: Supported`);
      }
      
      if (data.version) {
        lines.push(`  └─ Version: ${data.version}`);
      }
      
      // Enhanced features for DefineShape4
      if (data.usesFillWindingRule !== undefined) {
        lines.push(`  └─ Fill Winding Rule: ${data.usesFillWindingRule ? 'Yes' : 'No'}`);
      }
      
      if (data.usesNonScalingStrokes !== undefined || data.usesScalingStrokes !== undefined) {
        const strokeFeatures = [];
        if (data.usesScalingStrokes) strokeFeatures.push("Scaling");
        if (data.usesNonScalingStrokes) strokeFeatures.push("Non-scaling");
        if (strokeFeatures.length > 0) {
          lines.push(`  └─ Stroke Types: ${strokeFeatures.join(", ")}`);
        }
      }
    }
    
    return lines.join('\n');
  }
}

// Export for use by other parsers
window.ShapeParsers = ShapeParsers;
