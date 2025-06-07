/*
 * SWF Data Types Parser - v2.1
 * Handles parsing of Flash SWF primitive data types and bit manipulation
 * Used by all other parsers for consistent data reading
 * FIXED: Added missing formatRECT method for morph shape parsing
 */

class BitReader {
  constructor(buffer, offset = 0) {
    this.buffer = buffer;
    this.byteOffset = offset;
    this.bitOffset = 0;
  }
  
  readBits(numBits) {
    let result = 0;
    
    for (let i = 0; i < numBits; i++) {
      if (this.byteOffset >= this.buffer.length) {
        throw new Error("BitReader: End of buffer reached");
      }
      
      const bit = (this.buffer[this.byteOffset] >> (7 - this.bitOffset)) & 1;
      result = (result << 1) | bit;
      
      this.bitOffset++;
      if (this.bitOffset === 8) {
        this.bitOffset = 0;
        this.byteOffset++;
      }
    }
    
    return result;
  }
  
  readSignedBits(numBits) {
    const value = this.readBits(numBits);
    const signBit = 1 << (numBits - 1);
    
    if (value & signBit) {
      return value - (signBit << 1);
    }
    return value;
  }
  
  align() {
    if (this.bitOffset !== 0) {
      this.bitOffset = 0;
      this.byteOffset++;
    }
  }
  
  skipBits(numBits) {
    this.bitOffset += numBits;
    while (this.bitOffset >= 8) {
      this.bitOffset -= 8;
      this.byteOffset++;
    }
  }
}

class SWFDataTypes {
  constructor() {
    // Data type constants
    this.TWIPS_PER_PIXEL = 20;
  }
  
  // ==================== PRIMITIVE TYPES ====================
  
  parseUI8(reader) {
    if (reader.byteOffset >= reader.buffer.length) {
      throw new Error("parseUI8: End of buffer");
    }
    reader.align();
    return reader.buffer[reader.byteOffset++];
  }
  
  parseUI16(reader) {
    reader.align();
    if (reader.byteOffset + 1 >= reader.buffer.length) {
      throw new Error("parseUI16: End of buffer");
    }
    const value = reader.buffer[reader.byteOffset] | (reader.buffer[reader.byteOffset + 1] << 8);
    reader.byteOffset += 2;
    return value;
  }
  
  parseUI32(reader) {
    reader.align();
    if (reader.byteOffset + 3 >= reader.buffer.length) {
      throw new Error("parseUI32: End of buffer");
    }
    const value = reader.buffer[reader.byteOffset] |
                  (reader.buffer[reader.byteOffset + 1] << 8) |
                  (reader.buffer[reader.byteOffset + 2] << 16) |
                  (reader.buffer[reader.byteOffset + 3] << 24);
    reader.byteOffset += 4;
    return value >>> 0; // Ensure unsigned
  }
  
  parseUB(reader, numBits) {
    return reader.readBits(numBits);
  }
  
  parseSB(reader, numBits) {
    return reader.readSignedBits(numBits);
  }
  
  parseFIXED(reader) {
    const value = this.parseUI32(reader);
    return value / 65536.0;
  }
  
