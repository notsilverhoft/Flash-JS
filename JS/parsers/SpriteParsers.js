/* 
 * SWF Sprite Definition Tags Parser - v1.0
 * Handles sprite definitions - the hierarchical core of Flash content
 * DefineSprite (Tag 39) - nested timelines within SWF files
 */
class SpriteParsers {
  constructor() {
    this.dataTypes = new SWFDataTypes();
  }
  
  // ==================== TAG PARSING DISPATCHER ====================
  
  parseTag(tagType, tagData, offset, length) {
    const reader = new BitReader(tagData, offset);
    
    switch (tagType) {
      case 39:
        return this.parseDefineSprite(reader, length, tagData, offset);
      default:
        return this.parseUnknownSpriteTag(tagType, reader, length);
    }
  }
  
  // ==================== SPECIFIC TAG PARSERS ====================
  
  parseDefineSprite(reader, length, tagData, offset) {
    try {
      // DefineSprite format:
      // - SpriteID (UI16)
      // - FrameCount (UI16)
      // - ControlTags (nested tag sequence)
      
      const spriteId = this.dataTypes.parseUI16(reader);
      const frameCount = this.dataTypes.parseUI16(reader);
      
      // Calculate where the nested tags start
      const nestedTagsOffset = offset + 4; // After SpriteID and FrameCount
      const nestedTagsLength = length - 4;
      
      // Parse nested tags within the sprite
      const nestedTags = this.parseNestedTags(tagData, nestedTagsOffset, nestedTagsLength);
      
      return {
        tagType: "DefineSprite",
        description: "Defines a sprite with its own timeline and nested content",
        data: {
          spriteId: spriteId,
          frameCount: frameCount,
          nestedTags: nestedTags,
          complexity: this.calculateSpriteComplexity(nestedTags),
          hasContent: nestedTags.tags.length > 0,
          timeline: this.analyzeTimeline(nestedTags.tags)
        }
      };
      
    } catch (error) {
      return {
        tagType: "DefineSprite",
        description: "Defines a sprite with its own timeline and nested content",
        error: `Parse error: ${error.message}`,
        data: {}
      };
    }
  }
  
  parseUnknownSpriteTag(tagType, reader, length) {
    const data = [];
    const bytesToRead = Math.min(length, 32);
    
    for (let i = 0; i < bytesToRead; i++) {
      data.push(this.dataTypes.parseUI8(reader));
    }
    
    return {
      tagType: `Unknown Sprite Tag ${tagType}`,
      description: "Unknown or unsupported sprite definition tag",
      data: {
        rawBytes: data,
        totalLength: length,
        truncated: length > 32,
        note: length > 32 ? "Data truncated to first 32 bytes" : "Complete data shown"
      }
    };
  }
  
  // ==================== NESTED TAG PARSING ====================
  
  parseNestedTags(tagData, startOffset, maxLength) {
    const tags = [];
    const tagTypeCounts = {};
    let offset = startOffset;
    let tagIndex = 0;
    
    try {
      while (offset < startOffset + maxLength && tagIndex < 1000) {
        const tagHeader = this.parseTagHeader(tagData, offset);
        
        if (!tagHeader) {
          break;
        }
        
        const tagName = this.getTagName(tagHeader.type);
        
        // Count tag types for analysis
        if (tagTypeCounts[tagHeader.type]) {
          tagTypeCounts[tagHeader.type]++;
        } else {
          tagTypeCounts[tagHeader.type] = 1;
        }
        
        // Parse content if we have parsers available
        const parsedContent = this.parseNestedTagContent(tagHeader, tagData, offset);
        
        tags.push({
          index: tagIndex,
          type: tagHeader.type,
          name: tagName,
          length: tagHeader.length,
          parsedContent: parsedContent
        });
        
        // If this is the End tag (type 0), stop parsing
        if (tagHeader.type === 0) {
          break;
        }
        
        // Move to next tag
        offset += tagHeader.headerSize + tagHeader.length;
        tagIndex++;
      }
      
    } catch (error) {
      return {
        tags: tags,
        tagTypeCounts: tagTypeCounts,
        totalTags: tagIndex,
        parseError: error.message,
        truncated: true
      };
    }
    
    return {
      tags: tags,
      tagTypeCounts: tagTypeCounts,
      totalTags: tagIndex,
      truncated: tagIndex >= 1000
    };
  }
  
  parseNestedTagContent(tagHeader, tagData, offset) {
    try {
      const contentOffset = offset + tagHeader.headerSize;
      
      // Use existing parsers if available
      if (typeof ControlParsers !== 'undefined' && this.isControlTag(tagHeader.type)) {
        const parser = new ControlParsers();
        return parser.parseTag(tagHeader.type, tagData, contentOffset, tagHeader.length);
      }
      
      if (typeof DisplayParsers !== 'undefined' && this.isDisplayTag(tagHeader.type)) {
        const parser = new DisplayParsers();
        return parser.parseTag(tagHeader.type, tagData, contentOffset, tagHeader.length);
      }
      
      if (typeof AssetParsers !== 'undefined' && this.isAssetTag(tagHeader.type)) {
        const parser = new AssetParsers();
        return parser.parseTag(tagHeader.type, tagData, contentOffset, tagHeader.length);
      }
      
      if (typeof ShapeParsers !== 'undefined' && this.isShapeTag(tagHeader.type)) {
        const parser = new ShapeParsers();
        return parser.parseTag(tagHeader.type, tagData, contentOffset, tagHeader.length);
      }
      
      // For nested sprites, we could recurse, but let's avoid infinite recursion for now
      if (tagHeader.type === 39) {
        return {
          tagType: "DefineSprite",
          description: "Nested sprite (not parsed to prevent recursion)",
          data: { note: "Nested sprite detected" }
        };
      }
      
      return null;
      
    } catch (error) {
      return {
        tagType: "ParseError",
        description: "Error parsing nested tag content",
        error: error.message,
        data: {}
      };
    }
  }
  
