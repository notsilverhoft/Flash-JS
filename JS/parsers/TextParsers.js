/* 
 * SWF Text Definition Tags Parser - v2.0
 * Handles text definition and formatting tags
 * DefineText, DefineText2, DefineEditText, CSMTextSettings
 * ENHANCED: Added CSMTextSettings support for advanced text rendering
 */
class TextParsers {
  constructor() {
    this.dataTypes = new SWFDataTypes();
  }
  
  // Helper method to parse signed 16-bit integer
  parseSI16(reader) {
    const value = this.dataTypes.parseUI16(reader);
    return value > 32767 ? value - 65536 : value;
  }
  
  // ==================== TAG PARSING DISPATCHER ====================
  
  parseTag(tagType, tagData, offset, length) {
    const reader = new BitReader(tagData, offset);
    
    switch (tagType) {
      case 11:
        return this.parseDefineText(reader, length);
      case 33:
        return this.parseDefineText2(reader, length);
      case 37:
        return this.parseDefineEditText(reader, length);
      case 74:
        return this.parseCSMTextSettings(reader, length);
      default:
        return this.parseUnknownTextTag(tagType, reader, length);
    }
  }
  
  // ==================== SPECIFIC TAG PARSERS ====================
  
  parseDefineText(reader, length) {
    try {
      const characterId = this.dataTypes.parseUI16(reader);
      const textBounds = this.dataTypes.parseRECT(reader);
      const textMatrix = this.dataTypes.parseMATRIX(reader);
      
      // Read remaining data as text records (simplified)
      const remainingBytes = Math.max(0, length - 4); // Approximate
      const textRecords = this.parseTextRecords(reader, remainingBytes, false);
      
      return {
        tagType: "DefineText",
        description: "Defines static text with formatting",
        data: {
          characterId: characterId,
          textBounds: textBounds,
          textBoundsFormatted: this.dataTypes.formatRECT(textBounds),
          textMatrix: textMatrix,
          textMatrixFormatted: this.dataTypes.formatMatrix(textMatrix),
          textRecords: textRecords,
          hasAlpha: false,
          isStatic: true,
          textAnalysis: this.analyzeTextContent(textRecords)
        }
      };
      
    } catch (error) {
      return {
        tagType: "DefineText",
        description: "Defines static text with formatting",
        error: `Parse error: ${error.message}`,
        data: {}
      };
    }
  }
  
  parseDefineText2(reader, length) {
    try {
      const characterId = this.dataTypes.parseUI16(reader);
      const textBounds = this.dataTypes.parseRECT(reader);
      const textMatrix = this.dataTypes.parseMATRIX(reader);
      
      // Read remaining data as text records (simplified)
      const remainingBytes = Math.max(0, length - 4); // Approximate
      const textRecords = this.parseTextRecords(reader, remainingBytes, true);
      
      return {
        tagType: "DefineText2",
        description: "Defines static text with alpha channel support",
        data: {
          characterId: characterId,
          textBounds: textBounds,
          textBoundsFormatted: this.dataTypes.formatRECT(textBounds),
          textMatrix: textMatrix,
          textMatrixFormatted: this.dataTypes.formatMatrix(textMatrix),
          textRecords: textRecords,
          hasAlpha: true,
          isStatic: true,
          textAnalysis: this.analyzeTextContent(textRecords)
        }
      };
      
    } catch (error) {
      return {
        tagType: "DefineText2",
        description: "Defines static text with alpha channel support",
        error: `Parse error: ${error.message}`,
        data: {}
      };
    }
  }
  
