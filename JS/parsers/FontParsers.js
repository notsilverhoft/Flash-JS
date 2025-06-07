/* 
 * SWF Font Definition Tags Parser - v1.0
 * Handles font definitions - critical for text rendering and analysis
 * DefineFont family (Tags 10, 48, 75, 90)
 * Font metrics, glyph shapes, and character mapping
 */
class FontParsers {
  constructor() {
    this.dataTypes = new SWFDataTypes();
  }
  
  // ==================== TAG PARSING DISPATCHER ====================
  
  parseTag(tagType, tagData, offset, length) {
    const reader = new BitReader(tagData, offset);
    
    switch (tagType) {
      case 10:
        return this.parseDefineFont(reader, length);
      case 13:
        return this.parseDefineFontInfo(reader, length);
      case 48:
        return this.parseDefineFont2(reader, length);
      case 62:
        return this.parseDefineFontInfo2(reader, length);
      case 73:
        return this.parseDefineFontAlignZones(reader, length);
      case 75:
        return this.parseDefineFont3(reader, length);
      case 88:
        return this.parseDefineFontName(reader, length);
      case 90:
        return this.parseDefineFont4(reader, length);
      default:
        return this.parseUnknownFontTag(tagType, reader, length);
    }
  }
  
  // ==================== SPECIFIC TAG PARSERS ====================
  
  parseDefineFont(reader, length) {
    try {
      // DefineFont format (basic font definition):
      // - FontID (UI16)
      // - OffsetTable (UI16[numGlyphs]) - offsets to glyph shapes
      // - ShapeTable (SHAPE[numGlyphs]) - actual glyph shapes
      
      const fontId = this.dataTypes.parseUI16(reader);
      
      // The first offset tells us how many glyphs there are
      const firstOffset = this.dataTypes.parseUI16(reader);
      const numGlyphs = firstOffset / 2; // Each offset is 2 bytes
      
      // Read all offsets
      const offsets = [firstOffset];
      for (let i = 1; i < numGlyphs; i++) {
        offsets.push(this.dataTypes.parseUI16(reader));
      }
      
      // Parse glyph shapes (simplified - full shape parsing is complex)
      const glyphs = [];
      const maxGlyphsToParse = Math.min(numGlyphs, 20); // Limit for performance
      
      for (let i = 0; i < maxGlyphsToParse; i++) {
        try {
          // Basic glyph info - full shape parsing would require extensive shape parser
          glyphs.push({
            index: i,
            offset: offsets[i],
            note: "Glyph shape present but not fully parsed"
          });
        } catch (e) {
          glyphs.push({
            index: i,
            offset: offsets[i],
            error: "Glyph parse error"
          });
        }
      }
      
      return {
        tagType: "DefineFont",
        description: "Defines a basic font with glyph shapes",
        data: {
          fontId: fontId,
          numGlyphs: numGlyphs,
          glyphs: glyphs,
          glyphsParsed: maxGlyphsToParse,
          truncated: numGlyphs > 20,
          version: 1,
          hasLayout: false,
          hasWideCodes: false,
          note: "Basic font definition - requires DefineFontInfo for character mapping"
        }
      };
      
    } catch (error) {
      return {
        tagType: "DefineFont",
        description: "Defines a basic font with glyph shapes",
        error: `Parse error: ${error.message}`,
        data: {}
      };
    }
  }
  
