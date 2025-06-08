/* 
 * SWF Display List Tags Parser - v1.0
 * Handles display list management tags
 * PlaceObject family, RemoveObject family
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
          const data = parsedTag.data;
          if (data.isMove) {
            lines.push(`  └─ Action: Move existing character`);
          } else if (data.isNewPlacement) {
            lines.push(`  └─ Action: Place new character`);
            lines.push(`  └─ Character ID: ${data.characterId}`);
          } else {
            lines.push(`  └─ Action: Modify existing character`);
          }
          lines.push(`  └─ Depth: ${data.depth}`);
          
          if (data.name) {
            lines.push(`  └─ Instance Name: "${data.name}"`);
          }
          
          if (data.matrixFormatted) {
            lines.push(`  └─ Transform: ${data.matrixFormatted}`);
          }
          
          if (data.ratio !== null) {
            lines.push(`  └─ Ratio: ${data.ratio}`);
          }
          
          if (data.clipDepth !== null) {
            lines.push(`  └─ Clip Depth: ${data.clipDepth}`);
          }
          
          if (data.flags.hasColorTransform) {
            lines.push(`  └─ Has Color Transform: Yes`);
          }
          
          if (data.flags.hasClipActions) {
            lines.push(`  └─ Has Clip Actions: Yes`);
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