  parseDefineEditText(reader, length) {
    try {
      const characterId = this.dataTypes.parseUI16(reader);
      const bounds = this.dataTypes.parseRECT(reader);
      
      // Parse flags
      const flags1 = this.dataTypes.parseUI8(reader);
      const flags2 = this.dataTypes.parseUI8(reader);
      
      const hasText = (flags1 & 0x80) !== 0;
      const wordWrap = (flags1 & 0x40) !== 0;
      const multiline = (flags1 & 0x20) !== 0;
      const password = (flags1 & 0x10) !== 0;
      const readonly = (flags1 & 0x08) !== 0;
      const hasTextColor = (flags1 & 0x04) !== 0;
      const hasMaxLength = (flags1 & 0x02) !== 0;
      const hasFont = (flags1 & 0x01) !== 0;
      
      const hasFontClass = (flags2 & 0x80) !== 0;
      const autoSize = (flags2 & 0x40) !== 0;
      const hasLayout = (flags2 & 0x20) !== 0;
      const noSelect = (flags2 & 0x10) !== 0;
      const border = (flags2 & 0x08) !== 0;
      const wasStatic = (flags2 & 0x04) !== 0;
      const html = (flags2 & 0x02) !== 0;
      const useOutlines = (flags2 & 0x01) !== 0;
      
      let fontId = null;
      let fontHeight = null;
      if (hasFont) {
        fontId = this.dataTypes.parseUI16(reader);
        fontHeight = this.dataTypes.parseUI16(reader);
      }
      
      let fontClass = null;
      if (hasFontClass) {
        fontClass = this.dataTypes.parseString(reader);
      }
      
      let textColor = null;
      if (hasTextColor) {
        textColor = this.dataTypes.parseRGBA(reader);
      }
      
      let maxLength = null;
      if (hasMaxLength) {
        maxLength = this.dataTypes.parseUI16(reader);
      }
      
      let align = null;
      let leftMargin = null;
      let rightMargin = null;
      let indent = null;
      let leading = null;
      if (hasLayout) {
        align = this.dataTypes.parseUI8(reader);
        leftMargin = this.dataTypes.parseUI16(reader);
        rightMargin = this.dataTypes.parseUI16(reader);
        indent = this.dataTypes.parseUI16(reader);
        leading = this.parseSI16(reader);
      }
      
      let variableName = null;
      if (!hasText) {
        variableName = this.dataTypes.parseString(reader);
      }
      
      let initialText = null;
      if (hasText) {
        initialText = this.dataTypes.parseString(reader);
      }
      
      return {
        tagType: "DefineEditText",
        description: "Defines editable/dynamic text field",
        data: {
          characterId: characterId,
          bounds: bounds,
          boundsFormatted: this.dataTypes.formatRECT(bounds),
          flags: {
            hasText,
            wordWrap,
            multiline,
            password,
            readonly,
            hasTextColor,
            hasMaxLength,
            hasFont,
            hasFontClass,
            autoSize,
            hasLayout,
            noSelect,
            border,
            wasStatic,
            html,
            useOutlines
          },
          fontId: fontId,
          fontHeight: fontHeight,
          fontClass: fontClass,
          textColor: textColor,
          textColorFormatted: textColor ? this.dataTypes.formatColor(textColor) : null,
          maxLength: maxLength,
          layout: hasLayout ? {
            align: this.getAlignmentName(align),
            leftMargin: leftMargin,
            rightMargin: rightMargin,
            indent: indent,
            leading: leading
          } : null,
          variableName: variableName,
          initialText: initialText,
          textType: this.determineTextType(flags1, flags2),
          interactivity: this.analyzeTextInteractivity(flags1, flags2)
        }
      };
      
    } catch (error) {
      return {
        tagType: "DefineEditText",
        description: "Defines editable/dynamic text field",
        error: `Parse error: ${error.message}`,
        data: {}
      };
    }
  }
  
