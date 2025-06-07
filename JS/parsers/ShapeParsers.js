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