  parseDefineFontInfo(reader, length) {
    try {
      // DefineFontInfo format:
      // - FontID (UI16)
      // - FontNameLen (UI8)
      // - FontName (UI8[FontNameLen])
      // - FontFlagsReserved, FontFlagsSmallText, FontFlagsShiftJIS, FontFlagsANSI, FontFlagsItalic, FontFlagsBold, FontFlagsWideCodes (UB[1] each)
      // - CodeTable (UI8[numGlyphs] or UI16[numGlyphs])
      
      const fontId = this.dataTypes.parseUI16(reader);
      const fontNameLen = this.dataTypes.parseUI8(reader);
      
      let fontName = '';
      for (let i = 0; i < fontNameLen; i++) {
        fontName += String.fromCharCode(this.dataTypes.parseUI8(reader));
      }
      
      // Parse font flags
      const flags = this.dataTypes.parseUI8(reader);
      const fontFlagsReserved = (flags & 0x80) !== 0;
      const fontFlagsSmallText = (flags & 0x40) !== 0;
      const fontFlagsShiftJIS = (flags & 0x20) !== 0;
      const fontFlagsANSI = (flags & 0x10) !== 0;
      const fontFlagsItalic = (flags & 0x08) !== 0;
      const fontFlagsBold = (flags & 0x04) !== 0;
      const fontFlagsWideCodes = (flags & 0x02) !== 0;
      
      // Calculate remaining bytes for code table
      const remainingBytes = length - 3 - fontNameLen - 1; // FontID + NameLen + Name + Flags
      const codeTableSize = fontFlagsWideCodes ? remainingBytes / 2 : remainingBytes;
      
      // Parse code table (character codes)
      const codeTable = [];
      const maxCodesToRead = Math.min(codeTableSize, 256); // Limit for display
      
      for (let i = 0; i < maxCodesToRead; i++) {
        if (fontFlagsWideCodes) {
          codeTable.push(this.dataTypes.parseUI16(reader));
        } else {
          codeTable.push(this.dataTypes.parseUI8(reader));
        }
      }
      
      return {
        tagType: "DefineFontInfo",
        description: "Provides character mapping and metadata for a font",
        data: {
          fontId: fontId,
          fontName: fontName,
          flags: {
            smallText: fontFlagsSmallText,
            shiftJIS: fontFlagsShiftJIS,
            ansi: fontFlagsANSI,
            italic: fontFlagsItalic,
            bold: fontFlagsBold,
            wideCodes: fontFlagsWideCodes
          },
          codeTable: codeTable.slice(0, 50), // Show first 50 character codes
          totalCodes: codeTableSize,
          truncated: codeTableSize > 50,
          encoding: fontFlagsShiftJIS ? "Shift_JIS" : (fontFlagsANSI ? "ANSI" : "Unknown")
        }
      };
      
    } catch (error) {
      return {
        tagType: "DefineFontInfo",
        description: "Provides character mapping and metadata for a font",
        error: `Parse error: ${error.message}`,
        data: {}
      };
    }
  }
  
  parseDefineFont2(reader, length) {
    try {
      // DefineFont2 format (enhanced font with layout):
      // - FontID (UI16)
      // - FontFlagsHasLayout, FontFlagsShiftJIS, FontFlagsSmallText, FontFlagsANSI, FontFlagsWideOffsets, FontFlagsWideCodes, FontFlagsItalic, FontFlagsBold (UB[1] each)
      // - LanguageCode (UI8)
      // - FontNameLen (UI8)
      // - FontName (UI8[FontNameLen])
      // - NumGlyphs (UI16)
      // - OffsetTable and shape data...
      
      const fontId = this.dataTypes.parseUI16(reader);
      
      // Parse font flags
      const flags = this.dataTypes.parseUI8(reader);
      const fontFlagsHasLayout = (flags & 0x80) !== 0;
      const fontFlagsShiftJIS = (flags & 0x40) !== 0;
      const fontFlagsSmallText = (flags & 0x20) !== 0;
      const fontFlagsANSI = (flags & 0x10) !== 0;
      const fontFlagsWideOffsets = (flags & 0x08) !== 0;
      const fontFlagsWideCodes = (flags & 0x04) !== 0;
      const fontFlagsItalic = (flags & 0x02) !== 0;
      const fontFlagsBold = (flags & 0x01) !== 0;
      
      const languageCode = this.dataTypes.parseUI8(reader);
      const fontNameLen = this.dataTypes.parseUI8(reader);
      
      let fontName = '';
      for (let i = 0; i < fontNameLen; i++) {
        fontName += String.fromCharCode(this.dataTypes.parseUI8(reader));
      }
      
      const numGlyphs = this.dataTypes.parseUI16(reader);
      
      // Skip detailed parsing of offsets and shapes for now (very complex)
      // Just extract the key information
      
      let layoutInfo = null;
      if (fontFlagsHasLayout) {
        try {
          // Skip to layout section (approximate - would need full offset parsing)
          // For now, just note that layout exists
          layoutInfo = {
            present: true,
            note: "Layout information present but not fully parsed"
          };
        } catch (e) {
          layoutInfo = {
            present: true,
            error: "Layout parse error"
          };
        }
      }
      
      return {
        tagType: "DefineFont2",
        description: "Defines an enhanced font with character mapping and optional layout",
        data: {
          fontId: fontId,
          fontName: fontName,
          numGlyphs: numGlyphs,
          languageCode: languageCode,
          flags: {
            hasLayout: fontFlagsHasLayout,
            shiftJIS: fontFlagsShiftJIS,
            smallText: fontFlagsSmallText,
            ansi: fontFlagsANSI,
            wideOffsets: fontFlagsWideOffsets,
            wideCodes: fontFlagsWideCodes,
            italic: fontFlagsItalic,
            bold: fontFlagsBold
          },
          layoutInfo: layoutInfo,
          version: 2,
          encoding: fontFlagsShiftJIS ? "Shift_JIS" : (fontFlagsANSI ? "ANSI" : "Unicode")
        }
      };
      
    } catch (error) {
      return {
        tagType: "DefineFont2",
        description: "Defines an enhanced font with character mapping and optional layout",
        error: `Parse error: ${error.message}`,
        data: {}
      };
    }
  }
  