  parseCSMTextSettings(reader, length) {
    try {
      // CSMTextSettings format (Flash Player 8+):
      // - TextID (UI16) - Character ID of the text field this applies to
      // - UseFlashType (UB[2]) - 0=use normal renderer, 1=use FlashType renderer
      // - GridFit (UB[3]) - Grid fitting: 0=none, 1=pixel, 2=subpixel
      // - Reserved (UB[3]) - Must be 0
      // - Thickness (FLOAT32) - Font thickness/weight (-200.0 to 200.0)
      // - Sharpness (FLOAT32) - Font sharpness (-400.0 to 400.0)
      // - Reserved (UI8) - Must be 0
      
      if (length < 12) {
        return {
          tagType: "CSMTextSettings",
          description: "Advanced text rendering settings (Flash Player 8+)",
          error: `Invalid length: expected at least 12 bytes, got ${length} bytes`,
          data: {}
        };
      }
      
      const textId = this.dataTypes.parseUI16(reader);
      
      // Parse flags byte
      const flagsByte = this.dataTypes.parseUI8(reader);
      const useFlashType = (flagsByte >> 6) & 0x03;
      const gridFit = (flagsByte >> 3) & 0x07;
      const reserved1 = flagsByte & 0x07;
      
      const thickness = this.dataTypes.parseFIXED(reader);
      const sharpness = this.dataTypes.parseFIXED(reader);
      const reserved2 = this.dataTypes.parseUI8(reader);
      
      // Analyze text quality settings
      const qualityAnalysis = this.analyzeTextQuality(useFlashType, gridFit, thickness, sharpness);
      const renderingOptimization = this.analyzeRenderingOptimization(useFlashType, gridFit, thickness, sharpness);
      
      return {
        tagType: "CSMTextSettings",
        description: "Advanced text rendering settings (Flash Player 8+)",
        data: {
          textId: textId,
          useFlashType: useFlashType,
          useFlashTypeName: this.getFlashTypeName(useFlashType),
          gridFit: gridFit,
          gridFitName: this.getGridFitName(gridFit),
          thickness: thickness,
          sharpness: sharpness,
          reserved1: reserved1,
          reserved2: reserved2,
          qualitySettings: {
            renderer: this.getFlashTypeName(useFlashType),
            antiAliasing: this.getAntiAliasingQuality(useFlashType, gridFit),
            fontSmoothing: this.getFontSmoothingLevel(thickness, sharpness),
            readability: this.assessReadability(gridFit, thickness, sharpness)
          },
          qualityAnalysis: qualityAnalysis,
          renderingOptimization: renderingOptimization,
          performanceImpact: this.assessPerformanceImpact(useFlashType, gridFit, thickness, sharpness),
          compatibility: {
            flashPlayerVersion: "8.0+",
            supportsBitmapFonts: useFlashType === 0,
            supportsAdvancedAntiAliasing: useFlashType === 1,
            isHighQuality: useFlashType === 1 && gridFit > 0
          },
          validation: {
            thicknessValid: thickness >= -200.0 && thickness <= 200.0,
            sharpnessValid: sharpness >= -400.0 && sharpness <= 400.0,
            reserved1Valid: reserved1 === 0,
            reserved2Valid: reserved2 === 0,
            overallValid: thickness >= -200.0 && thickness <= 200.0 && 
                         sharpness >= -400.0 && sharpness <= 400.0 &&
                         reserved1 === 0 && reserved2 === 0
          }
        }
      };
      
    } catch (error) {
      return {
        tagType: "CSMTextSettings",
        description: "Advanced text rendering settings (Flash Player 8+)",
        error: `Parse error: ${error.message}`,
        data: {}
      };
    }
  }
  
  parseUnknownTextTag(tagType, reader, length) {
    const data = [];
    const bytesToRead = Math.min(length, 32);
    
    for (let i = 0; i < bytesToRead; i++) {
      data.push(this.dataTypes.parseUI8(reader));
    }
    
    return {
      tagType: `Unknown Text Tag ${tagType}`,
      description: "Unknown or unsupported text definition tag",
      data: {
        rawBytes: data,
        totalLength: length,
        truncated: length > 32,
        note: length > 32 ? "Data truncated to first 32 bytes" : "Complete data shown"
      }
    };
  }
  
  // ==================== TEXT RECORDS PARSING ====================
  
