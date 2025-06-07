/* 
 * SWF Data Types Parser - v1.1
 * Core data structure parsing for SWF format
 * Foundation for all other tag parsers
 * Fixed: Added formatRect method for consistency with ShapeParsers
 */
class SWFDataTypes {
  constructor() {
    // Initialize any needed constants
    this.TWIPS_PER_PIXEL = 20;
  }
  
  // ==================== BASIC INTEGER TYPES ====================
  
  parseUI8(reader) {
    return reader.readBits(8);
  }
  
  parseUI16(reader) {
    // 16-bit unsigned integer, little-endian
    const low = reader.readBits(8);
    const high = reader.readBits(8);
    return low | (high << 8);
  }
  
  parseUI32(reader) {
    // 32-bit unsigned integer, little-endian
    const byte1 = reader.readBits(8);
    const byte2 = reader.readBits(8);
    const byte3 = reader.readBits(8);
    const byte4 = reader.readBits(8);
    return byte1 | (byte2 << 8) | (byte3 << 16) | (byte4 << 24);
  }
  
  parseSI8(reader) {
    const value = reader.readBits(8);
    // Convert to signed
    return value > 127 ? value - 256 : value;
  }
  
  parseSI16(reader) {
    const value = this.parseUI16(reader);
    // Convert to signed
    return value > 32767 ? value - 65536 : value;
  }
  
  parseSI32(reader) {
    const value = this.parseUI32(reader);
    // Convert to signed (JavaScript handles this automatically for 32-bit)
    return value | 0;
  }
  
  // ==================== FIXED-POINT NUMBERS ====================
  
  parseFIXED8(reader) {
    // 8.8 fixed point (8 bits integer, 8 bits fractional)
    const fractional = this.parseUI8(reader);
    const integer = this.parseUI8(reader);
    return integer + (fractional / 256.0);
  }
  
  parseFIXED16(reader) {
    // 16.16 fixed point (16 bits integer, 16 bits fractional)
    const fractional = this.parseUI16(reader);
    const integer = this.parseSI16(reader);
    return integer + (fractional / 65536.0);
  }
  
  // ==================== COLOR TYPES ====================
  
  parseRGB(reader) {
    return {
      red: this.parseUI8(reader),
      green: this.parseUI8(reader),
      blue: this.parseUI8(reader)
    };
  }
  
  parseRGBA(reader) {
    return {
      red: this.parseUI8(reader),
      green: this.parseUI8(reader),
      blue: this.parseUI8(reader),
      alpha: this.parseUI8(reader)
    };
  }
  
  parseARGB(reader) {
    return {
      alpha: this.parseUI8(reader),
      red: this.parseUI8(reader),
      green: this.parseUI8(reader),
      blue: this.parseUI8(reader)
    };
  }
  
  // ==================== STRING TYPES ====================
  
  parseSTRING(reader) {
    let result = '';
    let byte;
    
    while ((byte = this.parseUI8(reader)) !== 0) {
      result += String.fromCharCode(byte);
    }
    
    return result;
  }
  
  parseLANGCODE(reader) {
    return this.parseUI8(reader);
  }
  
  // ==================== COMPLEX STRUCTURES ====================
  
  parseRECT(reader) {
    // Move existing RECT parsing from Parse.js here
    // First 5 bits contain the number of bits for each coordinate
    const nbits = reader.readBits(5);
    
    // Read Xmin, Xmax, Ymin, Ymax (each using NBits bits)
    const xMin = reader.readSignedBits(nbits);
    const xMax = reader.readSignedBits(nbits);
    const yMin = reader.readSignedBits(nbits);
    const yMax = reader.readSignedBits(nbits);
    
    return { 
      xMin, 
      xMax, 
      yMin, 
      yMax,
      // Add pixel conversions for convenience
      xMinPixels: xMin / this.TWIPS_PER_PIXEL,
      xMaxPixels: xMax / this.TWIPS_PER_PIXEL,
      yMinPixels: yMin / this.TWIPS_PER_PIXEL,
      yMaxPixels: yMax / this.TWIPS_PER_PIXEL
    };
  }
  
  parseMATRIX(reader) {
    const matrix = {};
    
    // HasScale flag
    const hasScale = reader.readBits(1);
    if (hasScale) {
      const nScaleBits = reader.readBits(5);
      matrix.scaleX = reader.readSignedBits(nScaleBits) / 65536.0;
      matrix.scaleY = reader.readSignedBits(nScaleBits) / 65536.0;
    } else {
      matrix.scaleX = 1.0;
      matrix.scaleY = 1.0;
    }
    
    // HasRotate flag
    const hasRotate = reader.readBits(1);
    if (hasRotate) {
      const nRotateBits = reader.readBits(5);
      matrix.rotateSkew0 = reader.readSignedBits(nRotateBits) / 65536.0;
      matrix.rotateSkew1 = reader.readSignedBits(nRotateBits) / 65536.0;
    } else {
      matrix.rotateSkew0 = 0.0;
      matrix.rotateSkew1 = 0.0;
    }
    
    // Translate (always present)
    const nTranslateBits = reader.readBits(5);
    matrix.translateX = reader.readSignedBits(nTranslateBits);
    matrix.translateY = reader.readSignedBits(nTranslateBits);
    
    // Add pixel conversions
    matrix.translateXPixels = matrix.translateX / this.TWIPS_PER_PIXEL;
    matrix.translateYPixels = matrix.translateY / this.TWIPS_PER_PIXEL;
    
    return matrix;
  }
  
