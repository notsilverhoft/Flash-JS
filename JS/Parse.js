/* 
 * SWF File Parser - v2.2
 * Parses SWF file signature, header, and basic information
 * Supports FWS (uncompressed), CWS (ZLIB), and ZWS (LZMA) formats
 * Used by index.html for initial file analysis before tag parsing
 * FIXED: Ensured parseSWFSignature is properly exposed globally
 */

function parseRECT(data, offset) {
  // Create a bit reader for the RECT data
  const reader = new BitReader(data, offset);
  
  // Read the number of bits used for each coordinate
  const nBits = reader.readBits(5);
  
  // Read the coordinates
  const xMin = reader.readSignedBits(nBits);
  const xMax = reader.readSignedBits(nBits);
  const yMin = reader.readSignedBits(nBits);
  const yMax = reader.readSignedBits(nBits);
  
  return {
    xMin: xMin,
    xMax: xMax,
    yMin: yMin,
    yMax: yMax,
    nBits: nBits
  };
}

function parseSWFSignature(arrayBuffer) {
  const output = [];
  
  if (arrayBuffer.byteLength < 8) {
    output.push("Error: File is too small to be a valid SWF file");
    return output.join('\n');
  }
  
  const bytes = new Uint8Array(arrayBuffer);
  const dataView = new DataView(arrayBuffer);
  
  // Parse signature (3 bytes)
  const signature = String.fromCharCode(bytes[0], bytes[1], bytes[2]);
  
  // Parse version (1 byte)
  const version = bytes[3];
  
  // Parse file length (4 bytes, little endian)
  const fileLength = dataView.getUint32(4, true);
  
  output.push("SWF File Analysis:");
  output.push("==================");
  output.push(`Signature: ${signature}`);
  output.push(`Version: ${version}`);
  output.push(`File Length: ${fileLength} bytes (${(fileLength / 1024).toFixed(2)} KB)`);
  
  // Determine compression type
  let compressionType;
  let compressionInfo = "";
  
  switch (signature) {
    case 'FWS':
      compressionType = "Uncompressed";
      compressionInfo = "No compression applied";
      break;
    case 'CWS':
      compressionType = "ZLIB Compressed";
      const compressedSize = arrayBuffer.byteLength - 8;
      const compressionRatio = ((fileLength - compressedSize) / fileLength * 100).toFixed(1);
      compressionInfo = `Compressed from ${fileLength} to ${arrayBuffer.byteLength} bytes (${compressionRatio}% reduction)`;
      break;
    case 'ZWS':
      compressionType = "LZMA Compressed";
      const lzmaCompressedSize = arrayBuffer.byteLength - 17; // LZMA has larger header
      const lzmaCompressionRatio = ((fileLength - lzmaCompressedSize) / fileLength * 100).toFixed(1);
      compressionInfo = `LZMA compressed from ${fileLength} to ${arrayBuffer.byteLength} bytes (${lzmaCompressionRatio}% reduction)`;
      break;
    default:
      compressionType = "Unknown";
      compressionInfo = "Unrecognized compression format";
      output.push(`Error: Unknown SWF signature '${signature}'`);
      return output.join('\n');
  }
  
  output.push(`Compression: ${compressionType}`);
  output.push(`Compression Info: ${compressionInfo}`);
  
  // Parse Flash Player version requirements
  let flashPlayerVersion = "Unknown";
  let versionNotes = "";
  
  if (version >= 1 && version <= 41) {
    const versionMap = {
      1: "Flash Player 1.0",
      2: "Flash Player 2.0", 
      3: "Flash Player 3.0",
      4: "Flash Player 4.0",
      5: "Flash Player 5.0",
      6: "Flash Player 6.0 (MX)",
      7: "Flash Player 7.0 (MX 2004)",
      8: "Flash Player 8.0",
      9: "Flash Player 9.0 (AS3 support)",
      10: "Flash Player 10.0",
      11: "Flash Player 10.1",
      12: "Flash Player 10.2",
      13: "Flash Player 10.3",
      14: "Flash Player 11.0",
      15: "Flash Player 11.1",
      16: "Flash Player 11.2",
      17: "Flash Player 11.3",
      18: "Flash Player 11.4",
      19: "Flash Player 11.5",
      20: "Flash Player 11.6",
      21: "Flash Player 11.7",
      22: "Flash Player 11.8",
      23: "Flash Player 11.9",
      24: "Flash Player 12.0",
      25: "Flash Player 13.0",
      26: "Flash Player 14.0",
      27: "Flash Player 15.0",
      28: "Flash Player 16.0",
      29: "Flash Player 17.0",
      30: "Flash Player 18.0",
      31: "Flash Player 19.0",
      32: "Flash Player 20.0",
      33: "Flash Player 21.0",
      34: "Flash Player 22.0",
      35: "Flash Player 23.0",
      36: "Flash Player 24.0",
      37: "Flash Player 25.0",
      38: "Flash Player 26.0",
      39: "Flash Player 27.0",
      40: "Flash Player 28.0",
      41: "Flash Player 29.0"
    };
    
    flashPlayerVersion = versionMap[version] || `Flash Player ${version}.0`;
    
    if (version >= 9) {
      versionNotes = " (ActionScript 3.0 supported)";
    } else if (version >= 6) {
      versionNotes = " (ActionScript 2.0 era)";
    } else {
      versionNotes = " (ActionScript 1.0 era)";
    }
  } else {
    flashPlayerVersion = `Version ${version} (Future/Unknown)`;
    versionNotes = " (May require newer Flash Player)";
  }
  
  output.push(`Flash Player Required: ${flashPlayerVersion}${versionNotes}`);
  
  // Try to parse frame rect and basic header info
  try {
    let headerData;
    let headerOffset = 8; // Skip signature, version, and file length
    
    if (signature === 'FWS') {
      // Uncompressed - parse directly
      headerData = bytes;
    } else if (signature === 'CWS') {
      // ZLIB compressed - decompress first
      try {
        if (typeof pako !== 'undefined') {
          const compressedData = arrayBuffer.slice(8);
          headerData = pako.inflate(new Uint8Array(compressedData));
          headerOffset = 0; // Reset offset for decompressed data
        } else {
          throw new Error("pako library not available");
        }
      } catch (zlibError) {
        output.push(`ZLIB Decompression: Failed (${zlibError.message})`);
        return output.join('\n');
      }
    } else if (signature === 'ZWS') {
      // LZMA compressed - note that full decompression is async
      output.push(`LZMA Decompression: Available (will be processed during tag parsing)`);
      return output.join('\n');
    }
    
    if (headerData) {
      // Parse frame rectangle
      const rect = parseRECT(headerData, headerOffset);
      
      // Calculate stage dimensions in pixels
      const stageWidth = Math.abs(rect.xMax - rect.xMin) / 20; // Convert twips to pixels
      const stageHeight = Math.abs(rect.yMax - rect.yMin) / 20;
      
      output.push(`Stage Dimensions: ${stageWidth} × ${stageHeight} pixels`);
      output.push(`Stage Bounds (twips): (${rect.xMin}, ${rect.yMin}) to (${rect.xMax}, ${rect.yMax})`);
      
      // Parse frame rate and frame count
      const rectBits = 5 + (4 * rect.nBits);
      const rectBytes = Math.ceil(rectBits / 8);
      const frameRateOffset = headerOffset + rectBytes;
      
      if (frameRateOffset + 3 < headerData.length) {
        // Frame rate is stored as 8.8 fixed point (2 bytes)
        const frameRateRaw = headerData[frameRateOffset] | (headerData[frameRateOffset + 1] << 8);
        const frameRate = frameRateRaw / 256;
        
        // Frame count (2 bytes)
        const frameCount = headerData[frameRateOffset + 2] | (headerData[frameRateOffset + 3] << 8);
        
        output.push(`Frame Rate: ${frameRate} fps`);
        output.push(`Frame Count: ${frameCount} frames`);
        
        if (frameRate > 0) {
          const duration = frameCount / frameRate;
          const minutes = Math.floor(duration / 60);
          const seconds = (duration % 60).toFixed(1);
          
          if (minutes > 0) {
            output.push(`Duration: ${minutes}:${seconds.padStart(4, '0')} (${duration.toFixed(1)} seconds)`);
          } else {
            output.push(`Duration: ${duration.toFixed(1)} seconds`);
          }
        }
        
        // Estimate performance characteristics
        const pixelsPerFrame = stageWidth * stageHeight;
        const pixelsPerSecond = pixelsPerFrame * frameRate;
        
        let performanceCategory = "Low";
        if (pixelsPerSecond > 2000000) {
          performanceCategory = "High";
        } else if (pixelsPerSecond > 500000) {
          performanceCategory = "Medium";
        }
        
        output.push(`Rendering Load: ${performanceCategory} (${Math.round(pixelsPerSecond / 1000)}K pixels/sec)`);
        
        // Animation analysis
        if (frameCount > 1) {
          if (frameRate >= 24) {
            output.push(`Animation Type: Smooth (${frameRate} fps)`);
          } else if (frameRate >= 12) {
            output.push(`Animation Type: Standard (${frameRate} fps)`);
          } else {
            output.push(`Animation Type: Low framerate (${frameRate} fps)`);
          }
        } else {
          output.push(`Animation Type: Static content (single frame)`);
        }
      }
    }
    
  } catch (parseError) {
    output.push(`Header Parsing: Failed (${parseError.message})`);
  }
  
  // File size analysis
  const sizeCategory = arrayBuffer.byteLength < 50000 ? "Small" :
                      arrayBuffer.byteLength < 500000 ? "Medium" :
                      arrayBuffer.byteLength < 2000000 ? "Large" : "Very Large";
  
  output.push(`File Size Category: ${sizeCategory}`);
  
  // Estimated complexity based on version and size
  let complexity = "Simple";
  if (version >= 9 && arrayBuffer.byteLength > 100000) {
    complexity = "Complex (ActionScript 3.0 + Large file)";
  } else if (version >= 6 && arrayBuffer.byteLength > 50000) {
    complexity = "Moderate";
  } else if (arrayBuffer.byteLength > 200000) {
    complexity = "Complex (Large file size)";
  }
  
  output.push(`Estimated Complexity: ${complexity}`);
  
  // Flash content type detection
  let contentType = "Unknown";
  if (version >= 9) {
    if (arrayBuffer.byteLength > 1000000) {
      contentType = "Rich Internet Application (RIA)";
    } else if (arrayBuffer.byteLength > 100000) {
      contentType = "Interactive Application";
    } else {
      contentType = "Widget/Banner";
    }
  } else if (version >= 6) {
    if (arrayBuffer.byteLength > 500000) {
      contentType = "Complex Animation/Game";
    } else if (arrayBuffer.byteLength > 50000) {
      contentType = "Interactive Content";
    } else {
      contentType = "Simple Animation/Banner";
    }
  } else {
    contentType = "Legacy Flash Content";
  }
  
  output.push(`Content Type: ${contentType}`);
  
  // Security considerations
  const securityNotes = [];
  if (version >= 9) {
    securityNotes.push("ActionScript 3.0 security model");
  }
  if (signature === 'CWS' || signature === 'ZWS') {
    securityNotes.push("Compressed content (requires decompression)");
  }
  if (arrayBuffer.byteLength > 1000000) {
    securityNotes.push("Large file size (potential memory impact)");
  }
  
  if (securityNotes.length > 0) {
    output.push(`Security Notes: ${securityNotes.join(', ')}`);
  }
  
  return output.join('\n');
}