  parseTextRecords(reader, length, hasAlpha) {
    const records = [];
    let recordIndex = 0;
    const maxRecords = 10; // Limit for performance
    
    try {
      while (recordIndex < maxRecords && reader.byteOffset < reader.buffer.length - 1) {
        const firstByte = this.dataTypes.parseUI8(reader);
        
        if (firstByte === 0) {
          // End of text records
          break;
        }
        
        const textRecordType = (firstByte & 0x80) !== 0 ? "control" : "glyph";
        
        if (textRecordType === "control") {
          // Style change record
          const hasFont = (firstByte & 0x08) !== 0;
          const hasColor = (firstByte & 0x04) !== 0;
          const hasYOffset = (firstByte & 0x02) !== 0;
          const hasXOffset = (firstByte & 0x01) !== 0;
          
          let fontId = null;
          let fontSize = null;
          if (hasFont) {
            fontId = this.dataTypes.parseUI16(reader);
            fontSize = this.dataTypes.parseUI16(reader);
          }
          
          let color = null;
          if (hasColor) {
            color = hasAlpha ? this.dataTypes.parseRGBA(reader) : this.dataTypes.parseRGB(reader);
          }
          
          let xOffset = null;
          if (hasXOffset) {
            xOffset = this.parseSI16(reader);
          }
          
          let yOffset = null;
          if (hasYOffset) {
            yOffset = this.parseSI16(reader);
          }
          
          records.push({
            type: "style_change",
            hasFont,
            hasColor,
            hasXOffset,
            hasYOffset,
            fontId,
            fontSize,
            color: color ? (hasAlpha ? this.dataTypes.formatColor(color) : this.dataTypes.formatColor(color)) : null,
            xOffset,
            yOffset
          });
          
        } else {
          // Glyph record
          const glyphCount = firstByte & 0x7F;
          
          // For now, just note the presence of glyphs
          records.push({
            type: "glyph_record",
            glyphCount: glyphCount,
            note: "Glyph data present but not fully parsed"
          });
          
          // Skip glyph data (simplified)
          break;
        }
        
        recordIndex++;
      }
      
    } catch (error) {
      records.push({
        type: "parse_error",
        error: error.message,
        note: "Text record parsing stopped due to error"
      });
    }
    
    return {
      records: records,
      recordCount: records.length,
      truncated: recordIndex >= maxRecords,
      hasStyleChanges: records.some(r => r.type === "style_change"),
      hasGlyphs: records.some(r => r.type === "glyph_record")
    };
  }
  
  // ==================== CSMTEXTSETTINGS ANALYSIS METHODS ====================
  
  getFlashTypeName(useFlashType) {
    const flashTypes = {
      0: "device_fonts",
      1: "embedded_cff"
    };
    return flashTypes[useFlashType] || `unknown(${useFlashType})`;
  }
  
  getGridFitName(gridFit) {
    const gridFits = {
      0: "none",
      1: "pixel",
      2: "subpixel"
    };
    return gridFits[gridFit] || `unknown(${gridFit})`;
  }
  
  getAntiAliasingQuality(useFlashType, gridFit) {
    if (useFlashType === 0) {
      return "device_dependent";
    } else if (useFlashType === 1) {
      switch (gridFit) {
        case 0: return "smooth_no_grid";
        case 1: return "smooth_pixel_grid";
        case 2: return "smooth_subpixel_grid";
        default: return "unknown";
      }
    }
    return "unknown";
  }
  
  getFontSmoothingLevel(thickness, sharpness) {
    const thicknessLevel = Math.abs(thickness);
    const sharpnessLevel = Math.abs(sharpness);
    
    if (thicknessLevel < 50 && sharpnessLevel < 100) {
      return "subtle";
    } else if (thicknessLevel < 100 && sharpnessLevel < 200) {
      return "moderate";
    } else {
      return "aggressive";
    }
  }
  
