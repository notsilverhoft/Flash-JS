/* 
 * SWF Morph Shape Definition Tags Parser - v1.0
 * Handles shape morphing/tweening definitions for smooth Flash animations
 * DefineMorphShape (Tag 46), DefineMorphShape2 (Tag 84)
 * Essential for Flash animation and smooth shape transitions
 */
class MorphParsers {
  constructor() {
    this.dataTypes = new SWFDataTypes();
  }
  
  // ==================== TAG PARSING DISPATCHER ====================
  
  parseTag(tagType, tagData, offset, length) {
    const reader = new BitReader(tagData, offset);
    
    switch (tagType) {
      case 46:
        return this.parseDefineMorphShape(reader, length);
      case 84:
        return this.parseDefineMorphShape2(reader, length);
      default:
        return this.parseUnknownMorphTag(tagType, reader, length);
    }
  }
  
  // ==================== SPECIFIC TAG PARSERS ====================
  
  parseDefineMorphShape(reader, length) {
    try {
      // DefineMorphShape format:
      // - CharacterID (UI16)
      // - StartBounds (RECT)
      // - EndBounds (RECT)
      // - Offset (UI32) - offset to EndEdges
      // - MorphFillStyles (MORPHFILLSTYLEARRAY)
      // - MorphLineStyles (MORPHLINESTYLEARRAY)  
      // - StartEdges (SHAPE)
      // - EndEdges (SHAPE)
      
      const characterId = this.dataTypes.parseUI16(reader);
      const startBounds = this.dataTypes.parseRECT(reader);
      const endBounds = this.dataTypes.parseRECT(reader);
      const offset = this.dataTypes.parseUI32(reader);
      
      // Parse morph fill styles
      const morphFillStyles = this.parseMorphFillStyleArray(reader);
      
      // Parse morph line styles
      const morphLineStyles = this.parseMorphLineStyleArray(reader);
      
      // Parse start edges (simplified)
      const startEdges = this.parseShapeRecords(reader, 1, "start"); // version 1
      
      // Parse end edges (simplified)
      const endEdges = this.parseShapeRecords(reader, 1, "end");
      
      return {
        tagType: "DefineMorphShape",
        description: "Defines a morphing shape with start and end states",
        data: {
          characterId: characterId,
          bounds: {
            start: this.dataTypes.formatRECT(startBounds),
            end: this.dataTypes.formatRECT(endBounds),
            morphRange: this.calculateMorphRange(startBounds, endBounds)
          },
          offset: offset,
          fillStyles: {
            count: morphFillStyles.count,
            styles: morphFillStyles.styles,
            morphTypes: this.analyzeMorphTypes(morphFillStyles.styles, "fill")
          },
          lineStyles: {
            count: morphLineStyles.count,
            styles: morphLineStyles.styles,
            morphTypes: this.analyzeMorphTypes(morphLineStyles.styles, "line")
          },
          edges: {
            start: startEdges,
            end: endEdges,
            compatibility: this.analyzeEdgeCompatibility(startEdges, endEdges)
          },
          morphAnalysis: {
            complexity: this.calculateMorphComplexity(morphFillStyles, morphLineStyles, startEdges, endEdges),
            estimatedFrames: this.estimateMorphFrames(startBounds, endBounds),
            transformationType: this.identifyTransformationType(startBounds, endBounds)
          },
          version: 1
        }
      };
      
    } catch (error) {
      return {
        tagType: "DefineMorphShape",
        description: "Defines a morphing shape with start and end states",
        error: `Parse error: ${error.message}`,
        data: {}
      };
    }
  }
  