  parseDefineFontInfo2(reader, length) {
    try {
      // Similar to DefineFontInfo but with language code
      const fontId = this.dataTypes.parseUI16(reader);
      const fontNameLen = this.dataTypes.parseUI8(reader);
      
      let fontName = '';
      for (let i = 0; i < fontNameLen; i++) {
        fontName += String.fromCharCode(this.dataTypes.parseUI8(reader));
      }
      
      const flags = this.dataTypes.parseUI8(reader);
      const languageCode = this.dataTypes.parseUI8(reader);
      
      const fontFlagsWideCodes = (flags & 0x02) !== 0;
      const fontFlagsBold = (flags & 0x04) !== 0;
      const fontFlagsItalic = (flags & 0x08) !== 0;
      
      return {
        tagType: "DefineFontInfo2",
        description: "Provides character mapping and metadata for a font (enhanced)",
        data: {
          fontId: fontId,
          fontName: fontName,
          languageCode: languageCode,
          flags: {
            bold: fontFlagsBold,
            italic: fontFlagsItalic,
            wideCodes: fontFlagsWideCodes
          },
          version: 2,
          note: "Enhanced font info with language support"
        }
      };
      
    } catch (error) {
      return {
        tagType: "DefineFontInfo2",
        description: "Provides character mapping and metadata for a font (enhanced)",
        error: `Parse error: ${error.message}`,
        data: {}
      };
    }
  }
  
  parseDefineFont3(reader, length) {
    try {
      // DefineFont3 is similar to DefineFont2 but with additional flags
      const fontId = this.dataTypes.parseUI16(reader);
      
      const flags = this.dataTypes.parseUI8(reader);
      const fontFlagsHasLayout = (flags & 0x80) !== 0;
      const fontFlagsShiftJIS = (flags & 0x40) !== 0;
      const fontFlagsSmallText = (flags & 0x20) !== 0;
      const fontFlagsANSI = (flags & 0x10) !== 0;
      const fontFlagsWideOffsets = (flags & 0x08) !== 0;
      const fontFlagsWideCodes = (flags & 0x04) !== 0;
      const fontFlagsItalic = (flags & 0x02) !== 0;
      const fontFlagsBold = (flags & 0x01) !== 0;
      
      const languageCode = this.dataTypes.parseUI8(reader);
      const fontNameLen = this.dataTypes.parseUI8(reader);
      
      let fontName = '';
      for (let i = 0; i < fontNameLen; i++) {
        fontName += String.fromCharCode(this.dataTypes.parseUI8(reader));
      }
      
      const numGlyphs = this.dataTypes.parseUI16(reader);
      
      return {
        tagType: "DefineFont3",
        description: "Defines an advanced font with enhanced features",
        data: {
          fontId: fontId,
          fontName: fontName,
          numGlyphs: numGlyphs,
          languageCode: languageCode,
          flags: {
            hasLayout: fontFlagsHasLayout,
            shiftJIS: fontFlagsShiftJIS,
            smallText: fontFlagsSmallText,
            ansi: fontFlagsANSI,
            wideOffsets: fontFlagsWideOffsets,
            wideCodes: fontFlagsWideCodes,
            italic: fontFlagsItalic,
            bold: fontFlagsBold
          },
          version: 3,
          encoding: "Unicode",
          note: "Advanced font with full Unicode support"
        }
      };
      
    } catch (error) {
      return {
        tagType: "DefineFont3",
        description: "Defines an advanced font with enhanced features",
        error: `Parse error: ${error.message}`,
        data: {}
      };
    }
  }
  
  parseDefineFont4(reader, length) {
    try {
      // DefineFont4 format (modern CFF/OpenType fonts):
      // - FontID (UI16)
      // - FontFlagsReserved, FontFlagsHasFontData, FontFlagsItalic, FontFlagsBold, Reserved (UB[1] each)
      // - FontName (STRING)
      // - FontData (if FontFlagsHasFontData)
      
      const fontId = this.dataTypes.parseUI16(reader);
      
      const flags = this.dataTypes.parseUI8(reader);
      const fontFlagsHasFontData = (flags & 0x04) !== 0;
      const fontFlagsItalic = (flags & 0x02) !== 0;
      const fontFlagsBold = (flags & 0x01) !== 0;
      
      const fontName = this.dataTypes.parseSTRING(reader);
      
      let fontDataInfo = null;
      if (fontFlagsHasFontData) {
        const remainingLength = length - 3 - (fontName.length + 1); // FontID + Flags + FontName + null terminator
        fontDataInfo = {
          present: true,
          dataLength: remainingLength,
          note: "Embedded CFF/OpenType font data present"
        };
      }
      
      return {
        tagType: "DefineFont4",
        description: "Defines a modern font with CFF/OpenType support",
        data: {
          fontId: fontId,
          fontName: fontName,
          flags: {
            hasFontData: fontFlagsHasFontData,
            italic: fontFlagsItalic,
            bold: fontFlagsBold
          },
          fontDataInfo: fontDataInfo,
          version: 4,
          encoding: "CFF/OpenType",
          note: "Modern font format with embedded font data support"
        }
      };
      
    } catch (error) {
      return {
        tagType: "DefineFont4",
        description: "Defines a modern font with CFF/OpenType support",
        error: `Parse error: ${error.message}`,
        data: {}
      };
    }
  }
  