  assessReadability(gridFit, thickness, sharpness) {
    let score = 0;
    const factors = [];
    
    // Grid fitting impact
    if (gridFit === 1) {
      score += 2;
      factors.push("Pixel grid fitting improves small text clarity");
    } else if (gridFit === 2) {
      score += 3;
      factors.push("Subpixel grid fitting provides best readability");
    } else {
      factors.push("No grid fitting may cause blurry text at small sizes");
    }
    
    // Thickness impact
    if (thickness >= -50 && thickness <= 50) {
      score += 2;
      factors.push("Optimal thickness range for readability");
    } else if (Math.abs(thickness) > 100) {
      score += 1;
      factors.push("High thickness may impact readability");
    }
    
    // Sharpness impact
    if (sharpness >= -100 && sharpness <= 100) {
      score += 2;
      factors.push("Good sharpness range for clear text");
    } else if (Math.abs(sharpness) > 200) {
      factors.push("Extreme sharpness may cause artifacts");
    }
    
    let readabilityLevel;
    if (score >= 6) {
      readabilityLevel = "excellent";
    } else if (score >= 4) {
      readabilityLevel = "good";
    } else if (score >= 2) {
      readabilityLevel = "fair";
    } else {
      readabilityLevel = "poor";
    }
    
    return {
      level: readabilityLevel,
      score: score,
      factors: factors
    };
  }
  
  analyzeTextQuality(useFlashType, gridFit, thickness, sharpness) {
    const analysis = {
      renderingEngine: useFlashType === 1 ? "FlashType (advanced)" : "Device fonts (basic)",
      antiAliasingMethod: this.getAntiAliasingQuality(useFlashType, gridFit),
      qualityLevel: "unknown"
    };
    
    // Determine overall quality level
    let qualityScore = 0;
    
    if (useFlashType === 1) qualityScore += 3; // FlashType is higher quality
    if (gridFit > 0) qualityScore += 2; // Grid fitting improves quality
    if (Math.abs(thickness) <= 100) qualityScore += 1; // Reasonable thickness
    if (Math.abs(sharpness) <= 200) qualityScore += 1; // Reasonable sharpness
    
    if (qualityScore >= 6) {
      analysis.qualityLevel = "high";
    } else if (qualityScore >= 4) {
      analysis.qualityLevel = "medium";
    } else if (qualityScore >= 2) {
      analysis.qualityLevel = "basic";
    } else {
      analysis.qualityLevel = "low";
    }
    
    return analysis;
  }
  
  analyzeRenderingOptimization(useFlashType, gridFit, thickness, sharpness) {
    const optimizations = [];
    const recommendations = [];
    
    // Analyze current settings
    if (useFlashType === 1) {
      optimizations.push("Using FlashType renderer for better quality");
    } else {
      recommendations.push("Consider using FlashType renderer for better quality");
    }
    
    if (gridFit === 2) {
      optimizations.push("Subpixel grid fitting enabled for best clarity");
    } else if (gridFit === 1) {
      optimizations.push("Pixel grid fitting enabled for improved clarity");
      recommendations.push("Consider subpixel grid fitting for even better quality");
    } else {
      recommendations.push("Enable grid fitting for better text clarity");
    }
    
    if (Math.abs(thickness) <= 50 && Math.abs(sharpness) <= 100) {
      optimizations.push("Conservative thickness and sharpness settings");
    } else if (Math.abs(thickness) > 150 || Math.abs(sharpness) > 300) {
      recommendations.push("Consider reducing extreme thickness/sharpness values");
    }
    
    return {
      currentOptimizations: optimizations,
      recommendations: recommendations,
      optimizationLevel: optimizations.length >= 2 ? "well_optimized" : 
                        optimizations.length === 1 ? "partially_optimized" : "needs_optimization"
    };
  }
  