// Additional utility functions for comprehensive SWF analysis

function estimateLoadTime(fileSize, connectionSpeed = 'broadband') {
  const speeds = {
    'dialup': 56000,      // 56k modem
    'dsl': 1500000,       // 1.5 Mbps
    'broadband': 5000000, // 5 Mbps
    'fiber': 50000000     // 50 Mbps
  };
  
  const bitsPerSecond = speeds[connectionSpeed] || speeds.broadband;
  const loadTimeSeconds = (fileSize * 8) / bitsPerSecond;
  
  return {
    seconds: loadTimeSeconds,
    formatted: loadTimeSeconds < 1 ? 
      `${Math.round(loadTimeSeconds * 1000)}ms` : 
      `${loadTimeSeconds.toFixed(1)}s`
  };
}

function analyzeCompatibility(version) {
  const compatibility = {
    modern: version >= 10,
    legacy: version < 6,
    actionscript3: version >= 9,
    mobile: version >= 10.1,
    html5Compatible: false // Flash is not HTML5 compatible
  };
  
  return compatibility;
}

function detectPotentialAssets(fileSize, version) {
  const estimates = {
    hasVideo: fileSize > 500000 && version >= 6,
    hasAudio: fileSize > 100000,
    hasImages: fileSize > 50000,
    hasFonts: version >= 4,
    hasActionScript: version >= 5,
    hasAdvancedFeatures: version >= 8
  };
  
  return estimates;
}

// Export functions for global access
window.parseSWFSignature = parseSWFSignature;
window.parseRECT = parseRECT;
window.estimateLoadTime = estimateLoadTime;
window.analyzeCompatibility = analyzeCompatibility;
window.detectPotentialAssets = detectPotentialAssets;