  // ==================== UTILITY METHODS ====================
  
  parseTagHeader(data, offset) {
    if (offset + 2 > data.length) {
      return null;
    }
    
    // Read first 2 bytes
    const byte1 = data[offset];
    const byte2 = data[offset + 1];
    
    // Extract tag type (upper 10 bits) and length (lower 6 bits)
    const tagAndLength = (byte2 << 8) | byte1;
    const tagType = (tagAndLength >> 6) & 0x3FF;
    const shortLength = tagAndLength & 0x3F;
    
    let length, headerSize;
    
    if (shortLength === 0x3F) {
      // Long format: read 4 more bytes for length
      if (offset + 6 > data.length) {
        return null;
      }
      
      length = data[offset + 2] | 
               (data[offset + 3] << 8) | 
               (data[offset + 4] << 16) | 
               (data[offset + 5] << 24);
      headerSize = 6;
    } else {
      // Short format
      length = shortLength;
      headerSize = 2;
    }
    
    return {
      type: tagType,
      length: length,
      headerSize: headerSize
    };
  }
  
  getTagName(tagType) {
    const tagNames = {
      0: "End", 1: "ShowFrame", 2: "DefineShape", 4: "PlaceObject", 5: "RemoveObject",
      9: "SetBackgroundColor", 12: "DoAction", 22: "DefineShape2", 24: "Protect",
      26: "PlaceObject2", 28: "RemoveObject2", 32: "DefineShape3", 39: "DefineSprite",
      43: "FrameLabel", 56: "ExportAssets", 57: "ImportAssets", 59: "DoInitAction",
      69: "FileAttributes", 76: "SymbolClass", 77: "Metadata", 82: "DoABC", 83: "DefineShape4"
    };
    
    return tagNames[tagType] || `Unknown(${tagType})`;
  }
  
  isControlTag(tagType) {
    return [0, 1, 9, 24, 43, 69, 77, 86].includes(tagType);
  }
  
  isDisplayTag(tagType) {
    return [4, 5, 26, 28].includes(tagType);
  }
  
  isAssetTag(tagType) {
    return [12, 56, 57, 59, 71, 76, 82].includes(tagType);
  }
  
  isShapeTag(tagType) {
    return [2, 22, 32, 83].includes(tagType);
  }
  
  calculateSpriteComplexity(nestedTags) {
    const totalTags = nestedTags.totalTags || 0;
    const uniqueTypes = Object.keys(nestedTags.tagTypeCounts || {}).length;
    
    let complexity = "simple";
    
    if (totalTags > 50 || uniqueTypes > 10) {
      complexity = "complex";
    } else if (totalTags > 10 || uniqueTypes > 5) {
      complexity = "moderate";
    }
    
    return {
      level: complexity,
      totalTags: totalTags,
      uniqueTagTypes: uniqueTypes,
      tagBreakdown: nestedTags.tagTypeCounts || {}
    };
  }
  
  analyzeTimeline(tags) {
    let frames = 0;
    const frameLabels = [];
    const placementActions = [];
    
    for (const tag of tags) {
      switch (tag.type) {
        case 1: // ShowFrame
          frames++;
          break;
        case 43: // FrameLabel
          if (tag.parsedContent && tag.parsedContent.data && tag.parsedContent.data.label) {
            frameLabels.push({
              frame: frames + 1,
              label: tag.parsedContent.data.label
            });
          }
          break;
        case 4: // PlaceObject
        case 26: // PlaceObject2
          placementActions.push({
            frame: frames + 1,
            action: "place",
            type: tag.name
          });
          break;
        case 5: // RemoveObject
        case 28: // RemoveObject2
          placementActions.push({
            frame: frames + 1,
            action: "remove",
            type: tag.name
          });
          break;
      }
    }
    
    return {
      totalFrames: frames,
      frameLabels: frameLabels,
      placementActions: placementActions.slice(0, 20), // Limit for display
      isAnimated: frames > 1,
      hasLabels: frameLabels.length > 0
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
      
      lines.push(`  └─ Sprite ID: ${data.spriteId}`);
      lines.push(`  └─ Frame Count: ${data.frameCount}`);
      
      if (data.complexity) {
        lines.push(`  └─ Complexity: ${data.complexity.level}`);
        lines.push(`  └─ Nested Tags: ${data.complexity.totalTags}`);
        lines.push(`  └─ Unique Tag Types: ${data.complexity.uniqueTagTypes}`);
      }
      
      if (data.timeline) {
        lines.push(`  └─ Timeline: ${data.timeline.totalFrames} frames`);
        if (data.timeline.isAnimated) {
          lines.push(`  └─ Animated: Yes`);
        }
        if (data.timeline.hasLabels) {
          lines.push(`  └─ Frame Labels: ${data.timeline.frameLabels.length}`);
        }
      }
      
      if (data.nestedTags && data.nestedTags.tagTypeCounts) {
        lines.push(`  └─ Most Common Nested Tags:`);
        const sorted = Object.entries(data.nestedTags.tagTypeCounts)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 5);
        
        sorted.forEach(([tagType, count]) => {
          lines.push(`    • ${this.getTagName(parseInt(tagType))}: ${count}`);
        });
      }
    }
    
    return lines.join('\n');
  }
}

// Export for use by other parsers
window.SpriteParsers = SpriteParsers;