  parseCXFORM(reader) {
    const cxform = {};
    
    // HasAddTerms and HasMultTerms flags
    const hasAddTerms = reader.readBits(1);
    const hasMultTerms = reader.readBits(1);
    
    // Number of bits for each component
    const nbits = reader.readBits(4);
    
    if (hasMultTerms) {
      cxform.redMultTerm = reader.readSignedBits(nbits);
      cxform.greenMultTerm = reader.readSignedBits(nbits);
      cxform.blueMultTerm = reader.readSignedBits(nbits);
    } else {
      cxform.redMultTerm = 256; // 1.0 in 8.8 fixed point
      cxform.greenMultTerm = 256;
      cxform.blueMultTerm = 256;
    }
    
    if (hasAddTerms) {
      cxform.redAddTerm = reader.readSignedBits(nbits);
      cxform.greenAddTerm = reader.readSignedBits(nbits);
      cxform.blueAddTerm = reader.readSignedBits(nbits);
    } else {
      cxform.redAddTerm = 0;
      cxform.greenAddTerm = 0;
      cxform.blueAddTerm = 0;
    }
    
    return cxform;
  }
  
  parseCXFORMA(reader) {
    const cxform = {};
    
    // HasAddTerms and HasMultTerms flags
    const hasAddTerms = reader.readBits(1);
    const hasMultTerms = reader.readBits(1);
    
    // Number of bits for each component
    const nbits = reader.readBits(4);
    
    if (hasMultTerms) {
      cxform.redMultTerm = reader.readSignedBits(nbits);
      cxform.greenMultTerm = reader.readSignedBits(nbits);
      cxform.blueMultTerm = reader.readSignedBits(nbits);
      cxform.alphaMultTerm = reader.readSignedBits(nbits);
    } else {
      cxform.redMultTerm = 256; // 1.0 in 8.8 fixed point
      cxform.greenMultTerm = 256;
      cxform.blueMultTerm = 256;
      cxform.alphaMultTerm = 256;
    }
    
    if (hasAddTerms) {
      cxform.redAddTerm = reader.readSignedBits(nbits);
      cxform.greenAddTerm = reader.readSignedBits(nbits);
      cxform.blueAddTerm = reader.readSignedBits(nbits);
      cxform.alphaAddTerm = reader.readSignedBits(nbits);
    } else {
      cxform.redAddTerm = 0;
      cxform.greenAddTerm = 0;
      cxform.blueAddTerm = 0;
      cxform.alphaAddTerm = 0;
    }
    
    return cxform;
  }
  
  // ==================== UTILITY METHODS ====================
  
  formatColor(color) {
    if (color.alpha !== undefined) {
      return `RGBA(${color.red}, ${color.green}, ${color.blue}, ${color.alpha})`;
    } else {
      return `RGB(${color.red}, ${color.green}, ${color.blue})`;
    }
  }
  
  formatMatrix(matrix) {
    return `Scale(${matrix.scaleX.toFixed(3)}, ${matrix.scaleY.toFixed(3)}) ` +
           `Rotate(${matrix.rotateSkew0.toFixed(3)}, ${matrix.rotateSkew1.toFixed(3)}) ` +
           `Translate(${matrix.translateXPixels.toFixed(1)}px, ${matrix.translateYPixels.toFixed(1)}px)`;
  }
  
  // ADDED: formatRect method for consistency with ShapeParsers
  formatRect(rect) {
    if (!rect || typeof rect !== 'object') {
      return "Invalid rectangle";
    }
    
    // Calculate dimensions in twips
    const width = (rect.xMax || 0) - (rect.xMin || 0);
    const height = (rect.yMax || 0) - (rect.yMin || 0);
    
    // Convert to pixels for display
    const widthPx = width / this.TWIPS_PER_PIXEL;
    const heightPx = height / this.TWIPS_PER_PIXEL;
    
    // Use already calculated pixel values if available, otherwise convert
    const xMinPx = rect.xMinPixels !== undefined ? rect.xMinPixels : (rect.xMin || 0) / this.TWIPS_PER_PIXEL;
    const yMinPx = rect.yMinPixels !== undefined ? rect.yMinPixels : (rect.yMin || 0) / this.TWIPS_PER_PIXEL;
    const xMaxPx = rect.xMaxPixels !== undefined ? rect.xMaxPixels : (rect.xMax || 0) / this.TWIPS_PER_PIXEL;
    const yMaxPx = rect.yMaxPixels !== undefined ? rect.yMaxPixels : (rect.yMax || 0) / this.TWIPS_PER_PIXEL;
    
    return `${widthPx.toFixed(1)}x${heightPx.toFixed(1)}px (${xMinPx.toFixed(1)}, ${yMinPx.toFixed(1)}) to (${xMaxPx.toFixed(1)}, ${yMaxPx.toFixed(1)})`;
  }
}

// Export for use by other parsers
window.SWFDataTypes = SWFDataTypes;
