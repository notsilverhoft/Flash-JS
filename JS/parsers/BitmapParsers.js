/* 
 * SWF Bitmap Definition Tags Parser - v1.0
 * Handles bitmap image definitions and formats
 * DefineBits family (Tags 6, 20, 21, 35, 36) and JPEGTables (Tag 8)
 * Image formats, dimensions, and compression analysis
 */
class BitmapParsers {
  constructor() {
    this.dataTypes = new SWFDataTypes();
  }
  
  // ==================== TAG PARSING DISPATCHER ====================
  
  parseTag(tagType, tagData, offset, length) {
    const reader = new BitReader(tagData, offset);
    
    switch (tagType) {
      case 6:
        return this.parseDefineBits(reader, length);
      case 8:
        return this.parseJPEGTables(reader, length);
      case 20:
        return this.parseDefineBitsLossless(reader, length);
      case 21:
        return this.parseDefineBitsJPEG2(reader, length);
      case 35:
        return this.parseDefineBitsJPEG3(reader, length);
      case 36:
        return this.parseDefineBitsLossless2(reader, length);
      default:
        return this.parseUnknownBitmapTag(tagType, reader, length);
    }
  }
  
  // ==================== SPECIFIC TAG PARSERS ====================
  
  parseDefineBits(reader, length) {
    try {
      // DefineBits format (basic JPEG):
      // - CharacterID (UI16)
      // - JPEGData (UI8[length-2])
      
      const characterId = this.dataTypes.parseUI16(reader);
      const jpegDataLength = length - 2; // Subtract CharacterID bytes
      
      // Read first few bytes to analyze JPEG header
      const jpegHeader = this.analyzeJPEGHeader(reader, Math.min(jpegDataLength, 32));
      
      return {
        tagType: "DefineBits",
        description: "Defines a JPEG image (requires JPEGTables for decoding)",
        data: {
          characterId: characterId,
          imageFormat: "JPEG",
          dataLength: jpegDataLength,
          jpegHeader: jpegHeader,
          requiresJPEGTables: true,
          hasAlpha: false,
          version: 1,
          compressionType: "JPEG",
          note: "This image requires JPEGTables tag for complete decoding"
        }
      };
      
    } catch (error) {
      return {
        tagType: "DefineBits",
        description: "Defines a JPEG image (requires JPEGTables for decoding)",
        error: `Parse error: ${error.message}`,
        data: {}
      };
    }
  }
  
  parseJPEGTables(reader, length) {
    try {
      // JPEGTables format:
      // - JPEGData (UI8[length]) - JPEG encoding tables
      
      // Read first few bytes to analyze JPEG tables
      const jpegTablesHeader = this.analyzeJPEGHeader(reader, Math.min(length, 32));
      
      return {
        tagType: "JPEGTables",
        description: "Defines JPEG encoding tables shared by DefineBits tags",
        data: {
          dataLength: length,
          jpegTablesHeader: jpegTablesHeader,
          note: "Shared JPEG encoding tables for DefineBits images",
          purpose: "Provides quantization and Huffman tables for JPEG decoding"
        }
      };
      
    } catch (error) {
      return {
        tagType: "JPEGTables",
        description: "Defines JPEG encoding tables shared by DefineBits tags",
        error: `Parse error: ${error.message}`,
        data: {}
      };
    }
  }
  
  parseDefineBitsJPEG2(reader, length) {
    try {
      // DefineBitsJPEG2 format (self-contained JPEG):
      // - CharacterID (UI16)
      // - JPEGData (UI8[length-2]) - complete JPEG including tables
      
      const characterId = this.dataTypes.parseUI16(reader);
      const jpegDataLength = length - 2;
      
      // Analyze JPEG header for format detection
      const jpegHeader = this.analyzeJPEGHeader(reader, Math.min(jpegDataLength, 64));
      
      // Try to detect actual image format (could be PNG in later Flash versions)
      const actualFormat = this.detectImageFormat(jpegHeader);
      
      return {
        tagType: "DefineBitsJPEG2",
        description: "Defines a self-contained JPEG image with encoding tables",
        data: {
          characterId: characterId,
          imageFormat: actualFormat.format,
          dataLength: jpegDataLength,
          jpegHeader: jpegHeader,
          formatDetails: actualFormat,
          requiresJPEGTables: false,
          hasAlpha: false,
          version: 2,
          compressionType: actualFormat.format,
          note: "Self-contained image with embedded encoding tables"
        }
      };
      
    } catch (error) {
      return {
        tagType: "DefineBitsJPEG2",
        description: "Defines a self-contained JPEG image with encoding tables",
        error: `Parse error: ${error.message}`,
        data: {}
      };
    }
  }
  