  parseDefineMorphShape2(reader, length) {
    try {
      // DefineMorphShape2 format (enhanced version):
      // - CharacterID (UI16)
      // - StartBounds (RECT)
      // - EndBounds (RECT)
      // - StartEdgeBounds (RECT)
      // - EndEdgeBounds (RECT)
      // - Reserved (UB[6])
      // - UsesNonScalingStrokes (UB[1])
      // - UsesScalingStrokes (UB[1])
      // - Offset (UI32)
      // - MorphFillStyles (MORPHFILLSTYLEARRAY)
      // - MorphLineStyles (MORPHLINESTYLEARRAY2)
      // - StartEdges (SHAPE)
      // - EndEdges (SHAPE)
      
      const characterId = this.dataTypes.parseUI16(reader);
      const startBounds = this.dataTypes.parseRECT(reader);
      const endBounds = this.dataTypes.parseRECT(reader);
      const startEdgeBounds = this.dataTypes.parseRECT(reader);
      const endEdgeBounds = this.dataTypes.parseRECT(reader);
      
      // Parse stroke flags
      const flagsByte = this.dataTypes.parseUI8(reader);
      const usesNonScalingStrokes = (flagsByte & 0x02) !== 0;
      const usesScalingStrokes = (flagsByte & 0x01) !== 0;
      
      const offset = this.dataTypes.parseUI32(reader);
      
      // Parse enhanced morph fill styles
      const morphFillStyles = this.parseMorphFillStyleArray(reader);
      
      // Parse enhanced morph line styles (version 2)
      const morphLineStyles = this.parseMorphLineStyleArray2(reader);
      
      // Parse start edges (simplified)
      const startEdges = this.parseShapeRecords(reader, 2, "start"); // version 2
      
      // Parse end edges (simplified)
      const endEdges = this.parseShapeRecords(reader, 2, "end");
      
      return {
        tagType: "DefineMorphShape2",
        description: "Defines an enhanced morphing shape with advanced stroke options",
        data: {
          characterId: characterId,
          bounds: {
            start: this.dataTypes.formatRECT(startBounds),
            end: this.dataTypes.formatRECT(endBounds),
            startEdge: this.dataTypes.formatRECT(startEdgeBounds),
            endEdge: this.dataTypes.formatRECT(endEdgeBounds),
            morphRange: this.calculateMorphRange(startBounds, endBounds),
            edgeMorphRange: this.calculateMorphRange(startEdgeBounds, endEdgeBounds)
          },
          strokeFlags: {
            usesNonScalingStrokes: usesNonScalingStrokes,
            usesScalingStrokes: usesScalingStrokes,
            strokeBehavior: this.getStrokeBehavior(usesNonScalingStrokes, usesScalingStrokes)
          },
          offset: offset,
          fillStyles: {
            count: morphFillStyles.count,
            styles: morphFillStyles.styles,
            morphTypes: this.analyzeMorphTypes(morphFillStyles.styles, "fill")
          },
          lineStyles: {
            count: morphLineStyles.count,
            styles: morphLineStyles.styles,
            morphTypes: this.analyzeMorphTypes(morphLineStyles.styles, "line"),
            enhanced: true
          },
          edges: {
            start: startEdges,
            end: endEdges,
            compatibility: this.analyzeEdgeCompatibility(startEdges, endEdges)
          },
          morphAnalysis: {
            complexity: this.calculateMorphComplexity(morphFillStyles, morphLineStyles, startEdges, endEdges),
            estimatedFrames: this.estimateMorphFrames(startBounds, endBounds),
            transformationType: this.identifyTransformationType(startBounds, endBounds),
            hasAdvancedStrokes: usesNonScalingStrokes || usesScalingStrokes
          },
          version: 2
        }
      };
      
    } catch (error) {
      return {
        tagType: "DefineMorphShape2",
        description: "Defines an enhanced morphing shape with advanced stroke options",
        error: `Parse error: ${error.message}`,
        data: {}
      };
    }
  }
  
  parseUnknownMorphTag(tagType, reader, length) {
    const data = [];
    const bytesToRead = Math.min(length, 32);
    
    for (let i = 0; i < bytesToRead; i++) {
      data.push(this.dataTypes.parseUI8(reader));
    }
    
    return {
      tagType: `Unknown Morph Tag ${tagType}`,
      description: "Unknown or unsupported morph shape tag",
      data: {
        rawBytes: data,
        totalLength: length,
        truncated: length > 32,
        note: length > 32 ? "Data truncated to first 32 bytes" : "Complete data shown"
      }
    };
  }
  
  // ==================== MORPH STYLE PARSING ====================
  
