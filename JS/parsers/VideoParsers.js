/* 
 * SWF Video Definition Tags Parser - v1.0
 * Handles video stream definitions and frame data for multimedia Flash content
 * DefineVideoStream (Tag 60), VideoFrame (Tag 61)
 * Essential for modern Flash multimedia applications and streaming content
 */
class VideoParsers {
  constructor() {
    this.dataTypes = new SWFDataTypes();
  }
  
  // ==================== TAG PARSING DISPATCHER ====================
  
  parseTag(tagType, tagData, offset, length) {
    const reader = new BitReader(tagData, offset);
    
    switch (tagType) {
      case 60:
        return this.parseDefineVideoStream(reader, length);
      case 61:
        return this.parseVideoFrame(reader, length);
      default:
        return this.parseUnknownVideoTag(tagType, reader, length);
    }
  }
  
  // ==================== SPECIFIC TAG PARSERS ====================
  
  parseDefineVideoStream(reader, length) {
    try {
      // DefineVideoStream format:
      // - CharacterID (UI16)
      // - NumFrames (UI16) 
      // - Width (UI16)
      // - Height (UI16)
      // - VideoFlagsReserved (UB[4])
      // - VideoFlagsDeblocking (UB[3])
      // - VideoFlagsSmoothing (UB[1])
      // - CodecID (UI8)
      
      const characterId = this.dataTypes.parseUI16(reader);
      const numFrames = this.dataTypes.parseUI16(reader);
      const width = this.dataTypes.parseUI16(reader);
      const height = this.dataTypes.parseUI16(reader);
      
      // Parse video flags (1 byte total)
      const flagsByte = this.dataTypes.parseUI8(reader);
      const videoFlagsReserved = (flagsByte >> 4) & 0x0F;
      const videoFlagsDeblocking = (flagsByte >> 1) & 0x07;
      const videoFlagsSmoothing = flagsByte & 0x01;
      
      const codecId = this.dataTypes.parseUI8(reader);
      
      // Calculate video properties
      const aspectRatio = width > 0 ? (height / width).toFixed(3) : "undefined";
      const totalPixels = width * height;
      const videoQuality = this.estimateVideoQuality(width, height);
      const codecInfo = this.getCodecInfo(codecId);
      
      return {
        tagType: "DefineVideoStream",
        description: "Defines a video stream with codec and dimensional parameters",
        data: {
          characterId: characterId,
          dimensions: {
            width: width,
            height: height,
            aspectRatio: parseFloat(aspectRatio),
            totalPixels: totalPixels,
            resolution: `${width}x${height}`,
            quality: videoQuality
          },
          frameInfo: {
            numFrames: numFrames,
            estimatedDuration: this.estimateVideoDuration(numFrames),
            frameRate: "unknown (depends on timeline)"
          },
          flags: {
            reserved: videoFlagsReserved,
            deblocking: this.getDeblockingInfo(videoFlagsDeblocking),
            smoothing: videoFlagsSmoothing === 1,
            flagsByte: `0x${flagsByte.toString(16).padStart(2, '0')}`
          },
          codec: {
            id: codecId,
            name: codecInfo.name,
            description: codecInfo.description,
            supportLevel: codecInfo.supportLevel,
            compression: codecInfo.compression
          },
          streamAnalysis: {
            isHD: width >= 1280 || height >= 720,
            isStandardDef: width >= 640 && height >= 480 && width < 1280 && height < 720,
            isLowRes: width < 640 && height < 480,
            estimatedBitrate: this.estimateBitrate(width, height, codecInfo)
          }
        }
      };
      
    } catch (error) {
      return {
        tagType: "DefineVideoStream",
        description: "Defines a video stream with codec and dimensional parameters",
        error: `Parse error: ${error.message}`,
        data: {}
      };
    }
  }
  
  parseVideoFrame(reader, length) {
    try {
      // VideoFrame format:
      // - StreamID (UI16)
      // - FrameNum (UI16)
      // - VideoData (UI8[length-4])
      
      const streamId = this.dataTypes.parseUI16(reader);
      const frameNum = this.dataTypes.parseUI16(reader);
      
      const videoDataLength = length - 4; // StreamID(2) + FrameNum(2)
      
      // Read first part of video data for analysis
      const videoDataHeader = [];
      const headerBytesToRead = Math.min(videoDataLength, 32);
      
      for (let i = 0; i < headerBytesToRead; i++) {
        videoDataHeader.push(this.dataTypes.parseUI8(reader));
      }
      
      // Analyze video frame data
      const frameAnalysis = this.analyzeVideoFrameData(videoDataHeader);
      const frameType = this.detectFrameType(videoDataHeader);
      
      return {
        tagType: "VideoFrame",
        description: "Contains compressed video frame data for a video stream",
        data: {
          streamId: streamId,
          frameNum: frameNum,
          dataLength: videoDataLength,
          dataSizeKB: (videoDataLength / 1024).toFixed(2),
          videoDataHeader: videoDataHeader.map(byte => `0x${byte.toString(16).padStart(2, '0')}`),
          frameAnalysis: frameAnalysis,
          frameType: frameType,
          truncated: videoDataLength > 32,
          compressionRatio: this.estimateCompressionRatio(videoDataLength, frameType),
          note: videoDataLength > 32 ? 
            `Video frame data: ${videoDataLength} bytes (showing first 32)` : 
            `Complete video frame data: ${videoDataLength} bytes`,
          streamInfo: {
            isKeyFrame: frameType.isKeyFrame,
            isPredictive: frameType.isPredictive,
            estimatedQuality: this.estimateFrameQuality(videoDataLength)
          }
        }
      };
      
    } catch (error) {
      return {
        tagType: "VideoFrame",
        description: "Contains compressed video frame data for a video stream",
        error: `Parse error: ${error.message}`,
        data: {}
      };
    }
  }
  