  parseDefineBitsJPEG3(reader, length) {
    try {
      // DefineBitsJPEG3 format (JPEG with alpha):
      // - CharacterID (UI16)
      // - AlphaDataOffset (UI32)
      // - JPEGData (UI8[AlphaDataOffset])
      // - BitmapAlphaData (UI8[length - 6 - AlphaDataOffset])
      
      const characterId = this.dataTypes.parseUI16(reader);
      const alphaDataOffset = this.dataTypes.parseUI32(reader);
      
      const jpegDataLength = alphaDataOffset;
      const alphaDataLength = length - 6 - alphaDataOffset; // Total - CharacterID - AlphaDataOffset - JPEG data
      
      // Analyze JPEG header
      const jpegHeader = this.analyzeJPEGHeader(reader, Math.min(jpegDataLength, 64));
      const actualFormat = this.detectImageFormat(jpegHeader);
      
      return {
        tagType: "DefineBitsJPEG3",
        description: "Defines a JPEG image with separate alpha channel data",
        data: {
          characterId: characterId,
          imageFormat: actualFormat.format,
          dataLength: jpegDataLength,
          alphaDataLength: alphaDataLength,
          alphaDataOffset: alphaDataOffset,
          jpegHeader: jpegHeader,
          formatDetails: actualFormat,
          requiresJPEGTables: false,
          hasAlpha: true,
          version: 3,
          compressionType: actualFormat.format,
          alphaCompression: "ZLIB",
          note: "Image with separate compressed alpha channel for transparency"
        }
      };
      
    } catch (error) {
      return {
        tagType: "DefineBitsJPEG3",
        description: "Defines a JPEG image with separate alpha channel data",
        error: `Parse error: ${error.message}`,
        data: {}
      };
    }
  }
  
  parseDefineBitsLossless(reader, length) {
    try {
      // DefineBitsLossless format (lossless bitmap):
      // - CharacterID (UI16)
      // - BitmapFormat (UI8) - 3=8-bit, 4=15-bit, 5=24-bit
      // - BitmapWidth (UI16)
      // - BitmapHeight (UI16)
      // - BitmapColorTableSize (UI8) - only if format 3
      // - ZlibBitmapData (UI8[remaining])
      
      const characterId = this.dataTypes.parseUI16(reader);
      const bitmapFormat = this.dataTypes.parseUI8(reader);
      const bitmapWidth = this.dataTypes.parseUI16(reader);
      const bitmapHeight = this.dataTypes.parseUI16(reader);
      
      let colorTableSize = null;
      let headerSize = 7; // CharacterID + Format + Width + Height
      
      if (bitmapFormat === 3) {
        colorTableSize = this.dataTypes.parseUI8(reader);
        headerSize += 1;
      }
      
      const zlibDataLength = length - headerSize;
      const formatInfo = this.getBitmapFormatInfo(bitmapFormat);
      
      return {
        tagType: "DefineBitsLossless",
        description: "Defines a lossless bitmap image with ZLIB compression",
        data: {
          characterId: characterId,
          imageFormat: "Lossless Bitmap",
          width: bitmapWidth,
          height: bitmapHeight,
          bitmapFormat: bitmapFormat,
          formatInfo: formatInfo,
          colorTableSize: colorTableSize,
          zlibDataLength: zlibDataLength,
          pixelCount: bitmapWidth * bitmapHeight,
          requiresJPEGTables: false,
          hasAlpha: false,
          version: 1,
          compressionType: "ZLIB",
          estimatedUncompressedSize: this.estimateUncompressedSize(bitmapFormat, bitmapWidth, bitmapHeight, colorTableSize),
          note: "Lossless bitmap compressed with ZLIB"
        }
      };
      
    } catch (error) {
      return {
        tagType: "DefineBitsLossless",
        description: "Defines a lossless bitmap image with ZLIB compression",
        error: `Parse error: ${error.message}`,
        data: {}
      };
    }
  }
  