  assessPerformanceImpact(useFlashType, gridFit, thickness, sharpness) {
    let impact = 0;
    const factors = [];
    
    // FlashType has higher rendering cost
    if (useFlashType === 1) {
      impact += 2;
      factors.push("FlashType renderer increases CPU usage");
    } else {
      factors.push("Device font renderer has minimal CPU impact");
    }
    
    // Grid fitting adds processing cost
    if (gridFit === 2) {
      impact += 3;
      factors.push("Subpixel grid fitting has high processing cost");
    } else if (gridFit === 1) {
      impact += 1;
      factors.push("Pixel grid fitting has moderate processing cost");
    }
    
    // Extreme values increase processing
    if (Math.abs(thickness) > 100 || Math.abs(sharpness) > 200) {
      impact += 1;
      factors.push("High thickness/sharpness values increase processing");
    }
    
    let impactLevel;
    if (impact >= 5) {
      impactLevel = "high";
    } else if (impact >= 3) {
      impactLevel = "moderate";
    } else if (impact >= 1) {
      impactLevel = "low";
    } else {
      impactLevel = "minimal";
    }
    
    return {
      level: impactLevel,
      score: impact,
      factors: factors,
      recommendation: impact > 4 ? "Consider optimizing for better performance" :
                     impact > 2 ? "Good balance of quality and performance" :
                     "Optimized for performance"
    };
  }
  
  // ==================== UTILITY METHODS ====================
  
  getAlignmentName(align) {
    const alignments = {
      0: "left",
      1: "right", 
      2: "center",
      3: "justify"
    };
    return alignments[align] || `unknown(${align})`;
  }
  
  determineTextType(flags1, flags2) {
    if (flags1 & 0x08) { // readonly
      return "display_text";
    } else if (flags2 & 0x10) { // noSelect
      return "static_text";
    } else if (flags1 & 0x10) { // password
      return "password_input";
    } else if (flags1 & 0x20) { // multiline
      return "text_area";
    } else {
      return "text_input";
    }
  }
  
  analyzeTextInteractivity(flags1, flags2) {
    const features = [];
    let interactivityLevel = 0;
    
    if (!(flags1 & 0x08)) { // not readonly
      features.push("User can edit text");
      interactivityLevel += 2;
    }
    
    if (!(flags2 & 0x10)) { // not noSelect
      features.push("User can select text");
      interactivityLevel += 1;
    }
    
    if (flags2 & 0x02) { // html
      features.push("Supports HTML formatting");
      interactivityLevel += 1;
    }
    
    if (flags1 & 0x40) { // wordWrap
      features.push("Text wraps automatically");
      interactivityLevel += 1;
    }
    
    if (flags1 & 0x20) { // multiline
      features.push("Supports multiple lines");
      interactivityLevel += 1;
    }
    
    return {
      features: features,
      level: interactivityLevel >= 4 ? "high" : 
             interactivityLevel >= 2 ? "medium" : 
             interactivityLevel >= 1 ? "low" : "none",
      isEditable: !(flags1 & 0x08),
      isSelectable: !(flags2 & 0x10),
      supportsHTML: !!(flags2 & 0x02)
    };
  }
  
