/* 
 * SWF Text Definition Tags Parser - v1.0
 * Handles text field definitions and formatting
 * DefineText family (Tags 11, 33, 37)
 * Text content, positioning, and styling
 */
class TextParsers {
  constructor() {
    this.dataTypes = new SWFDataTypes();
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
      default:
        return this.parseUnknownTextTag(tagType, reader, length);
    }
  }
  
  // ==================== SPECIFIC TAG PARSERS ====================
  
  parseDefineText(reader, length) {
    try {
      // DefineText format:
      // - CharacterID (UI16)
      // - TextBounds (RECT)
      // - TextMatrix (MATRIX)
      // - GlyphBits (UI8)
      // - AdvanceBits (UI8)
      // - TextRecords (TEXTRECORD[])
      
      const characterId = this.dataTypes.parseUI16(reader);
      const textBounds = this.dataTypes.parseRECT(reader);
      const textMatrix = this.dataTypes.parseMATRIX(reader);
      const glyphBits = this.dataTypes.parseUI8(reader);
      const advanceBits = this.dataTypes.parseUI8(reader);
      
      // Parse text records
      const textRecords = this.parseTextRecords(reader, glyphBits, advanceBits, false); // false = no alpha
      
      return {
        tagType: "DefineText",
        description: "Defines static text with basic formatting",
        data: {
          characterId: characterId,
          bounds: textBounds,
          boundsFormatted: this.dataTypes.formatRECT(textBounds),
          matrix: textMatrix,
          matrixFormatted: this.dataTypes.formatMatrix(textMatrix),
          glyphBits: glyphBits,
          advanceBits: advanceBits,
          textRecords: textRecords,
          version: 1,
          hasAlpha: false,
          extractedText: this.extractTextContent(textRecords),
          complexity: this.calculateTextComplexity(textRecords)
        }
      };
      
    } catch (error) {
      return {
        tagType: "DefineText",
        description: "Defines static text with basic formatting",
        error: `Parse error: ${error.message}`,
        data: {}
      };
    }
  }
  
  parseDefineText2(reader, length) {
    try {
      // DefineText2 format (similar to DefineText but with alpha support):
      const characterId = this.dataTypes.parseUI16(reader);
      const textBounds = this.dataTypes.parseRECT(reader);
      const textMatrix = this.dataTypes.parseMATRIX(reader);
      const glyphBits = this.dataTypes.parseUI8(reader);
      const advanceBits = this.dataTypes.parseUI8(reader);
      
      // Parse text records with alpha support
      const textRecords = this.parseTextRecords(reader, glyphBits, advanceBits, true); // true = has alpha
      
      return {
        tagType: "DefineText2",
        description: "Defines static text with alpha transparency support",
        data: {
          characterId: characterId,
          bounds: textBounds,
          boundsFormatted: this.dataTypes.formatRECT(textBounds),
          matrix: textMatrix,
          matrixFormatted: this.dataTypes.formatMatrix(textMatrix),
          glyphBits: glyphBits,
          advanceBits: advanceBits,
          textRecords: textRecords,
          version: 2,
          hasAlpha: true,
          extractedText: this.extractTextContent(textRecords),
          complexity: this.calculateTextComplexity(textRecords)
        }
      };
      
    } catch (error) {
      return {
        tagType: "DefineText2",
        description: "Defines static text with alpha transparency support",
        error: `Parse error: ${error.message}`,
        data: {}
      };
    }
  }
  
  parseDefineEditText(reader, length) {
    try {
      // DefineEditText format (interactive text field):
      // - CharacterID (UI16)
      // - Bounds (RECT)
      // - Flags and properties
      // - Optional font, text, colors, etc.
      
      const characterId = this.dataTypes.parseUI16(reader);
      const bounds = this.dataTypes.parseRECT(reader);
      
      // Parse flags (bit fields)
      const flags1 = this.dataTypes.parseUI8(reader);
      const flags2 = this.dataTypes.parseUI8(reader);
      
      const hasText = (flags1 & 0x80) !== 0;
      const wordWrap = (flags1 & 0x40) !== 0;
      const multiline = (flags1 & 0x20) !== 0;
      const password = (flags1 & 0x10) !== 0;
      const readOnly = (flags1 & 0x08) !== 0;
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
        leading = this.dataTypes.parseS16(reader);
      }
      
      const variableName = this.dataTypes.parseString(reader);
      
      let initialText = null;
      if (hasText) {
        initialText = this.dataTypes.parseString(reader);
      }
      
      return {
        tagType: "DefineEditText",
        description: "Defines an interactive text input field",
        data: {
          characterId: characterId,
          bounds: bounds,
          boundsFormatted: this.dataTypes.formatRECT(bounds),
          properties: {
            hasText,
            wordWrap,
            multiline,
            password,
            readOnly,
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
          font: {
            fontId: fontId,
            fontHeight: fontHeight,
            fontClass: fontClass
          },
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
          fieldType: this.determineFieldType({ password, readOnly, multiline, html }),
          version: 1
        }
      };
      
    } catch (error) {
      return {
        tagType: "DefineEditText",
        description: "Defines an interactive text input field",
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
  
  // ==================== TEXT RECORD PARSING ====================
  
  parseTextRecords(reader, glyphBits, advanceBits, hasAlpha) {
    const records = [];
    let recordIndex = 0;
    
    try {
      while (recordIndex < 100) { // Limit to prevent infinite loops
        // Check for end of records (first bit is 0)
        const firstByte = reader.readBits(8);
        
        if (firstByte === 0) {
          // End of text records
          break;
        }
        
        // Parse text record header
        const styleFlagsHasFont = (firstByte & 0x08) !== 0;
        const styleFlagsHasColor = (firstByte & 0x04) !== 0;
        const styleFlagsHasYOffset = (firstByte & 0x02) !== 0;
        const styleFlagsHasXOffset = (firstByte & 0x01) !== 0;
        
        const record = {
          type: "style_change",
          index: recordIndex
        };
        
        if (styleFlagsHasFont) {
          record.fontId = this.dataTypes.parseUI16(reader);
        }
        
        if (styleFlagsHasColor) {
          if (hasAlpha) {
            record.textColor = this.dataTypes.parseRGBA(reader);
          } else {
            record.textColor = this.dataTypes.parseRGB(reader);
          }
          record.textColorFormatted = this.dataTypes.formatColor(record.textColor);
        }
        
        if (styleFlagsHasXOffset) {
          record.xOffset = this.dataTypes.parseS16(reader);
        }
        
        if (styleFlagsHasYOffset) {
          record.yOffset = this.dataTypes.parseS16(reader);
        }
        
        if (styleFlagsHasFont) {
          record.fontHeight = this.dataTypes.parseUI16(reader);
        }
        
        // Parse glyph entries
        const glyphCount = this.dataTypes.parseUI8(reader);
        record.glyphCount = glyphCount;
        record.glyphs = [];
        
        for (let i = 0; i < glyphCount && i < 50; i++) { // Limit glyphs
          const glyphIndex = reader.readBits(glyphBits);
          const glyphAdvance = reader.readSignedBits(advanceBits);
          
          record.glyphs.push({
            index: glyphIndex,
            advance: glyphAdvance
          });
        }
        
        records.push(record);
        recordIndex++;
      }
      
    } catch (error) {
      return {
        records: records,
        recordCount: recordIndex,
        parseError: error.message,
        truncated: true
      };
    }
    
    return {
      records: records,
      recordCount: recordIndex,
      truncated: recordIndex >= 100
    };
  }
  
  // ==================== UTILITY METHODS ====================
  
  extractTextContent(textRecords) {
    if (!textRecords || !textRecords.records) {
      return null;
    }
    
    const textParts = [];
    let totalGlyphs = 0;
    
    textRecords.records.forEach(record => {
      if (record.glyphs && record.glyphs.length > 0) {
        totalGlyphs += record.glyphs.length;
        
        // We can't directly convert glyph indices to characters without font data,
        // but we can provide useful information
        textParts.push(`[${record.glyphs.length} glyphs]`);
      }
    });
    
    return {
      totalGlyphs: totalGlyphs,
      recordCount: textRecords.recordCount,
      textParts: textParts,
      note: "Actual text content requires font character mapping"
    };
  }
  
  calculateTextComplexity(textRecords) {
    if (!textRecords || !textRecords.records) {
      return { level: "simple", details: "No text records" };
    }
    
    const recordCount = textRecords.recordCount || 0;
    const totalGlyphs = textRecords.records.reduce((sum, record) => 
      sum + (record.glyphs ? record.glyphs.length : 0), 0);
    
    let complexity = "simple";
    
    if (recordCount > 10 || totalGlyphs > 100) {
      complexity = "complex";
    } else if (recordCount > 3 || totalGlyphs > 20) {
      complexity = "moderate";
    }
    
    return {
      level: complexity,
      recordCount: recordCount,
      totalGlyphs: totalGlyphs,
      hasStyleChanges: recordCount > 1
    };
  }
  
  getAlignmentName(align) {
    const alignments = {
      0: "left",
      1: "right", 
      2: "center",
      3: "justify"
    };
    
    return alignments[align] || `unknown(${align})`;
  }
  
  determineFieldType({ password, readOnly, multiline, html }) {
    if (password) return "password";
    if (readOnly) return "display";
    if (multiline && html) return "rich_text_area";
    if (multiline) return "text_area";
    if (html) return "rich_text_input";
    return "text_input";
  }
  
  formatTagOutput(parsedTag) {
    const lines = [];
    lines.push(`  └─ ${parsedTag.description}`);
    
    if (parsedTag.error) {
      lines.push(`  └─ ERROR: ${parsedTag.error}`);
    }
    
    if (parsedTag.data) {
      const data = parsedTag.data;
      
      if (data.characterId !== undefined) {
        lines.push(`  └─ Character ID: ${data.characterId}`);
      }
      
      if (data.boundsFormatted) {
        lines.push(`  └─ Bounds: ${data.boundsFormatted}`);
      }
      
      if (data.matrixFormatted) {
        lines.push(`  └─ Transform: ${data.matrixFormatted}`);
      }
      
      // Text-specific formatting
      switch (parsedTag.tagType) {
        case "DefineText":
        case "DefineText2":
          if (data.extractedText) {
            lines.push(`  └─ Total Glyphs: ${data.extractedText.totalGlyphs}`);
            lines.push(`  └─ Text Records: ${data.extractedText.recordCount}`);
          }
          
          if (data.complexity) {
            lines.push(`  └─ Complexity: ${data.complexity.level}`);
          }
          
          if (data.hasAlpha) {
            lines.push(`  └─ Supports Transparency: Yes`);
          }
          break;
          
        case "DefineEditText":
          lines.push(`  └─ Field Type: ${data.fieldType}`);
          lines.push(`  └─ Variable: "${data.variableName}"`);
          
          if (data.initialText) {
            const preview = data.initialText.length > 50 ? 
              data.initialText.substring(0, 50) + "..." : data.initialText;
            lines.push(`  └─ Initial Text: "${preview}"`);
          }
          
          if (data.font.fontId !== null) {
            lines.push(`  └─ Font ID: ${data.font.fontId}, Height: ${data.font.fontHeight}`);
          }
          
          if (data.textColorFormatted) {
            lines.push(`  └─ Text Color: ${data.textColorFormatted}`);
          }
          
          if (data.maxLength) {
            lines.push(`  └─ Max Length: ${data.maxLength} characters`);
          }
          
          const features = [];
          if (data.properties.multiline) features.push("Multiline");
          if (data.properties.password) features.push("Password");
          if (data.properties.readOnly) features.push("Read-Only");
          if (data.properties.html) features.push("HTML");
          if (data.properties.border) features.push("Border");
          
          if (features.length > 0) {
            lines.push(`  └─ Features: ${features.join(", ")}`);
          }
          
          if (data.layout) {
            lines.push(`  └─ Alignment: ${data.layout.align}`);
            lines.push(`  └─ Margins: ${data.layout.leftMargin}px - ${data.layout.rightMargin}px`);
          }
          break;
      }
      
      if (data.version) {
        lines.push(`  └─ Version: ${data.version}`);
      }
    }
    
    return lines.join('\n');
  }
}

// Export for use by other parsers
window.TextParsers = TextParsers;