  parseDefineBitsLossless2(reader, length) {
    try {
      // DefineBitsLossless2 format (lossless bitmap with alpha):
      // Similar to DefineBitsLossless but with alpha support
      
      const characterId = this.dataTypes.parseUI16(reader);
      const bitmapFormat = this.dataTypes.parseUI8(reader);
      const bitmapWidth = this.dataTypes.parseUI16(reader);
      const bitmapHeight = this.dataTypes.parseUI16(reader);
      
      let colorTableSize = null;
      let headerSize = 7;
      
      if (bitmapFormat === 3) {
        colorTableSize = this.dataTypes.parseUI8(reader);
        headerSize += 1;
      }
      
      const zlibDataLength = length - headerSize;
      const formatInfo = this.getBitmapFormatInfo(bitmapFormat, true); // true = has alpha
      
      return {
        tagType: "DefineBitsLossless2",
        description: "Defines a lossless bitmap image with alpha channel and ZLIB compression",
        data: {
          characterId: characterId,
          imageFormat: "Lossless Bitmap with Alpha",
          width: bitmapWidth,
          height: bitmapHeight,
          bitmapFormat: bitmapFormat,
          formatInfo: formatInfo,
          colorTableSize: colorTableSize,
          zlibDataLength: zlibDataLength,
          pixelCount: bitmapWidth * bitmapHeight,
          requiresJPEGTables: false,
          hasAlpha: true,
          version: 2,
          compressionType: "ZLIB",
          estimatedUncompressedSize: this.estimateUncompressedSize(bitmapFormat, bitmapWidth, bitmapHeight, colorTableSize, true),
          note: "Lossless bitmap with alpha transparency compressed with ZLIB"
        }
      };
      
    } catch (error) {
      return {
        tagType: "DefineBitsLossless2",
        description: "Defines a lossless bitmap image with alpha channel and ZLIB compression",
        error: `Parse error: ${error.message}`,
        data: {}
      };
    }
  }
  
  parseUnknownBitmapTag(tagType, reader, length) {
    const data = [];
    const bytesToRead = Math.min(length, 32);
    
    for (let i = 0; i < bytesToRead; i++) {
      data.push(this.dataTypes.parseUI8(reader));
    }
    
    return {
      tagType: `Unknown Bitmap Tag ${tagType}`,
      description: "Unknown or unsupported bitmap definition tag",
      data: {
        rawBytes: data,
        totalLength: length,
        truncated: length > 32,
        note: length > 32 ? "Data truncated to first 32 bytes" : "Complete data shown"
      }
    };
  }
  
  // ==================== UTILITY METHODS ====================
  
  analyzeJPEGHeader(reader, maxBytes) {
    const headerBytes = [];
    
    for (let i = 0; i < maxBytes; i++) {
      try {
        headerBytes.push(this.dataTypes.parseUI8(reader));
      } catch (e) {
        break; // End of data
      }
    }
    
    return {
      bytes: headerBytes.slice(0, 16), // Show first 16 bytes
      totalRead: headerBytes.length,
      hasSOI: headerBytes.length >= 2 && headerBytes[0] === 0xFF && headerBytes[1] === 0xD8, // JPEG Start of Image
      analysis: this.analyzeHeaderBytes(headerBytes)
    };
  }
  
  analyzeHeaderBytes(bytes) {
    if (bytes.length < 4) {
      return "Insufficient data for analysis";
    }
    
    // Check for common image format signatures
    if (bytes[0] === 0xFF && bytes[1] === 0xD8) {
      return "JPEG format detected (SOI marker)";
    }
    
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
      return "PNG format detected";
    }
    
