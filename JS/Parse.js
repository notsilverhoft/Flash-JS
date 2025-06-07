/* 
 * SWF Parser - v5.2
 * Supports:
 * - Header parsing (FWS, CWS, ZWS)
 * - RECT structure parsing
 * - Frame rate and frame count parsing
 * - FIXED: CWS decompression variable name bug
 */
function parseSWFSignature(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  const output = [];
  
  if (arrayBuffer.byteLength < 8) {
    output.push("Invalid SWF file: File is too small");
    return output.join('\n');
  }
  
  // Read the first three bytes as ASCII characters
  const signature = String.fromCharCode(bytes[0], bytes[1], bytes[2]);
  
  // Create a DataView for easier parsing of integers
  const dataView = new DataView(arrayBuffer);
  
  // Read the file version (byte 3)
  const version = bytes[3];
  
  // Read the file size (bytes 4-7, little-endian)
  const fileLength = dataView.getUint32(4, true);
  
  output.push(`Signature: ${signature}`);
  output.push(`Version: ${version}`);
  output.push(`File Length: ${fileLength} bytes`);
  output.push("------------------------------");

  // Process data based on signature type
  switch (signature) {
    case 'FWS':
      output.push("Compression: None (Uncompressed)");
      
      try {
        // Parse RECT structure
        const rect = parseRECT(bytes, 8);
        output.push("RECT Dimensions:");
        output.push(`Xmin: ${rect.xMin}`);
        output.push(`Xmax: ${rect.xMax}`);
        output.push(`Ymin: ${rect.yMin}`);
        output.push(`Ymax: ${rect.yMax}`);
        
        // Calculate where the RECT structure ends
        const nbits = (bytes[8] >> 3) & 0x1F;
        const rectBits = 5 + (4 * nbits);
        const rectBytes = Math.ceil(rectBits / 8);
        const frameRateOffset = 8 + rectBytes;
        
        // Parse frame rate (8.8 fixed point number)
        const frameRateFractional = bytes[frameRateOffset];
        const frameRateInteger = bytes[frameRateOffset + 1];
        const frameRate = frameRateInteger + (frameRateFractional / 256);
        
        // Parse frame count (16-bit unsigned integer, little-endian)
        const frameCount = bytes[frameRateOffset + 2] | 
                          (bytes[frameRateOffset + 3] << 8);
        
        output.push(`Frame Rate: ${frameRate.toFixed(2)} fps`);
        output.push(`Frame Count: ${frameCount}`);
        
        // Calculate where tag data begins
        const tagOffset = frameRateOffset + 4;
        output.push(`Tag Data Begins at Offset: ${tagOffset}`);
        
      } catch (error) {
        output.push(`Error parsing SWF structure: ${error.message}`);
      }
      break;
      
    case 'CWS':
      output.push("Compression: ZLIB (Compressed from byte 8 onward)");
      
      try {
        // Extract the compressed data (skip the 8-byte header)
        const compressedData = arrayBuffer.slice(8);
        
        // Decompress using pako (ZLIB)
        const decompressedData = pako.inflate(new Uint8Array(compressedData));
        output.push("Decompression successful.");
        output.push(`Decompressed length: ${decompressedData.length} bytes`);
        
        // Create a full SWF with header + decompressed data
        const headerAndData = new Uint8Array(8 + decompressedData.length);
        // Copy header (first 8 bytes) but replace CWS with FWS for parsing
        headerAndData.set(bytes.slice(0, 8));
        headerAndData[0] = 0x46; // 'F' instead of 'C'
        headerAndData.set(decompressedData, 8); // FIXED: was "decompressed", now "decompressedData"
        
        try {
          // Parse RECT structure
          const rect = parseRECT(headerAndData, 8);
          output.push("RECT Dimensions:");
          output.push(`Xmin: ${rect.xMin}`);
          output.push(`Xmax: ${rect.xMax}`);
          output.push(`Ymin: ${rect.yMin}`);
          output.push(`Ymax: ${rect.yMax}`);
          
          // Calculate where the RECT structure ends
          const nbits = (headerAndData[8] >> 3) & 0x1F;
          const rectBits = 5 + (4 * nbits);
          const rectBytes = Math.ceil(rectBits / 8);
          const frameRateOffset = 8 + rectBytes;
          
          // Parse frame rate (8.8 fixed point number)
          const frameRateFractional = headerAndData[frameRateOffset];
          const frameRateInteger = headerAndData[frameRateOffset + 1];
          const frameRate = frameRateInteger + (frameRateFractional / 256);
          
          // Parse frame count (16-bit unsigned integer, little-endian)
          const frameCount = headerAndData[frameRateOffset + 2] | 
                            (headerAndData[frameRateOffset + 3] << 8);
          
          output.push(`Frame Rate: ${frameRate.toFixed(2)} fps`);
          output.push(`Frame Count: ${frameCount}`);
          
          // Calculate where tag data begins
          const tagOffset = frameRateOffset + 4;
          output.push(`Tag Data Begins at Offset: ${tagOffset}`);
          
        } catch (rectError) {
          output.push(`Error parsing RECT: ${rectError.message}`);
        }
      } catch (error) {
        output.push(`Decompression failed: ${error.message}`);
      }
      break;
      
    case 'ZWS':
      output.push("Compression: LZMA (Compressed from byte 12 onward)");
      
      try {
        // Verify LZMA library is loaded
        if (typeof LZMA === 'undefined') {
          output.push("Error: LZMA library is not loaded.");
          output.push("Please check your browser console for network errors.");
          output.push("Try downloading the LZMA library and serving it locally.");
          return output.join('\n');
        }
        
        // Check for the decompress method
        if (!LZMA.decompress) {
          output.push("Error: LZMA library loaded but decompress method not found.");
          output.push("Library Version Info: " + (LZMA.version || "Unknown"));
          output.push("Available methods: " + Object.keys(LZMA).join(", "));
          return output.join('\n');
        }
        
        // Extract the uncompressed length (bytes 8-12, little endian)
        const uncompressedLength = dataView.getUint32(8, true);
        output.push(`Expected uncompressed length: ${uncompressedLength} bytes`);
        
        // Prepare the LZMA data - include properties and size
        const lzmaData = new Uint8Array(5 + 8 + (arrayBuffer.byteLength - 17));
        
        // Copy LZMA properties (5 bytes)
        lzmaData.set(bytes.slice(12, 17), 0);
        
        // Set uncompressed size (8 bytes, little endian)
        for (let i = 0; i < 8; i++) {
          if (i < 4) {
            lzmaData[5 + i] = (uncompressedLength >> (i * 8)) & 0xFF;
          } else {
            lzmaData[5 + i] = 0; // High bytes are 0 for sizes < 4GB
          }
        }
        
        // Copy compressed data
        lzmaData.set(bytes.slice(17), 13);
        
        output.push("Starting LZMA decompression (this may take a moment)...");
        
        // Use the LZMA-JS decompress method with proper error handling
        try {
          LZMA.decompress(lzmaData, function(result, error) {
            if (error) {
              const errorMessage = `LZMA decompression failed: ${error}`;
              output.push(errorMessage);
              document.getElementById('terminalOutput').textContent = output.join('\n');
              return;
            }
            
            const decompressedData = new Uint8Array(result);
            output.push("LZMA Decompression successful.");
            output.push(`Decompressed length: ${decompressedData.length} bytes`);
            
            try {
              // Create a full SWF with header + decompressed data
              const headerAndData = new Uint8Array(8 + decompressedData.length);
              // Copy header (first 8 bytes) but replace ZWS with FWS for parsing
              headerAndData.set(bytes.slice(0, 8));
              headerAndData[0] = 0x46; // 'F' instead of 'Z'
              headerAndData.set(decompressedData, 8);
              
              // Parse RECT structure
              const rect = parseRECT(headerAndData, 8);
              output.push("RECT Dimensions:");
              output.push(`Xmin: ${rect.xMin}`);
              output.push(`Xmax: ${rect.xMax}`);
              output.push(`Ymin: ${rect.yMin}`);
              output.push(`Ymax: ${rect.yMax}`);
              
              // Calculate where the RECT structure ends
              const nbits = (headerAndData[8] >> 3) & 0x1F;
              const rectBits = 5 + (4 * nbits);
              const rectBytes = Math.ceil(rectBits / 8);
              const frameRateOffset = 8 + rectBytes;
              
              // Parse frame rate (8.8 fixed point number)
              const frameRateFractional = headerAndData[frameRateOffset];
              const frameRateInteger = headerAndData[frameRateOffset + 1];
              const frameRate = frameRateInteger + (frameRateFractional / 256);
              
              // Parse frame count (16-bit unsigned integer, little-endian)
              const frameCount = headerAndData[frameRateOffset + 2] | 
                                (headerAndData[frameRateOffset + 3] << 8);
              
              output.push(`Frame Rate: ${frameRate.toFixed(2)} fps`);
              output.push(`Frame Count: ${frameCount}`);
              
              // Calculate where tag data begins
              const tagOffset = frameRateOffset + 4;
              output.push(`Tag Data Begins at Offset: ${tagOffset}`);
              
            } catch (rectError) {
              output.push(`Error parsing RECT: ${rectError.message}`);
            }
            
            // Update the terminal with the complete output
            document.getElementById('terminalOutput').textContent = output.join('\n');
          });
          
        } catch (lzmaCallError) {
          output.push(`Error calling LZMA.decompress: ${lzmaCallError.message}`);
          output.push("This might be due to an incompatibility with the loaded LZMA library.");
          return output.join('\n');
        }
        
        output.push("LZMA decompression started. Please wait...");
        
      } catch (error) {
        output.push(`LZMA processing error: ${error.message}`);
      }
      break;
      
    default:
      output.push(`Unknown SWF format: ${signature}`);
  }
  
  return output.join('\n');
}