  analyzeTextContent(textRecords) {
    if (!textRecords || !textRecords.records) {
      return {
        complexity: "unknown",
        hasFormatting: false,
        recordCount: 0
      };
    }
    
    const hasStyleChanges = textRecords.hasStyleChanges;
    const hasGlyphs = textRecords.hasGlyphs;
    const recordCount = textRecords.recordCount;
    
    let complexity = "simple";
    if (recordCount > 5) {
      complexity = "complex";
    } else if (recordCount > 2 || hasStyleChanges) {
      complexity = "moderate";
    }
    
    return {
      complexity: complexity,
      hasFormatting: hasStyleChanges,
      hasText: hasGlyphs,
      recordCount: recordCount,
      textRecords: textRecords
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
      
      switch (parsedTag.tagType) {
        case "DefineText":
        case "DefineText2":
          lines.push(`  └─ Character ID: ${data.characterId}`);
          lines.push(`  └─ Text Bounds: ${data.textBoundsFormatted}`);
          lines.push(`  └─ Transform: ${data.textMatrixFormatted}`);
          lines.push(`  └─ Alpha Support: ${data.hasAlpha ? 'Yes' : 'No'}`);
          
          if (data.textAnalysis) {
            lines.push(`  └─ Text Complexity: ${data.textAnalysis.complexity}`);
            lines.push(`  └─ Has Formatting: ${data.textAnalysis.hasFormatting ? 'Yes' : 'No'}`);
            lines.push(`  └─ Record Count: ${data.textAnalysis.recordCount}`);
          }
          break;
          
        case "DefineEditText":
          lines.push(`  └─ Character ID: ${data.characterId}`);
          lines.push(`  └─ Bounds: ${data.boundsFormatted}`);
          lines.push(`  └─ Text Type: ${data.textType}`);
          lines.push(`  └─ Interactivity: ${data.interactivity.level}`);
          
          if (data.fontId) {
            lines.push(`  └─ Font ID: ${data.fontId}, Height: ${data.fontHeight}`);
          }
          
          if (data.fontClass) {
            lines.push(`  └─ Font Class: "${data.fontClass}"`);
          }
          
          if (data.textColorFormatted) {
            lines.push(`  └─ Text Color: ${data.textColorFormatted}`);
          }
          
          if (data.initialText) {
            const truncated = data.initialText.length > 50 ? 
              data.initialText.substring(0, 50) + "..." : data.initialText;
            lines.push(`  └─ Initial Text: "${truncated}"`);
          }
          
          if (data.variableName) {
            lines.push(`  └─ Variable Name: "${data.variableName}"`);
          }
          
          if (data.layout) {
            lines.push(`  └─ Layout: ${data.layout.align}, margins: ${data.layout.leftMargin}/${data.layout.rightMargin}`);
          }
          
          // Show key interactive features
          const features = data.interactivity.features;
          if (features.length > 0) {
            lines.push(`  └─ Features: ${features.slice(0, 2).join(', ')}${features.length > 2 ? '...' : ''}`);
          }
          break;
          
        case "CSMTextSettings":
          lines.push(`  └─ Text ID: ${data.textId}`);
          lines.push(`  └─ Renderer: ${data.useFlashTypeName}`);
          lines.push(`  └─ Grid Fit: ${data.gridFitName}`);
          lines.push(`  └─ Thickness: ${data.thickness.toFixed(1)}`);
          lines.push(`  └─ Sharpness: ${data.sharpness.toFixed(1)}`);
          
          if (data.qualitySettings) {
            lines.push(`  └─ Anti-aliasing: ${data.qualitySettings.antiAliasing}`);
            lines.push(`  └─ Font Smoothing: ${data.qualitySettings.fontSmoothing}`);
            lines.push(`  └─ Readability: ${data.qualitySettings.readability.level}`);
          }
          
          if (data.qualityAnalysis) {
            lines.push(`  └─ Quality Level: ${data.qualityAnalysis.qualityLevel}`);
          }
          
          if (data.performanceImpact) {
            lines.push(`  └─ Performance Impact: ${data.performanceImpact.level}`);
            lines.push(`  └─ Recommendation: ${data.performanceImpact.recommendation}`);
          }
          
          if (data.renderingOptimization) {
            lines.push(`  └─ Optimization: ${data.renderingOptimization.optimizationLevel}`);
            if (data.renderingOptimization.recommendations.length > 0) {
              lines.push(`  └─ Suggestions: ${data.renderingOptimization.recommendations[0]}`);
            }
          }
          
          if (!data.validation.overallValid) {
            lines.push(`  └─ ⚠ Validation issues detected`);
            if (!data.validation.thicknessValid) {
              lines.push(`    • Thickness out of valid range (-200 to 200)`);
            }
            if (!data.validation.sharpnessValid) {
              lines.push(`    • Sharpness out of valid range (-400 to 400)`);
            }
          }
          break;
          
        default:
          if (data.note) {
            lines.push(`  └─ ${data.note}`);
          }
          break;
      }
    }
    
    return lines.join('\n');
  }
}

// Export for use by other parsers
window.TextParsers = TextParsers;