    if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
      return "GIF format detected";
    }
    
    return "Unknown or custom format";
  }
  
  detectImageFormat(jpegHeader) {
    if (!jpegHeader || !jpegHeader.bytes) {
      return { format: "Unknown", confidence: "low", details: "No header data" };
    }
    
    const bytes = jpegHeader.bytes;
    
    if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xD8) {
      return { 
        format: "JPEG", 
        confidence: "high", 
        details: "Valid JPEG SOI marker detected" 
      };
    }
    
    if (bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
      return { 
        format: "PNG", 
        confidence: "high", 
        details: "PNG signature detected (Flash 8+ supports PNG in JPEG tags)" 
      };
    }
    
    if (bytes.length >= 3 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
      return { 
        format: "GIF", 
        confidence: "medium", 
        details: "GIF signature detected" 
      };
    }
    
    return { 
      format: "Unknown", 
      confidence: "low", 
      details: `Unrecognized format: ${bytes.slice(0, 4).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')}` 
    };
  }
  
  getBitmapFormatInfo(bitmapFormat, hasAlpha = false) {
    const formats = {
      3: {
        name: "8-bit indexed color",
        bitsPerPixel: 8,
        description: "Palette-based color with color table",
        alphaSupport: hasAlpha ? "RGBA palette entries" : "No alpha"
      },
      4: {
        name: "15-bit RGB",
        bitsPerPixel: 15,
        description: "Direct color: 5 bits each for R, G, B",
        alphaSupport: hasAlpha ? "1-bit alpha" : "No alpha"
      },
      5: {
        name: hasAlpha ? "32-bit ARGB" : "24-bit RGB",
        bitsPerPixel: hasAlpha ? 32 : 24,
        description: hasAlpha ? "8 bits each for A, R, G, B" : "8 bits each for R, G, B",
        alphaSupport: hasAlpha ? "8-bit alpha" : "No alpha"
      }
    };
    
    return formats[bitmapFormat] || {
      name: `Unknown format ${bitmapFormat}`,
      bitsPerPixel: "Unknown",
      description: "Unrecognized bitmap format",
      alphaSupport: "Unknown"
    };
  }
  
  estimateUncompressedSize(bitmapFormat, width, height, colorTableSize = null, hasAlpha = false) {
    const pixelCount = width * height;
    let bytesPerPixel;
    let colorTableBytes = 0;
    
    switch (bitmapFormat) {
      case 3: // 8-bit indexed
        bytesPerPixel = 1;
        const paletteEntries = (colorTableSize || 0) + 1;
        colorTableBytes = paletteEntries * (hasAlpha ? 4 : 3); // RGBA or RGB palette
        break;
      case 4: // 15-bit RGB
        bytesPerPixel = 2;
        break;
      case 5: // 24-bit RGB or 32-bit ARGB
        bytesPerPixel = hasAlpha ? 4 : 3;
        break;
      default:
        return "Unknown format - cannot estimate";
    }
    
    const imageDataBytes = pixelCount * bytesPerPixel;
    const totalBytes = imageDataBytes + colorTableBytes;
    
    return {
      imageDataBytes: imageDataBytes,
      colorTableBytes: colorTableBytes,
      totalBytes: totalBytes,
      formattedSize: this.formatBytes(totalBytes),
      compressionRatio: "Unknown (depends on ZLIB compression)"
    };
  }
  
  formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} bytes`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
      
      if (data.imageFormat) {
        lines.push(`  └─ Format: ${data.imageFormat}`);
      }
      
      if (data.width && data.height) {
        lines.push(`  └─ Dimensions: ${data.width} × ${data.height} pixels`);
        lines.push(`  └─ Total Pixels: ${data.pixelCount?.toLocaleString() || 'Unknown'}`);
      }
      
      if (data.dataLength) {
        lines.push(`  └─ Data Size: ${this.formatBytes(data.dataLength)}`);
      }
      
      if (data.hasAlpha !== undefined) {
        lines.push(`  └─ Alpha Channel: ${data.hasAlpha ? 'Yes' : 'No'}`);
      }
      
      if (data.compressionType) {
        lines.push(`  └─ Compression: ${data.compressionType}`);
      }
      
      if (data.formatInfo && data.formatInfo.name) {
        lines.push(`  └─ Pixel Format: ${data.formatInfo.name}`);
        lines.push(`  └─ Bits Per Pixel: ${data.formatInfo.bitsPerPixel}`);
      }
      
      if (data.colorTableSize !== null && data.colorTableSize !== undefined) {
        lines.push(`  └─ Palette Colors: ${data.colorTableSize + 1}`);
      }
      
      if (data.estimatedUncompressedSize && typeof data.estimatedUncompressedSize === 'object') {
        lines.push(`  └─ Estimated Uncompressed: ${data.estimatedUncompressedSize.formattedSize}`);
      }
      
      if (data.requiresJPEGTables) {
        lines.push(`  └─ Requires JPEG Tables: Yes`);
      }
      
      if (data.formatDetails && data.formatDetails.confidence) {
        lines.push(`  └─ Format Detection: ${data.formatDetails.confidence} confidence`);
        if (data.formatDetails.details) {
          lines.push(`  └─ Details: ${data.formatDetails.details}`);
        }
      }
      
      if (data.note) {
        lines.push(`  └─ ${data.note}`);
      }
    }
    
    return lines.join('\n');
  }
}

// Export for use by other parsers
window.BitmapParsers = BitmapParsers;