  parseMorphFillStyleArray(reader) {
    try {
      let fillStyleCount = this.dataTypes.parseUI8(reader);
      if (fillStyleCount === 0xFF) {
        fillStyleCount = this.dataTypes.parseUI16(reader);
      }
      
      const styles = [];
      for (let i = 0; i < Math.min(fillStyleCount, 50); i++) { // Limit for performance
        const style = this.parseMorphFillStyle(reader);
        styles.push(style);
      }
      
      return {
        count: fillStyleCount,
        styles: styles,
        truncated: fillStyleCount > 50
      };
      
    } catch (error) {
      return {
        count: 0,
        styles: [],
        parseError: error.message
      };
    }
  }
  
  parseMorphFillStyle(reader) {
    try {
      const type = this.dataTypes.parseUI8(reader);
      
      switch (type) {
        case 0x00: // Solid fill
          const startColor = this.dataTypes.parseRGBA(reader);
          const endColor = this.dataTypes.parseRGBA(reader);
          return {
            type: "solid",
            startColor: startColor,
            endColor: endColor,
            colorChange: this.calculateColorChange(startColor, endColor)
          };
          
        case 0x10: // Linear gradient
        case 0x12: // Radial gradient
        case 0x13: // Focal radial gradient
          const startMatrix = this.dataTypes.parseMATRIX(reader);
          const endMatrix = this.dataTypes.parseMATRIX(reader);
          const gradient = this.parseMorphGradient(reader);
          
          return {
            type: type === 0x10 ? "linear_gradient" : 
                  type === 0x12 ? "radial_gradient" : "focal_radial_gradient",
            startMatrix: this.dataTypes.formatMatrix(startMatrix),
            endMatrix: this.dataTypes.formatMatrix(endMatrix),
            gradient: gradient,
            matrixChange: this.calculateMatrixChange(startMatrix, endMatrix)
          };
          
        case 0x40: // Repeating bitmap
        case 0x41: // Clipped bitmap
        case 0x42: // Non-smoothed repeating bitmap
        case 0x43: // Non-smoothed clipped bitmap
          const bitmapId = this.dataTypes.parseUI16(reader);
          const startBitmapMatrix = this.dataTypes.parseMATRIX(reader);
          const endBitmapMatrix = this.dataTypes.parseMATRIX(reader);
          
          return {
            type: "bitmap",
            bitmapId: bitmapId,
            repeat: type === 0x40 || type === 0x42,
            smoothed: type === 0x40 || type === 0x41,
            startMatrix: this.dataTypes.formatMatrix(startBitmapMatrix),
            endMatrix: this.dataTypes.formatMatrix(endBitmapMatrix),
            matrixChange: this.calculateMatrixChange(startBitmapMatrix, endBitmapMatrix)
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
  
  parseMorphLineStyleArray(reader) {
    try {
      let lineStyleCount = this.dataTypes.parseUI8(reader);
      if (lineStyleCount === 0xFF) {
        lineStyleCount = this.dataTypes.parseUI16(reader);
      }
      
      const styles = [];
      for (let i = 0; i < Math.min(lineStyleCount, 50); i++) { // Limit for performance
        const startWidth = this.dataTypes.parseUI16(reader);
        const startColor = this.dataTypes.parseRGBA(reader);
        const endWidth = this.dataTypes.parseUI16(reader);
        const endColor = this.dataTypes.parseRGBA(reader);
        
        styles.push({
          startWidth: startWidth,
          endWidth: endWidth,
          startColor: startColor,
          endColor: endColor,
          widthChange: endWidth - startWidth,
          colorChange: this.calculateColorChange(startColor, endColor)
        });
      }
      
      return {
        count: lineStyleCount,
        styles: styles,
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
  
  parseMorphLineStyleArray2(reader) {
    try {
      let lineStyleCount = this.dataTypes.parseUI8(reader);
      if (lineStyleCount === 0xFF) {
        lineStyleCount = this.dataTypes.parseUI16(reader);
      }
      
      const styles = [];
      for (let i = 0; i < Math.min(lineStyleCount, 30); i++) { // Lower limit due to complexity
        const style = this.parseMorphLineStyle2(reader);
        styles.push(style);
      }
      
      return {
        count: lineStyleCount,
        styles: styles,
        truncated: lineStyleCount > 30
      };
      
    } catch (error) {
      return {
        count: 0,
        styles: [],
        parseError: error.message
      };
    }
  }
  
  parseMorphLineStyle2(reader) {
    try {
      const startWidth = this.dataTypes.parseUI16(reader);
      const endWidth = this.dataTypes.parseUI16(reader);
      
      // Parse line style flags
      const startCapStyle = this.dataTypes.parseUB(reader, 2);
      const joinStyle = this.dataTypes.parseUB(reader, 2);
      const hasFillFlag = this.dataTypes.parseUB(reader, 1);
      const noHScaleFlag = this.dataTypes.parseUB(reader, 1);
      const noVScaleFlag = this.dataTypes.parseUB(reader, 1);
      const pixelHintingFlag = this.dataTypes.parseUB(reader, 1);
      
      reader.align(); // Align to byte boundary
      
      const endCapStyle = this.dataTypes.parseUB(reader, 2);
      reader.align();
      
      let miterLimitFactor = null;
      if (joinStyle === 2) { // Miter join
        miterLimitFactor = this.dataTypes.parseUI16(reader);
      }
      
      let fillType = null;
      if (hasFillFlag) {
        fillType = this.parseMorphFillStyle(reader);
      } else {
        const startColor = this.dataTypes.parseRGBA(reader);
        const endColor = this.dataTypes.parseRGBA(reader);
        fillType = {
          type: "solid",
          startColor: startColor,
          endColor: endColor,
          colorChange: this.calculateColorChange(startColor, endColor)
        };
      }
      
      return {
        startWidth: startWidth,
        endWidth: endWidth,
        widthChange: endWidth - startWidth,
        caps: {
          start: this.getCapStyleName(startCapStyle),
          end: this.getCapStyleName(endCapStyle)
        },
        join: this.getJoinStyleName(joinStyle),
        miterLimitFactor: miterLimitFactor,
        flags: {
          hasFill: hasFillFlag === 1,
          noHScale: noHScaleFlag === 1,
          noVScale: noVScaleFlag === 1,
          pixelHinting: pixelHintingFlag === 1
        },
        fillType: fillType,
        enhanced: true
      };
      
    } catch (error) {
      return {
        startWidth: 0,
        endWidth: 0,
        parseError: error.message,
        enhanced: true
      };
    }
  }
  
  parseMorphGradient(reader) {
    try {
      const spreadMode = this.dataTypes.parseUB(reader, 2);
      const interpolationMode = this.dataTypes.parseUB(reader, 2);
      const numGradients = this.dataTypes.parseUB(reader, 4);
      
      reader.align();
      
      const gradientRecords = [];
      for (let i = 0; i < Math.min(numGradients, 15); i++) {
        const startRatio = this.dataTypes.parseUI8(reader);
        const startColor = this.dataTypes.parseRGBA(reader);
        const endRatio = this.dataTypes.parseUI8(reader);
        const endColor = this.dataTypes.parseRGBA(reader);
        
        gradientRecords.push({
          startRatio: startRatio,
          endRatio: endRatio,
          startColor: startColor,
          endColor: endColor,
          ratioChange: endRatio - startRatio,
          colorChange: this.calculateColorChange(startColor, endColor)
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
  
  // ==================== SHAPE RECORD PARSING (SIMPLIFIED) ====================
  
  parseShapeRecords(reader, version, edgeType) {
    try {
      const records = [];
      let recordCount = 0;
      
      // Simplified shape record parsing
      while (recordCount < 100) { // Limit for performance
        try {
          const typeFlag = this.dataTypes.parseUB(reader, 1);
          if (typeFlag === 0) {
            // Non-edge record or end
            const flags = this.dataTypes.parseUB(reader, 5);
            if (flags === 0) break; // End of shape
            // Skip non-edge record data (simplified)
            reader.align();
          } else {
            // Edge record
            const straightFlag = this.dataTypes.parseUB(reader, 1);
            const numBits = this.dataTypes.parseUB(reader, 4) + 2;
            
            if (straightFlag) {
              // Straight edge
              records.push({ type: "straight", edgeType: edgeType });
              // Skip the actual coordinate data
              reader.skipBits(numBits * 2);
            } else {
              // Curved edge
              records.push({ type: "curved", edgeType: edgeType });
              // Skip the actual coordinate data
              reader.skipBits(numBits * 4);
            }
          }
          recordCount++;
        } catch (e) {
          break; // End of readable data
        }
      }
      
      return {
        recordCount: recordCount,
        records: records.slice(0, 10), // Show first 10 records
        truncated: recordCount > 10,
        note: recordCount > 10 ? `${recordCount} total records (showing first 10)` : `${recordCount} total records`
      };
      
    } catch (error) {
      return {
        recordCount: 0,
        records: [],
        parseError: error.message,
        note: "Shape parsing failed"
      };
    }
  }
  
  // ==================== UTILITY METHODS ====================
  
  calculateColorChange(startColor, endColor) {
    if (!startColor || !endColor) return "unknown";
    
    const rDiff = Math.abs(endColor.red - startColor.red);
    const gDiff = Math.abs(endColor.green - startColor.green);
    const bDiff = Math.abs(endColor.blue - startColor.blue);
    const aDiff = Math.abs((endColor.alpha || 255) - (startColor.alpha || 255));
    
    const totalChange = rDiff + gDiff + bDiff + aDiff;
    
    if (totalChange === 0) return "no_change";
    if (totalChange < 50) return "subtle";
    if (totalChange < 200) return "moderate";
    return "dramatic";
  }
  
  calculateMatrixChange(startMatrix, endMatrix) {
    if (!startMatrix || !endMatrix) return "unknown";
    
    const scaleChange = Math.abs((endMatrix.scaleX || 1) - (startMatrix.scaleX || 1)) +
                       Math.abs((endMatrix.scaleY || 1) - (startMatrix.scaleY || 1));
    const translateChange = Math.abs((endMatrix.translateX || 0) - (startMatrix.translateX || 0)) +
                           Math.abs((endMatrix.translateY || 0) - (startMatrix.translateY || 0));
    
    if (scaleChange < 0.1 && translateChange < 100) return "minimal";
    if (scaleChange < 0.5 && translateChange < 500) return "moderate";
    return "significant";
  }
  
  calculateMorphRange(startBounds, endBounds) {
    if (!startBounds || !endBounds) return "unknown";
    
    const startArea = (startBounds.xMax - startBounds.xMin) * (startBounds.yMax - startBounds.yMin);
    const endArea = (endBounds.xMax - endBounds.xMin) * (endBounds.yMax - endBounds.yMin);
    
    const areaRatio = endArea / startArea;
    
    return {
      areaChange: areaRatio,
      changeType: areaRatio > 1.5 ? "expansion" : areaRatio < 0.67 ? "contraction" : "stable",
      startArea: Math.abs(startArea),
      endArea: Math.abs(endArea)
    };
  }
  
  analyzeMorphTypes(styles, styleType) {
    const types = new Set();
    const changes = [];
    
    styles.forEach(style => {
      if (style.type) types.add(style.type);
      
      if (styleType === "fill" && style.colorChange) {
        changes.push(style.colorChange);
      } else if (styleType === "line" && style.widthChange !== undefined) {
        changes.push(style.widthChange === 0 ? "no_width_change" : "width_change");
      }
    });
    
    return {
      styleTypes: Array.from(types),
      changeTypes: Array.from(new Set(changes)),
      complexity: types.size > 2 ? "complex" : types.size > 1 ? "moderate" : "simple"
    };
  }
  
  analyzeEdgeCompatibility(startEdges, endEdges) {
    if (!startEdges || !endEdges) return "unknown";
    
    const startCount = startEdges.recordCount || 0;
    const endCount = endEdges.recordCount || 0;
    
    if (startCount === endCount) return "perfect";
    if (Math.abs(startCount - endCount) <= 2) return "compatible";
    return "complex_morph";
  }
  
  calculateMorphComplexity(fillStyles, lineStyles, startEdges, endEdges) {
    let complexity = 0;
    
    // Add complexity for fill styles
    complexity += (fillStyles.count || 0) * 2;
    
    // Add complexity for line styles
    complexity += (lineStyles.count || 0) * 1;
    
    // Add complexity for edges
    complexity += ((startEdges.recordCount || 0) + (endEdges.recordCount || 0)) / 10;
    
    if (complexity < 5) return "simple";
    if (complexity < 15) return "moderate";
    if (complexity < 30) return "complex";
    return "very_complex";
  }
  
  estimateMorphFrames(startBounds, endBounds) {
    const morphRange = this.calculateMorphRange(startBounds, endBounds);
    
    if (morphRange.changeType === "stable") return "10-20 frames";
    if (morphRange.changeType === "expansion" || morphRange.changeType === "contraction") {
      return morphRange.areaChange > 2 ? "20-40 frames" : "15-30 frames";
    }
    
    return "15-25 frames";
  }
  
  identifyTransformationType(startBounds, endBounds) {
    if (!startBounds || !endBounds) return "unknown";
    
    const startCenterX = (startBounds.xMin + startBounds.xMax) / 2;
    const startCenterY = (startBounds.yMin + startBounds.yMax) / 2;
    const endCenterX = (endBounds.xMin + endBounds.xMax) / 2;
    const endCenterY = (endBounds.yMin + endBounds.yMax) / 2;
    
    const centerMove = Math.abs(endCenterX - startCenterX) + Math.abs(endCenterY - startCenterY);
    const areaChange = this.calculateMorphRange(startBounds, endBounds).areaChange;
    
    if (centerMove < 50 && Math.abs(areaChange - 1) < 0.1) return "color_morph";
    if (centerMove < 50) return "scale_morph";
    if (Math.abs(areaChange - 1) < 0.1) return "position_morph";
    return "complex_transformation";
  }
  
  getCapStyleName(capStyle) {
    const caps = ["round", "none", "square"];
    return caps[capStyle] || "unknown";
  }
  
  getJoinStyleName(joinStyle) {
    const joins = ["round", "bevel", "miter"];
    return joins[joinStyle] || "unknown";
  }
  
  getSpreadModeName(spreadMode) {
    const modes = ["pad", "reflect", "repeat"];
    return modes[spreadMode] || "unknown";
  }
  
  getInterpolationModeName(interpolationMode) {
    const modes = ["RGB", "linear_RGB"];
    return modes[interpolationMode] || "unknown";
  }
  
  getStrokeBehavior(nonScaling, scaling) {
    if (nonScaling && scaling) return "mixed_scaling";
    if (nonScaling) return "non_scaling_only";
    if (scaling) return "scaling_only";
    return "default_scaling";
  }
  
  formatTagOutput(parsedTag) {
    const lines = [];
    lines.push(`  └─ ${parsedTag.description}`);
    
    if (parsedTag.error) {
      lines.push(`  └─ ERROR: ${parsedTag.error}`);
    }
    
    if (parsedTag.data) {
      const data = parsedTag.data;
      
      switch (parsedTag.tagType) {
        case "DefineMorphShape":
        case "DefineMorphShape2":
          lines.push(`  └─ Character ID: ${data.characterId}`);
          lines.push(`  └─ Version: ${data.version}`);
          
          if (data.morphAnalysis) {
            lines.push(`  └─ Complexity: ${data.morphAnalysis.complexity}`);
            lines.push(`  └─ Transformation: ${data.morphAnalysis.transformationType}`);
            lines.push(`  └─ Est. Duration: ${data.morphAnalysis.estimatedFrames}`);
          }
          
          if (data.fillStyles) {
            lines.push(`  └─ Fill Styles: ${data.fillStyles.count} (${data.fillStyles.morphTypes.complexity})`);
          }
          
          if (data.lineStyles) {
            lines.push(`  └─ Line Styles: ${data.lineStyles.count}${data.lineStyles.enhanced ? ' (enhanced)' : ''}`);
          }
          
          if (data.strokeFlags && data.version === 2) {
            lines.push(`  └─ Stroke Behavior: ${data.strokeFlags.strokeBehavior}`);
          }
          
          if (data.bounds && data.bounds.morphRange) {
            lines.push(`  └─ Area Change: ${data.bounds.morphRange.changeType} (${data.bounds.morphRange.areaChange.toFixed(2)}x)`);
          }
          break;
      }
    }
    
    return lines.join('\n');
  }
}

// Export for use by other parsers
window.MorphParsers = MorphParsers;