  parseDefineFontAlignZones(reader, length) {
    try {
      const fontId = this.dataTypes.parseUI16(reader);
      const csmTableHint = this.dataTypes.parseUI8(reader);
      
      // Skip detailed zone parsing for now
      const remainingBytes = length - 3;
      
      return {
        tagType: "DefineFontAlignZones",
        description: "Defines alignment zones for font hinting",
        data: {
          fontId: fontId,
          csmTableHint: csmTableHint,
          dataLength: remainingBytes,
          note: "Font alignment zones for improved rendering"
        }
      };
      
    } catch (error) {
      return {
        tagType: "DefineFontAlignZones",
        description: "Defines alignment zones for font hinting",
        error: `Parse error: ${error.message}`,
        data: {}
      };
    }
  }
  
  parseDefineFontName(reader, length) {
    try {
      const fontId = this.dataTypes.parseUI16(reader);
      const fontName = this.dataTypes.parseSTRING(reader);
      const fontCopyright = this.dataTypes.parseSTRING(reader);
      
      return {
        tagType: "DefineFontName",
        description: "Provides font name and copyright information",
        data: {
          fontId: fontId,
          fontName: fontName,
          fontCopyright: fontCopyright,
          note: "Font licensing and identification information"
        }
      };
      
    } catch (error) {
      return {
        tagType: "DefineFontName",
        description: "Provides font name and copyright information",
        error: `Parse error: ${error.message}`,
        data: {}
      };
    }
  }
  
  parseUnknownFontTag(tagType, reader, length) {
    const data = [];
    const bytesToRead = Math.min(length, 32);
    
    for (let i = 0; i < bytesToRead; i++) {
      data.push(this.dataTypes.parseUI8(reader));
    }
    
    return {
      tagType: `Unknown Font Tag ${tagType}`,
      description: "Unknown or unsupported font definition tag",
      data: {
        rawBytes: data,
        totalLength: length,
        truncated: length > 32,
        note: length > 32 ? "Data truncated to first 32 bytes" : "Complete data shown"
      }
    };
  }
  
  // ==================== UTILITY METHODS ====================
  
  formatTagOutput(parsedTag) {
    const lines = [];
    lines.push(`  └─ ${parsedTag.description}`);
    
    if (parsedTag.error) {
      lines.push(`  └─ ERROR: ${parsedTag.error}`);
    }
    
    if (parsedTag.data) {
      const data = parsedTag.data;
      
      if (data.fontId !== undefined) {
        lines.push(`  └─ Font ID: ${data.fontId}`);
      }
      
      if (data.fontName) {
        lines.push(`  └─ Font Name: "${data.fontName}"`);
      }
      
      if (data.version) {
        lines.push(`  └─ Version: ${data.version}`);
      }
      
      if (data.numGlyphs) {
        lines.push(`  └─ Glyphs: ${data.numGlyphs}`);
      }
      
      if (data.encoding) {
        lines.push(`  └─ Encoding: ${data.encoding}`);
      }
      
      if (data.flags) {
        const styleFlags = [];
        if (data.flags.bold) styleFlags.push("Bold");
        if (data.flags.italic) styleFlags.push("Italic");
        if (styleFlags.length > 0) {
          lines.push(`  └─ Style: ${styleFlags.join(", ")}`);
        }
        
        if (data.flags.hasLayout) {
          lines.push(`  └─ Has Layout Info: Yes`);
        }
        
        if (data.flags.wideCodes) {
          lines.push(`  └─ Wide Character Codes: Yes`);
        }
      }
      
      if (data.languageCode !== undefined) {
        lines.push(`  └─ Language Code: ${data.languageCode}`);
      }
      
      if (data.totalCodes) {
        lines.push(`  └─ Character Mappings: ${data.totalCodes}`);
      }
      
      if (data.fontDataInfo && data.fontDataInfo.present) {
        lines.push(`  └─ Embedded Font Data: ${data.fontDataInfo.dataLength} bytes`);
      }
      
      if (data.note) {
        lines.push(`  └─ ${data.note}`);
      }
    }
    
    return lines.join('\n');
  }
}

// Export for use by other parsers
window.FontParsers = FontParsers;
