/* 
 * SWF Sprite Definition Tags Parser - v2.0
 * Handles sprite definitions - the hierarchical core of Flash content
 * DefineSprite (Tag 39) - nested timelines within SWF files
 * COMPLETED: Full nested tag parsing with timeline analysis and character tracking
 */
class SpriteParsers {
  constructor() {
    this.dataTypes = new SWFDataTypes();
    this.nestingDepth = 0; // Track recursion depth to prevent infinite loops
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
      
      // Analyze the sprite timeline and structure
      const timeline = this.analyzeTimeline(nestedTags.tags);
      const characterUsage = this.analyzeCharacterUsage(nestedTags.tags);
      const actionScript = this.analyzeActionScript(nestedTags.tags);
      
      return {
        tagType: "DefineSprite",
        description: "Defines a sprite with its own timeline and nested content",
        data: {
          spriteId: spriteId,
          frameCount: frameCount,
          nestedTags: nestedTags,
          complexity: this.calculateSpriteComplexity(nestedTags),
          hasContent: nestedTags.tags.length > 0,
          timeline: timeline,
          characterUsage: characterUsage,
          actionScript: actionScript,
          spriteType: this.determineSpriteType(timeline, characterUsage, actionScript),
          performance: this.analyzePerformance(nestedTags, timeline)
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
          parsedContent: parsedContent,
          offset: offset
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
      
      // Use existing parsers if available for comprehensive parsing
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
      
      if (typeof FontParsers !== 'undefined' && this.isFontTag(tagHeader.type)) {
        const parser = new FontParsers();
        return parser.parseTag(tagHeader.type, tagData, contentOffset, tagHeader.length);
      }
      
      if (typeof TextParsers !== 'undefined' && this.isTextTag(tagHeader.type)) {
        const parser = new TextParsers();
        return parser.parseTag(tagHeader.type, tagData, contentOffset, tagHeader.length);
      }
      
      if (typeof BitmapParsers !== 'undefined' && this.isBitmapTag(tagHeader.type)) {
        const parser = new BitmapParsers();
        return parser.parseTag(tagHeader.type, tagData, contentOffset, tagHeader.length);
      }
      
      if (typeof SoundParsers !== 'undefined' && this.isSoundTag(tagHeader.type)) {
        const parser = new SoundParsers();
        return parser.parseTag(tagHeader.type, tagData, contentOffset, tagHeader.length);
      }
      
      if (typeof ButtonParsers !== 'undefined' && this.isButtonTag(tagHeader.type)) {
        const parser = new ButtonParsers();
        return parser.parseTag(tagHeader.type, tagData, contentOffset, tagHeader.length);
      }
      
      if (typeof VideoParsers !== 'undefined' && this.isVideoTag(tagHeader.type)) {
        const parser = new VideoParsers();
        return parser.parseTag(tagHeader.type, tagData, contentOffset, tagHeader.length);
      }
      
      if (typeof MorphParsers !== 'undefined' && this.isMorphTag(tagHeader.type)) {
        const parser = new MorphParsers();
        return parser.parseTag(tagHeader.type, tagData, contentOffset, tagHeader.length);
      }
      
      if (typeof ScalingParsers !== 'undefined' && this.isScalingTag(tagHeader.type)) {
        const parser = new ScalingParsers();
        return parser.parseTag(tagHeader.type, tagData, contentOffset, tagHeader.length);
      }
      
      // For nested sprites, allow limited recursion with depth tracking
      if (tagHeader.type === 39) {
        if (this.nestingDepth < 5) { // Limit nesting depth to prevent infinite recursion
          this.nestingDepth++;
          const nestedParser = new SpriteParsers();
          nestedParser.nestingDepth = this.nestingDepth;
          const result = nestedParser.parseTag(tagHeader.type, tagData, contentOffset, tagHeader.length);
          this.nestingDepth--;
          return result;
        } else {
          return {
            tagType: "DefineSprite",
            description: "Nested sprite (recursion depth limit reached)",
            data: { note: "Maximum nesting depth reached to prevent infinite recursion" }
          };
        }
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
  
  // ==================== ANALYSIS METHODS ====================
  
  analyzeTimeline(tags) {
    let currentFrame = 0;
    const frameLabels = [];
    const placementActions = [];
    const frameActions = [];
    const displayList = new Map(); // Track objects by depth
    
    for (const tag of tags) {
      switch (tag.type) {
        case 1: // ShowFrame
          currentFrame++;
          frameActions.push({
            frame: currentFrame,
            action: "show_frame",
            displayListSize: displayList.size
          });
          break;
          
        case 43: // FrameLabel
          if (tag.parsedContent && tag.parsedContent.data && tag.parsedContent.data.label) {
            frameLabels.push({
              frame: currentFrame + 1,
              label: tag.parsedContent.data.label
            });
          }
          break;
          
        case 4: // PlaceObject
        case 26: // PlaceObject2
          if (tag.parsedContent && tag.parsedContent.data) {
            const data = tag.parsedContent.data;
            const depth = data.depth || "unknown";
            const characterId = data.characterId || "unknown";
            
            displayList.set(depth, {
              characterId: characterId,
              frame: currentFrame + 1,
              action: "placed"
            });
            
            placementActions.push({
              frame: currentFrame + 1,
              action: "place",
              type: tag.name,
              depth: depth,
              characterId: characterId
            });
          }
          break;
          
        case 5: // RemoveObject
        case 28: // RemoveObject2
          if (tag.parsedContent && tag.parsedContent.data) {
            const data = tag.parsedContent.data;
            const depth = data.depth || "unknown";
            
            displayList.delete(depth);
            
            placementActions.push({
              frame: currentFrame + 1,
              action: "remove",
              type: tag.name,
              depth: depth
            });
          }
          break;
      }
    }
    
    return {
      totalFrames: currentFrame,
      frameLabels: frameLabels,
      placementActions: placementActions.slice(0, 50), // Limit for display
      frameActions: frameActions.slice(0, 20),
      finalDisplayListSize: displayList.size,
      isAnimated: currentFrame > 1,
      hasLabels: frameLabels.length > 0,
      hasDisplayObjects: placementActions.length > 0,
      animationType: this.determineAnimationType(currentFrame, placementActions, frameLabels)
    };
  }
  
  analyzeCharacterUsage(tags) {
    const charactersUsed = new Set();
    const characterActions = [];
    
    for (const tag of tags) {
      if ((tag.type === 4 || tag.type === 26) && tag.parsedContent && tag.parsedContent.data) {
        const characterId = tag.parsedContent.data.characterId;
        if (characterId !== undefined && characterId !== "unknown") {
          charactersUsed.add(characterId);
          characterActions.push({
            characterId: characterId,
            action: "placed",
            tagType: tag.type
          });
        }
      }
    }
    
    return {
      uniqueCharacters: charactersUsed.size,
      characterIds: Array.from(charactersUsed),
      characterActions: characterActions.slice(0, 20),
      hasCharacters: charactersUsed.size > 0
    };
  }
  
  analyzeActionScript(tags) {
    const actionScriptTags = tags.filter(tag => 
      tag.type === 12 || // DoAction
      tag.type === 59 || // DoInitAction
      tag.type === 82    // DoABC
    );
    
    const analysis = {
      hasActionScript: actionScriptTags.length > 0,
      actionScriptCount: actionScriptTags.length,
      actionScriptTypes: {},
      complexity: "none"
    };
    
    if (actionScriptTags.length > 0) {
      actionScriptTags.forEach(tag => {
        analysis.actionScriptTypes[tag.name] = (analysis.actionScriptTypes[tag.name] || 0) + 1;
      });
      
      if (actionScriptTags.length > 5) {
        analysis.complexity = "high";
      } else if (actionScriptTags.length > 2) {
        analysis.complexity = "moderate";
      } else {
        analysis.complexity = "low";
      }
    }
    
    return analysis;
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
      6: "DefineBits", 7: "DefineButton", 8: "JPEGTables", 9: "SetBackgroundColor",
      10: "DefineFont", 11: "DefineText", 12: "DoAction", 13: "DefineFontInfo",
      14: "DefineSound", 15: "StartSound", 17: "DefineButtonSound", 18: "SoundStreamHead",
      19: "SoundStreamBlock", 20: "DefineBitsLossless", 21: "DefineBitsJPEG2",
      22: "DefineShape2", 23: "DefineButtonCxform", 24: "Protect", 26: "PlaceObject2",
      28: "RemoveObject2", 32: "DefineShape3", 33: "DefineText2", 34: "DefineButton2",
      35: "DefineBitsJPEG3", 36: "DefineBitsLossless2", 37: "DefineEditText",
      39: "DefineSprite", 43: "FrameLabel", 45: "SoundStreamHead2", 46: "DefineMorphShape",
      48: "DefineFont2", 56: "ExportAssets", 57: "ImportAssets", 59: "DoInitAction",
      60: "DefineVideoStream", 61: "VideoFrame", 62: "DefineFontInfo2",
      69: "FileAttributes", 70: "PlaceObject3", 73: "DefineFontAlignZones",
      74: "CSMTextSettings", 75: "DefineFont3", 76: "SymbolClass", 77: "Metadata",
      78: "DefineScalingGrid", 82: "DoABC", 83: "DefineShape4", 84: "DefineMorphShape2",
      86: "DefineSceneAndFrameLabelData", 88: "DefineFontName", 90: "DefineFont4"
    };
    
    return tagNames[tagType] || `Unknown(${tagType})`;
  }
  
  // Tag type checking methods
  isControlTag(tagType) {
    return [0, 1, 9, 24, 43, 69, 77, 86].includes(tagType);
  }
  
  isDisplayTag(tagType) {
    return [4, 5, 26, 28, 70].includes(tagType);
  }
  
  isAssetTag(tagType) {
    return [12, 56, 57, 59, 71, 76, 82].includes(tagType);
  }
  
  isShapeTag(tagType) {
    return [2, 22, 32, 83].includes(tagType);
  }
  
  isFontTag(tagType) {
    return [10, 13, 48, 62, 73, 75, 88, 90].includes(tagType);
  }
  
  isTextTag(tagType) {
    return [11, 33, 37, 74].includes(tagType);
  }
  
  isBitmapTag(tagType) {
    return [6, 8, 20, 21, 35, 36].includes(tagType);
  }
  
  isSoundTag(tagType) {
    return [14, 15, 17, 18, 19, 45].includes(tagType);
  }
  
  isButtonTag(tagType) {
    return [7, 23, 34].includes(tagType);
  }
  
  isVideoTag(tagType) {
    return [60, 61].includes(tagType);
  }
  
  isMorphTag(tagType) {
    return [46, 84].includes(tagType);
  }
  
  isScalingTag(tagType) {
    return [78].includes(tagType);
  }
  
  calculateSpriteComplexity(nestedTags) {
    const totalTags = nestedTags.totalTags || 0;
    const uniqueTypes = Object.keys(nestedTags.tagTypeCounts || {}).length;
    
    let complexity = "simple";
    let score = 0;
    
    // Base complexity on tag count
    if (totalTags > 100) score += 4;
    else if (totalTags > 50) score += 3;
    else if (totalTags > 20) score += 2;
    else if (totalTags > 10) score += 1;
    
    // Add complexity for tag diversity
    if (uniqueTypes > 15) score += 3;
    else if (uniqueTypes > 10) score += 2;
    else if (uniqueTypes > 5) score += 1;
    
    // Determine complexity level
    if (score >= 6) complexity = "very_complex";
    else if (score >= 4) complexity = "complex";
    else if (score >= 2) complexity = "moderate";
    
    return {
      level: complexity,
      score: score,
      totalTags: totalTags,
      uniqueTagTypes: uniqueTypes,
      tagBreakdown: nestedTags.tagTypeCounts || {},
      factors: this.getComplexityFactors(totalTags, uniqueTypes, nestedTags.tagTypeCounts)
    };
  }
  
  getComplexityFactors(totalTags, uniqueTypes, tagCounts) {
    const factors = [];
    
    if (totalTags > 50) factors.push("Many nested tags");
    if (uniqueTypes > 10) factors.push("High tag diversity");
    
    if (tagCounts) {
      if (tagCounts[1] > 20) factors.push("Many frames (animation)");
      if (tagCounts[4] + tagCounts[26] > 20) factors.push("Complex display list");
      if (tagCounts[12] + tagCounts[59] + tagCounts[82] > 0) factors.push("Contains ActionScript");
      if (tagCounts[39] > 0) factors.push("Nested sprites");
    }
    
    return factors;
  }
  
  determineAnimationType(frameCount, placementActions, frameLabels) {
    if (frameCount <= 1) return "static";
    
    const hasPlacement = placementActions.length > 0;
    const hasLabels = frameLabels.length > 0;
    
    if (hasLabels && hasPlacement) return "complex_animation";
    if (hasLabels) return "labeled_animation";
    if (hasPlacement) return "simple_animation";
    
    return "timeline_only";
  }
  
  determineSpriteType(timeline, characterUsage, actionScript) {
    if (actionScript.hasActionScript) {
      if (timeline.isAnimated) return "interactive_animation";
      return "interactive_graphic";
    }
    
    if (timeline.isAnimated) {
      if (characterUsage.uniqueCharacters > 5) return "complex_animation";
      return "simple_animation";
    }
    
    if (characterUsage.hasCharacters) return "static_graphic";
    
    return "empty_sprite";
  }
  
  analyzePerformance(nestedTags, timeline) {
    let impact = "low";
    const factors = [];
    
    if (nestedTags.totalTags > 100) {
      impact = "high";
      factors.push("Many nested tags increase processing time");
    } else if (nestedTags.totalTags > 50) {
      impact = "moderate";
      factors.push("Moderate tag count");
    }
    
    if (timeline.totalFrames > 100) {
      impact = "high";
      factors.push("Long animation timeline");
    }
    
    if (timeline.placementActions.length > 50) {
      factors.push("Complex display list management");
    }
    
    const recommendations = [];
    if (impact === "high") {
      recommendations.push("Consider optimizing sprite structure");
      if (timeline.totalFrames > 100) {
        recommendations.push("Break long animations into shorter segments");
      }
    }
    
    return {
      impact: impact,
      factors: factors,
      recommendations: recommendations
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
      
      if (data.spriteType) {
        lines.push(`  └─ Type: ${data.spriteType.replace(/_/g, ' ')}`);
      }
      
      if (data.complexity) {
        lines.push(`  └─ Complexity: ${data.complexity.level} (${data.complexity.totalTags} tags)`);
      }
      
      if (data.timeline) {
        lines.push(`  └─ Timeline: ${data.timeline.totalFrames} frames`);
        if (data.timeline.isAnimated) {
          lines.push(`  └─ Animation: ${data.timeline.animationType.replace(/_/g, ' ')}`);
        }
        if (data.timeline.hasLabels) {
          lines.push(`  └─ Frame Labels: ${data.timeline.frameLabels.length}`);
        }
      }
      
      if (data.characterUsage && data.characterUsage.hasCharacters) {
        lines.push(`  └─ Characters Used: ${data.characterUsage.uniqueCharacters}`);
      }
      
      if (data.actionScript && data.actionScript.hasActionScript) {
        lines.push(`  └─ ActionScript: ${data.actionScript.complexity} complexity`);
      }
      
      if (data.performance && data.performance.impact !== "low") {
        lines.push(`  └─ Performance Impact: ${data.performance.impact}`);
      }
      
      if (data.nestedTags && data.nestedTags.tagTypeCounts) {
        lines.push(`  └─ Most Common Nested Tags:`);
        const sorted = Object.entries(data.nestedTags.tagTypeCounts)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 3);
        
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