  parseFIXED8(reader) {
    const value = this.parseUI16(reader);
    return value / 256.0;
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
  
  // ==================== GEOMETRIC TYPES ====================
  
  parseRECT(reader) {
    const nBits = this.parseUB(reader, 5);
    
    const xMin = this.parseSB(reader, nBits);
    const xMax = this.parseSB(reader, nBits);
    const yMin = this.parseSB(reader, nBits);
    const yMax = this.parseSB(reader, nBits);
    
    reader.align();
    
    return {
      xMin: xMin,
      xMax: xMax,
      yMin: yMin,
      yMax: yMax,
      nBits: nBits
    };
  }
  
  formatRECT(rect) {
    if (!rect) return "null";
    
    const pixelXMin = (rect.xMin / this.TWIPS_PER_PIXEL).toFixed(1);
    const pixelXMax = (rect.xMax / this.TWIPS_PER_PIXEL).toFixed(1);
    const pixelYMin = (rect.yMin / this.TWIPS_PER_PIXEL).toFixed(1);
    const pixelYMax = (rect.yMax / this.TWIPS_PER_PIXEL).toFixed(1);
    
    const width = Math.abs(rect.xMax - rect.xMin) / this.TWIPS_PER_PIXEL;
    const height = Math.abs(rect.yMax - rect.yMin) / this.TWIPS_PER_PIXEL;
    
    return {
      twips: {
        xMin: rect.xMin,
        xMax: rect.xMax,
        yMin: rect.yMin,
        yMax: rect.yMax
      },
      pixels: {
        xMin: parseFloat(pixelXMin),
        xMax: parseFloat(pixelXMax),
        yMin: parseFloat(pixelYMin),
        yMax: parseFloat(pixelYMax)
      },
      dimensions: {
        width: parseFloat(width.toFixed(1)),
        height: parseFloat(height.toFixed(1))
      },
      formatted: `(${pixelXMin},${pixelYMin}) to (${pixelXMax},${pixelYMax}) [${width.toFixed(1)}×${height.toFixed(1)}px]`
    };
  }
  
  parseMATRIX(reader) {
    const matrix = {
      scaleX: 1.0,
      scaleY: 1.0,
      rotateSkew0: 0.0,
      rotateSkew1: 0.0,
      translateX: 0,
      translateY: 0
    };
    
    // HasScale
    const hasScale = this.parseUB(reader, 1);
    if (hasScale) {
      const nScaleBits = this.parseUB(reader, 5);
      matrix.scaleX = this.parseSB(reader, nScaleBits) / 65536.0;
      matrix.scaleY = this.parseSB(reader, nScaleBits) / 65536.0;
    }
    
    // HasRotate
    const hasRotate = this.parseUB(reader, 1);
    if (hasRotate) {
      const nRotateBits = this.parseUB(reader, 5);
      matrix.rotateSkew0 = this.parseSB(reader, nRotateBits) / 65536.0;
      matrix.rotateSkew1 = this.parseSB(reader, nRotateBits) / 65536.0;
    }
    
    // Translate (always present)
    const nTranslateBits = this.parseUB(reader, 5);
    matrix.translateX = this.parseSB(reader, nTranslateBits);
    matrix.translateY = this.parseSB(reader, nTranslateBits);
    
    reader.align();
    
    return matrix;
  }
  
  formatMatrix(matrix) {
    if (!matrix) return "null";
    
    const scaleXPercent = (matrix.scaleX * 100).toFixed(1);
    const scaleYPercent = (matrix.scaleY * 100).toFixed(1);
    const translateXPixels = (matrix.translateX / this.TWIPS_PER_PIXEL).toFixed(1);
    const translateYPixels = (matrix.translateY / this.TWIPS_PER_PIXEL).toFixed(1);
    
    return {
      scale: {
        x: matrix.scaleX,
        y: matrix.scaleY,
        formatted: `${scaleXPercent}% × ${scaleYPercent}%`
      },
      rotation: {
        skew0: matrix.rotateSkew0,
        skew1: matrix.rotateSkew1,
        formatted: matrix.rotateSkew0 !== 0 || matrix.rotateSkew1 !== 0 ? 
          `skew(${matrix.rotateSkew0.toFixed(3)}, ${matrix.rotateSkew1.toFixed(3)})` : "none"
      },
      translation: {
        x: matrix.translateX,
        y: matrix.translateY,
        pixels: {
          x: parseFloat(translateXPixels),
          y: parseFloat(translateYPixels)
        },
        formatted: `(${translateXPixels}px, ${translateYPixels}px)`
      },
      isIdentity: matrix.scaleX === 1.0 && matrix.scaleY === 1.0 && 
                  matrix.rotateSkew0 === 0.0 && matrix.rotateSkew1 === 0.0 &&
                  matrix.translateX === 0 && matrix.translateY === 0
    };
  }
  
  parseCXFORM(reader) {
    const hasAddTerms = this.parseUB(reader, 1);
    const hasMultTerms = this.parseUB(reader, 1);
    const nBits = this.parseUB(reader, 4);
    
    const transform = {};
    
    if (hasMultTerms) {
      transform.redMultTerm = this.parseSB(reader, nBits);
      transform.greenMultTerm = this.parseSB(reader, nBits);
      transform.blueMultTerm = this.parseSB(reader, nBits);
    } else {
      transform.redMultTerm = 256;
      transform.greenMultTerm = 256;
      transform.blueMultTerm = 256;
    }
    
    if (hasAddTerms) {
      transform.redAddTerm = this.parseSB(reader, nBits);
      transform.greenAddTerm = this.parseSB(reader, nBits);
      transform.blueAddTerm = this.parseSB(reader, nBits);
    } else {
      transform.redAddTerm = 0;
      transform.greenAddTerm = 0;
      transform.blueAddTerm = 0;
    }
    
    reader.align();
    
    return transform;
  }
  
  parseCXFORMA(reader) {
    const hasAddTerms = this.parseUB(reader, 1);
    const hasMultTerms = this.parseUB(reader, 1);
    const nBits = this.parseUB(reader, 4);
    
    const transform = {};
    
    if (hasMultTerms) {
      transform.redMultTerm = this.parseSB(reader, nBits);
      transform.greenMultTerm = this.parseSB(reader, nBits);
      transform.blueMultTerm = this.parseSB(reader, nBits);
      transform.alphaMultTerm = this.parseSB(reader, nBits);
    } else {
      transform.redMultTerm = 256;
      transform.greenMultTerm = 256;
      transform.blueMultTerm = 256;
      transform.alphaMultTerm = 256;
    }
    
    if (hasAddTerms) {
      transform.redAddTerm = this.parseSB(reader, nBits);
      transform.greenAddTerm = this.parseSB(reader, nBits);
      transform.blueAddTerm = this.parseSB(reader, nBits);
      transform.alphaAddTerm = this.parseSB(reader, nBits);
    } else {
      transform.redAddTerm = 0;
      transform.greenAddTerm = 0;
      transform.blueAddTerm = 0;
      transform.alphaAddTerm = 0;
    }
    
    reader.align();
    
    return transform;
  }
  
  // ==================== STRING TYPES ====================
  
  parseString(reader, encoding = 'utf8') {
    reader.align();
    const chars = [];
    
    while (reader.byteOffset < reader.buffer.length) {
      const byte = reader.buffer[reader.byteOffset++];
      if (byte === 0) break;
      chars.push(byte);
    }
    
    if (encoding === 'utf8') {
      return new TextDecoder('utf-8').decode(new Uint8Array(chars));
    } else {
      return String.fromCharCode(...chars);
    }
  }
  
  parseFixedString(reader, length, encoding = 'utf8') {
    reader.align();
    const chars = [];
    
    for (let i = 0; i < length && reader.byteOffset < reader.buffer.length; i++) {
      const byte = reader.buffer[reader.byteOffset++];
      if (byte !== 0) chars.push(byte);
    }
    
    if (encoding === 'utf8') {
      return new TextDecoder('utf-8').decode(new Uint8Array(chars));
    } else {
      return String.fromCharCode(...chars);
    }
  }
  
  // ==================== UTILITY METHODS ====================
  
  formatBytes(bytes) {
    if (bytes === 0) return "0 bytes";
    const k = 1024;
    const sizes = ['bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
  
  formatBitrate(bitsPerSecond) {
    if (bitsPerSecond === 0) return "0 bps";
    const k = 1000;
    const sizes = ['bps', 'kbps', 'Mbps', 'Gbps'];
    const i = Math.floor(Math.log(bitsPerSecond) / Math.log(k));
    return parseFloat((bitsPerSecond / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
  
  formatFrequency(hz) {
    if (hz === 0) return "0 Hz";
    if (hz >= 1000) {
      return (hz / 1000).toFixed(1) + ' kHz';
    }
    return hz + ' Hz';
  }
  
  formatColor(color) {
    if (!color) return "null";
    
    if (color.alpha !== undefined) {
      return `rgba(${color.red}, ${color.green}, ${color.blue}, ${(color.alpha / 255).toFixed(2)})`;
    } else {
      return `rgb(${color.red}, ${color.green}, ${color.blue})`;
    }
  }
  
  formatPercentage(value, total) {
    if (total === 0) return "0%";
    return ((value / total) * 100).toFixed(1) + "%";
  }
  
  twipsToPixels(twips) {
    return twips / this.TWIPS_PER_PIXEL;
  }
  
  pixelsToTwips(pixels) {
    return pixels * this.TWIPS_PER_PIXEL;
  }
}

// Export BitReader and SWFDataTypes for use by other parsers
window.BitReader = BitReader;
window.SWFDataTypes = SWFDataTypes;