function parseRECT(bytes, offset) {
  // Read the RECT structure
  // First byte contains the number of bits (NBits) in the first 5 bits
  const nbits = (bytes[offset] >> 3) & 0x1F;
  
  // Create a bit reader to read bits from the byte array
  const reader = new BitReader(bytes, offset);
  
  // Read NBits (first 5 bits)
  reader.readBits(5);
  
  // Read Xmin, Xmax, Ymin, Ymax (each using NBits bits)
  const xMin = reader.readSignedBits(nbits);
  const xMax = reader.readSignedBits(nbits);
  const yMin = reader.readSignedBits(nbits);
  const yMax = reader.readSignedBits(nbits);
  
  return { xMin, xMax, yMin, yMax };
}

class BitReader {
  constructor(bytes, offset = 0) {
    this.bytes = bytes;
    this.byteIndex = offset;
    this.bitIndex = 0;
  }
  
  readBits(numBits) {
    let result = 0;
    let bitsRemaining = numBits;
    
    while (bitsRemaining > 0) {
      // If we've used all bits in the current byte, move to the next byte
      if (this.bitIndex === 0) {
        this.currentByte = this.bytes[this.byteIndex];
        this.byteIndex++;
      }
      
      // Determine how many bits to read from the current byte
      const bitsToRead = Math.min(8 - this.bitIndex, bitsRemaining);
      
      // Mask and shift to get the bits we want from the current byte
      const mask = (1 << bitsToRead) - 1;
      const shift = 8 - this.bitIndex - bitsToRead;
      const bits = (this.currentByte >> shift) & mask;
      
      // Add these bits to our result
      result = (result << bitsToRead) | bits;
      
      // Update bit index and remaining bits
      this.bitIndex = (this.bitIndex + bitsToRead) % 8;
      bitsRemaining -= bitsToRead;
    }
    
    return result;
  }
  
  readSignedBits(numBits) {
    // Read bits as unsigned
    const value = this.readBits(numBits);
    
    // Check if this is a negative number (if the first bit is set)
    const isNegative = value & (1 << (numBits - 1));
    
    if (isNegative) {
      // Calculate the two's complement to get the negative value
      const mask = (1 << numBits) - 1;
      return -((~value & mask) + 1);
    } else {
      return value;
    }
  }
}