  parseUnknownVideoTag(tagType, reader, length) {
    const data = [];
    const bytesToRead = Math.min(length, 32);
    
    for (let i = 0; i < bytesToRead; i++) {
      data.push(this.dataTypes.parseUI8(reader));
    }
    
    return {
      tagType: `Unknown Video Tag ${tagType}`,
      description: "Unknown or unsupported video-related tag",
      data: {
        rawBytes: data,
        totalLength: length,
        truncated: length > 32,
        note: length > 32 ? "Data truncated to first 32 bytes" : "Complete data shown"
      }
    };
  }
  
  // ==================== VIDEO ANALYSIS UTILITIES ====================
  
  getCodecInfo(codecId) {
    const codecs = {
      2: { 
        name: "Sorenson H.263", 
        description: "Sorenson Spark video codec (Flash Video v1)",
        supportLevel: "legacy",
        compression: "medium"
      },
      3: { 
        name: "Screen Video", 
        description: "Screen capture video codec",
        supportLevel: "legacy", 
        compression: "high"
      },
      4: { 
        name: "VP6", 
        description: "On2 VP6 video codec (Flash Video v2)",
        supportLevel: "standard",
        compression: "good"
      },
      5: { 
        name: "VP6 Alpha", 
        description: "On2 VP6 with alpha channel support",
        supportLevel: "standard",
        compression: "good"
      },
      7: { 
        name: "Screen Video v2", 
        description: "Enhanced screen capture codec",
        supportLevel: "modern",
        compression: "very_high"
      },
      8: { 
        name: "H.264", 
        description: "Advanced Video Coding (AVC/H.264)",
        supportLevel: "modern",
        compression: "excellent"
      }
    };
    
    return codecs[codecId] || { 
      name: `Unknown Codec (${codecId})`, 
      description: "Unrecognized video codec",
      supportLevel: "unknown",
      compression: "unknown"
    };
  }
  
  getDeblockingInfo(deblockingValue) {
    const deblockingTypes = {
      0: { name: "Use video packet value", description: "Deblocking controlled by video stream" },
      1: { name: "No deblocking", description: "Deblocking filter disabled" },
      2: { name: "Level 1 deblocking", description: "Light deblocking filter" },
      3: { name: "Level 2 deblocking", description: "Moderate deblocking filter" },
      4: { name: "Level 3 deblocking", description: "Strong deblocking filter" },
      5: { name: "Level 4 deblocking", description: "Maximum deblocking filter" }
    };
    
    return deblockingTypes[deblockingValue] || { 
      name: `Reserved (${deblockingValue})`, 
      description: "Reserved deblocking value" 
    };
  }
  
  estimateVideoQuality(width, height) {
    const totalPixels = width * height;
    
    if (totalPixels >= 1920 * 1080) return "Full HD (1080p+)";
    if (totalPixels >= 1280 * 720) return "HD (720p)";
    if (totalPixels >= 854 * 480) return "Standard Definition (480p)";
    if (totalPixels >= 640 * 360) return "Low Definition (360p)";
    if (totalPixels >= 426 * 240) return "Very Low (240p)";
    return "Ultra Low Resolution";
  }
  
  estimateVideoDuration(numFrames) {
    // Estimate duration assuming common Flash frame rates
    const commonFrameRates = [12, 15, 24, 30];
    const estimations = {};
    
    commonFrameRates.forEach(fps => {
      const seconds = numFrames / fps;
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = Math.floor(seconds % 60);
      
      if (minutes > 0) {
        estimations[`${fps}fps`] = `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
      } else {
        estimations[`${fps}fps`] = `${remainingSeconds}s`;
      }
    });
    
    return {
      frames: numFrames,
      estimatedDurations: estimations,
      note: "Actual duration depends on timeline frame rate"
    };
  }
  
  estimateBitrate(width, height, codecInfo) {
    const pixelsPerSecond = width * height * 30; // Assume 30fps
    let baseBitrate;
    
    // Base bitrate estimation in kbps
    switch (codecInfo.compression) {
      case "excellent": // H.264
        baseBitrate = pixelsPerSecond / 50000;
        break;
      case "good": // VP6
        baseBitrate = pixelsPerSecond / 30000;
        break;
      case "medium": // Sorenson
        baseBitrate = pixelsPerSecond / 20000;
        break;
      case "high": // Screen capture
        baseBitrate = pixelsPerSecond / 10000;
        break;
      default:
        baseBitrate = pixelsPerSecond / 25000;
    }
    
    return {
      estimated: Math.round(baseBitrate),
      unit: "kbps",
      note: "Rough estimation based on resolution and codec"
    };
  }
  
  analyzeVideoFrameData(headerBytes) {
    if (headerBytes.length < 4) {
      return "Insufficient data for analysis";
    }
    
    // Look for common video format signatures
    const byte0 = headerBytes[0];
    const byte1 = headerBytes[1];
    const byte2 = headerBytes[2];
    const byte3 = headerBytes[3];
    
    // FLV video tag detection
    if (byte0 === 0x17 || byte0 === 0x27) {
      return "H.264 AVC video frame detected";
    }
    
    // VP6 detection
    if ((byte0 & 0xF0) === 0x60 || (byte0 & 0xF0) === 0x70) {
      return "VP6 video frame detected";
    }
    
    // Sorenson H.263 detection
    if ((byte0 & 0xF0) === 0x20 || (byte0 & 0xF0) === 0x30) {
      return "Sorenson H.263 video frame detected";
    }
    
    // Screen video detection
    if ((byte0 & 0xF0) === 0x40 || (byte0 & 0xF0) === 0x50) {
      return "Screen video frame detected";
    }
    
    return `Unknown video format - first bytes: ${headerBytes.slice(0, 4).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(' ')}`;
  }
  
  detectFrameType(headerBytes) {
    if (headerBytes.length < 1) {
      return { type: "unknown", isKeyFrame: false, isPredictive: false };
    }
    
    const firstByte = headerBytes[0];
    const frameTypeCode = (firstByte >> 4) & 0x0F;
    
    switch (frameTypeCode) {
      case 1:
        return { 
          type: "keyframe", 
          isKeyFrame: true, 
          isPredictive: false,
          description: "Key frame (I-frame)" 
        };
      case 2:
        return { 
          type: "interframe", 
          isKeyFrame: false, 
          isPredictive: true,
          description: "Inter frame (P-frame)" 
        };
      case 3:
        return { 
          type: "disposable", 
          isKeyFrame: false, 
          isPredictive: true,
          description: "Disposable inter frame" 
        };
      case 4:
        return { 
          type: "generated", 
          isKeyFrame: false, 
          isPredictive: false,
          description: "Generated key frame" 
        };
      case 5:
        return { 
          type: "info", 
          isKeyFrame: false, 
          isPredictive: false,
          description: "Video info/command frame" 
        };
      default:
        return { 
          type: "unknown", 
          isKeyFrame: false, 
          isPredictive: false,
          description: `Unknown frame type (${frameTypeCode})` 
        };
    }
  }
  
  estimateCompressionRatio(dataLength, frameType) {
    // Rough estimation based on frame type and size
    let baseSize;
    
    if (frameType.isKeyFrame) {
      baseSize = dataLength * 8; // Key frames are less compressed
    } else if (frameType.isPredictive) {
      baseSize = dataLength * 15; // P-frames are more compressed
    } else {
      baseSize = dataLength * 10; // Default estimation
    }
    
    const ratio = baseSize / dataLength;
    
    return {
      estimated: `${ratio.toFixed(1)}:1`,
      quality: ratio > 10 ? "high compression" : ratio > 5 ? "medium compression" : "low compression",
      note: "Rough estimation based on frame type"
    };
  }
  
  estimateFrameQuality(dataLength) {
    // Quality estimation based on data size
    if (dataLength > 50000) return "very high";
    if (dataLength > 20000) return "high";
    if (dataLength > 8000) return "medium";
    if (dataLength > 3000) return "low";
    return "very low";
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
        case "DefineVideoStream":
          lines.push(`  └─ Character ID: ${data.characterId}`);
          lines.push(`  └─ Resolution: ${data.dimensions.resolution} (${data.dimensions.quality})`);
          lines.push(`  └─ Frames: ${data.frameInfo.numFrames}`);
          lines.push(`  └─ Codec: ${data.codec.name} (${data.codec.description})`);
          if (data.flags.smoothing) {
            lines.push(`  └─ Smoothing: Enabled`);
          }
          lines.push(`  └─ Deblocking: ${data.flags.deblocking.name}`);
          if (data.streamAnalysis.estimatedBitrate) {
            lines.push(`  └─ Est. Bitrate: ${data.streamAnalysis.estimatedBitrate.estimated} ${data.streamAnalysis.estimatedBitrate.unit}`);
          }
          break;
          
        case "VideoFrame":
          lines.push(`  └─ Stream ID: ${data.streamId}`);
          lines.push(`  └─ Frame Number: ${data.frameNum}`);
          lines.push(`  └─ Frame Type: ${data.frameType.description}`);
          lines.push(`  └─ Data Size: ${data.dataSizeKB} KB`);
          lines.push(`  └─ Quality: ${data.streamInfo.estimatedQuality}`);
          if (data.compressionRatio) {
            lines.push(`  └─ Compression: ~${data.compressionRatio.estimated}`);
          }
          break;
      }
    }
    
    return lines.join('\n');
  }
}

// Export for use by other parsers
window.VideoParsers = VideoParsers;
