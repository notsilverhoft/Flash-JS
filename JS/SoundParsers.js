/* 
 * SWF Sound Definition Tags Parser - v1.0
 * Handles audio definitions and streaming for Flash multimedia content
 * DefineSound (14), StartSound (15), DefineButtonSound (17), 
 * SoundStreamHead (18), SoundStreamBlock (19), SoundStreamHead2 (45)
 * Essential for Flash audio playback and interactive sound effects
 */
class SoundParsers {
  constructor() {
    this.dataTypes = new SWFDataTypes();
  }
  
  // ==================== TAG PARSING DISPATCHER ====================
  
  parseTag(tagType, tagData, offset, length) {
    const reader = new BitReader(tagData, offset);
    
    switch (tagType) {
      case 14:
        return this.parseDefineSound(reader, length);
      case 15:
        return this.parseStartSound(reader, length);
      case 17:
        return this.parseDefineButtonSound(reader, length);
      case 18:
        return this.parseSoundStreamHead(reader, length);
      case 19:
        return this.parseSoundStreamBlock(reader, length);
      case 45:
        return this.parseSoundStreamHead2(reader, length);
      default:
        return this.parseUnknownSoundTag(tagType, reader, length);
    }
  }
  
  // ==================== SPECIFIC TAG PARSERS ====================
  
  parseDefineSound(reader, length) {
    try {
      // DefineSound format:
      // - SoundId (UI16)
      // - SoundFormat (UB[4]) - 0=PCM, 1=ADPCM, 2=MP3, 3=PCM little-endian, 4=Nellymoser 16kHz, 5=Nellymoser 8kHz, 6=Nellymoser, 11=Speex
      // - SoundRate (UB[2]) - 0=5.5kHz, 1=11kHz, 2=22kHz, 3=44kHz
      // - SoundSize (UB[1]) - 0=8-bit, 1=16-bit
      // - SoundType (UB[1]) - 0=mono, 1=stereo
      // - SoundSampleCount (UI32)
      // - SoundData (UI8[remaining])
      
      const soundId = this.dataTypes.parseUI16(reader);
      
      // Parse sound flags (1 byte total)
      const flagsByte = this.dataTypes.parseUI8(reader);
      const soundFormat = (flagsByte >> 4) & 0x0F;
      const soundRate = (flagsByte >> 2) & 0x03;
      const soundSize = (flagsByte >> 1) & 0x01;
      const soundType = flagsByte & 0x01;
      
      const soundSampleCount = this.dataTypes.parseUI32(reader);
      
      // Calculate sound data length
      const soundDataLength = length - 7; // SoundId(2) + Flags(1) + SampleCount(4)
      
      // Read first part of sound data for analysis
      const soundDataHeader = [];
      const headerBytesToRead = Math.min(soundDataLength, 32);
      
      for (let i = 0; i < headerBytesToRead; i++) {
        soundDataHeader.push(this.dataTypes.parseUI8(reader));
      }
      
      // Analyze sound properties
      const formatInfo = this.getSoundFormatInfo(soundFormat);
      const sampleRateHz = this.getSampleRateHz(soundRate);
      const bitDepth = soundSize === 1 ? 16 : 8;
      const channels = soundType === 1 ? 2 : 1;
      
      // Calculate audio properties
      const duration = this.calculateDuration(soundSampleCount, sampleRateHz);
      const bitrate = this.estimateBitrate(formatInfo, sampleRateHz, bitDepth, channels);
      const uncompressedSize = this.calculateUncompressedSize(soundSampleCount, bitDepth, channels);
      const compressionRatio = uncompressedSize > 0 ? (uncompressedSize / soundDataLength).toFixed(1) : "unknown";
      
      return {
        tagType: "DefineSound",
        description: "Defines an audio asset with format and sample data",
        data: {
          soundId: soundId,
          format: {
            type: formatInfo.name,
            id: soundFormat,
            description: formatInfo.description,
            isCompressed: formatInfo.compressed,
            quality: formatInfo.quality
          },
          audioProperties: {
            sampleRate: sampleRateHz,
            sampleRateFormatted: this.dataTypes.formatFrequency(sampleRateHz),
            bitDepth: bitDepth,
            channels: channels,
            channelType: channels === 2 ? "stereo" : "mono",
            sampleCount: soundSampleCount
          },
          duration: duration,
          dataInfo: {
            dataLength: soundDataLength,
            dataSizeFormatted: this.dataTypes.formatBytes(soundDataLength),
            uncompressedSize: uncompressedSize,
            uncompressedSizeFormatted: this.dataTypes.formatBytes(uncompressedSize),
            compressionRatio: compressionRatio + ":1",
            headerBytes: soundDataHeader.map(b => `0x${b.toString(16).padStart(2, '0')}`).slice(0, 8)
          },
          bitrate: bitrate,
          qualityAnalysis: this.analyzeAudioQuality(formatInfo, sampleRateHz, bitDepth, channels),
          performanceImpact: this.assessAudioPerformance(soundDataLength, formatInfo, duration),
          truncated: soundDataLength > 32,
          memoryFootprint: this.calculateMemoryFootprint(uncompressedSize, formatInfo)
        }
      };
      
    } catch (error) {
      return {
        tagType: "DefineSound",
        description: "Defines an audio asset with format and sample data",
        error: `Parse error: ${error.message}`,
        data: {}
      };
    }
  }
  
  parseStartSound(reader, length) {
    try {
      // StartSound format:
      // - SoundId (UI16)
      // - SoundInfo (SOUNDINFO)
      
      const soundId = this.dataTypes.parseUI16(reader);
      const soundInfo = this.parseSoundInfo(reader);
      
      return {
        tagType: "StartSound",
        description: "Starts playback of a previously defined sound",
        data: {
          soundId: soundId,
          soundInfo: soundInfo,
          playbackControl: {
            hasEnvelope: soundInfo.hasEnvelope,
            hasLoops: soundInfo.hasLoops,
            hasOutPoint: soundInfo.hasOutPoint,
            hasInPoint: soundInfo.hasInPoint,
            playbackType: this.determinePlaybackType(soundInfo)
          }
        }
      };
      
    } catch (error) {
      return {
        tagType: "StartSound",
        description: "Starts playback of a previously defined sound",
        error: `Parse error: ${error.message}`,
        data: {}
      };
    }
  }
  
  parseDefineButtonSound(reader, length) {
    try {
      // DefineButtonSound format:
      // - ButtonId (UI16)
      // - ButtonSoundChar0 (UI16) - OverUpToIdle
      // - ButtonSoundInfo0 (SOUNDINFO)
      // - ButtonSoundChar1 (UI16) - IdleToOverUp  
      // - ButtonSoundInfo1 (SOUNDINFO)
      // - ButtonSoundChar2 (UI16) - OverUpToOverDown
      // - ButtonSoundInfo2 (SOUNDINFO)
      // - ButtonSoundChar3 (UI16) - OverDownToOverUp
      // - ButtonSoundInfo3 (SOUNDINFO)
      
      const buttonId = this.dataTypes.parseUI16(reader);
      
      const buttonSounds = [];
      const stateNames = ["OverUpToIdle", "IdleToOverUp", "OverUpToOverDown", "OverDownToOverUp"];
      
      for (let i = 0; i < 4; i++) {
        const soundChar = this.dataTypes.parseUI16(reader);
        let soundInfo = null;
        
        if (soundChar !== 0) {
          soundInfo = this.parseSoundInfo(reader);
        }
        
        buttonSounds.push({
          state: stateNames[i],
          soundId: soundChar,
          soundInfo: soundInfo,
          hasSound: soundChar !== 0
        });
      }
      
      return {
        tagType: "DefineButtonSound",
        description: "Associates sounds with button state transitions",
        data: {
          buttonId: buttonId,
          buttonSounds: buttonSounds,
          soundStates: {
            overUpToIdle: buttonSounds[0],
            idleToOverUp: buttonSounds[1], 
            overUpToOverDown: buttonSounds[2],
            overDownToOverUp: buttonSounds[3]
          },
          activeSounds: buttonSounds.filter(s => s.hasSound).length,
          interactivityLevel: this.assessButtonSoundComplexity(buttonSounds)
        }
      };
      
    } catch (error) {
      return {
        tagType: "DefineButtonSound",
        description: "Associates sounds with button state transitions",
        error: `Parse error: ${error.message}`,
        data: {}
      };
    }
  }
  
  parseSoundStreamHead(reader, length) {
    try {
      // SoundStreamHead format:
      // - Reserved (UB[4])
      // - PlaybackSoundRate (UB[2])
      // - PlaybackSoundSize (UB[1])
      // - PlaybackSoundType (UB[1])
      // - StreamSoundCompression (UB[4])
      // - StreamSoundRate (UB[2])
      // - StreamSoundSize (UB[1])
      // - StreamSoundType (UB[1])
      // - StreamSoundSampleCount (UI16)
      // - LatencySeek (SI16) - only if StreamSoundCompression = 2 (MP3)
      
      // Parse playback format (1 byte)
      const playbackByte = this.dataTypes.parseUI8(reader);
      const playbackSoundRate = (playbackByte >> 2) & 0x03;
      const playbackSoundSize = (playbackByte >> 1) & 0x01;
      const playbackSoundType = playbackByte & 0x01;
      
      // Parse stream format (1 byte)
      const streamByte = this.dataTypes.parseUI8(reader);
      const streamSoundCompression = (streamByte >> 4) & 0x0F;
      const streamSoundRate = (streamByte >> 2) & 0x03;
      const streamSoundSize = (streamByte >> 1) & 0x01;
      const streamSoundType = streamByte & 0x01;
      
      const streamSoundSampleCount = this.dataTypes.parseUI16(reader);
      
      let latencySeek = null;
      if (streamSoundCompression === 2) { // MP3
        latencySeek = this.dataTypes.parseUI16(reader); // Actually SI16, but parseUI16 for now
        if (latencySeek > 32767) latencySeek -= 65536; // Convert to signed
      }
      
      const playbackFormatInfo = this.getSoundFormatInfo(0); // PCM for playback
      const streamFormatInfo = this.getSoundFormatInfo(streamSoundCompression);
      
      return {
        tagType: "SoundStreamHead",
        description: "Defines streaming audio parameters and format",
        data: {
          playbackFormat: {
            sampleRate: this.getSampleRateHz(playbackSoundRate),
            sampleRateFormatted: this.dataTypes.formatFrequency(this.getSampleRateHz(playbackSoundRate)),
            bitDepth: playbackSoundSize === 1 ? 16 : 8,
            channels: playbackSoundType === 1 ? 2 : 1,
            channelType: playbackSoundType === 1 ? "stereo" : "mono"
          },
          streamFormat: {
            compression: streamFormatInfo.name,
            compressionId: streamSoundCompression,
            description: streamFormatInfo.description,
            sampleRate: this.getSampleRateHz(streamSoundRate),
            sampleRateFormatted: this.dataTypes.formatFrequency(this.getSampleRateHz(streamSoundRate)),
            bitDepth: streamSoundSize === 1 ? 16 : 8,
            channels: streamSoundType === 1 ? 2 : 1,
            channelType: streamSoundType === 1 ? "stereo" : "mono",
            quality: streamFormatInfo.quality
          },
          streamProperties: {
            sampleCount: streamSoundSampleCount,
            latencySeek: latencySeek,
            hasLatencySeek: latencySeek !== null,
            estimatedFrameDuration: this.calculateStreamFrameDuration(streamSoundSampleCount, this.getSampleRateHz(streamSoundRate))
          },
          streamingAnalysis: {
            isCompressed: streamFormatInfo.compressed,
            bufferRequirements: this.calculateBufferRequirements(streamSoundSampleCount, streamSoundSize, streamSoundType),
            bandwidthEstimate: this.estimateStreamingBandwidth(streamFormatInfo, this.getSampleRateHz(streamSoundRate), streamSoundSize, streamSoundType)
          }
        }
      };
      
    } catch (error) {
      return {
        tagType: "SoundStreamHead",
        description: "Defines streaming audio parameters and format",
        error: `Parse error: ${error.message}`,
        data: {}
      };
    }
  }
  
  parseSoundStreamBlock(reader, length) {
    try {
      // SoundStreamBlock format:
      // - StreamSoundData (UI8[length])
      
      // Read first part of stream data for analysis
      const streamDataHeader = [];
      const headerBytesToRead = Math.min(length, 32);
      
      for (let i = 0; i < headerBytesToRead; i++) {
        streamDataHeader.push(this.dataTypes.parseUI8(reader));
      }
      
      // Analyze stream data
      const streamAnalysis = this.analyzeStreamData(streamDataHeader);
      
      return {
        tagType: "SoundStreamBlock",
        description: "Contains streaming audio data for current frame",
        data: {
          dataLength: length,
          dataSizeFormatted: this.dataTypes.formatBytes(length),
          streamDataHeader: streamDataHeader.map(b => `0x${b.toString(16).padStart(2, '0')}`),
          streamAnalysis: streamAnalysis,
          truncated: length > 32,
          note: length > 32 ? 
            `Stream data: ${length} bytes (showing first 32)` : 
            `Complete stream data: ${length} bytes`,
          streamingProperties: {
            isLargeBlock: length > 1000,
            estimatedDuration: "Depends on stream format",
            bufferImpact: length > 2000 ? "high" : length > 500 ? "medium" : "low"
          }
        }
      };
      
    } catch (error) {
      return {
        tagType: "SoundStreamBlock",
        description: "Contains streaming audio data for current frame",
        error: `Parse error: ${error.message}`,
        data: {}
      };
    }
  }
  
  parseSoundStreamHead2(reader, length) {
    try {
      // SoundStreamHead2 format (enhanced version):
      // Same as SoundStreamHead but with additional compression options
      
      // Parse playback format (1 byte)
      const playbackByte = this.dataTypes.parseUI8(reader);
      const playbackSoundRate = (playbackByte >> 2) & 0x03;
      const playbackSoundSize = (playbackByte >> 1) & 0x01;
      const playbackSoundType = playbackByte & 0x01;
      
      // Parse stream format (1 byte)
      const streamByte = this.dataTypes.parseUI8(reader);
      const streamSoundCompression = (streamByte >> 4) & 0x0F;
      const streamSoundRate = (streamByte >> 2) & 0x03;
      const streamSoundSize = (streamByte >> 1) & 0x01;
      const streamSoundType = streamByte & 0x01;
      
      const streamSoundSampleCount = this.dataTypes.parseUI16(reader);
      
      let latencySeek = null;
      if (streamSoundCompression === 2) { // MP3
        latencySeek = this.dataTypes.parseUI16(reader);
        if (latencySeek > 32767) latencySeek -= 65536; // Convert to signed
      }
      
      const playbackFormatInfo = this.getSoundFormatInfo(0); // PCM for playback
      const streamFormatInfo = this.getSoundFormatInfo(streamSoundCompression);
      
      return {
        tagType: "SoundStreamHead2",
        description: "Defines enhanced streaming audio parameters with extended format support",
        data: {
          playbackFormat: {
            sampleRate: this.getSampleRateHz(playbackSoundRate),
            sampleRateFormatted: this.dataTypes.formatFrequency(this.getSampleRateHz(playbackSoundRate)),
            bitDepth: playbackSoundSize === 1 ? 16 : 8,
            channels: playbackSoundType === 1 ? 2 : 1,
            channelType: playbackSoundType === 1 ? "stereo" : "mono"
          },
          streamFormat: {
            compression: streamFormatInfo.name,
            compressionId: streamSoundCompression,
            description: streamFormatInfo.description,
            sampleRate: this.getSampleRateHz(streamSoundRate),
            sampleRateFormatted: this.dataTypes.formatFrequency(this.getSampleRateHz(streamSoundRate)),
            bitDepth: streamSoundSize === 1 ? 16 : 8,
            channels: streamSoundType === 1 ? 2 : 1,
            channelType: streamSoundType === 1 ? "stereo" : "mono",
            quality: streamFormatInfo.quality,
            enhanced: true
          },
          streamProperties: {
            sampleCount: streamSoundSampleCount,
            latencySeek: latencySeek,
            hasLatencySeek: latencySeek !== null,
            estimatedFrameDuration: this.calculateStreamFrameDuration(streamSoundSampleCount, this.getSampleRateHz(streamSoundRate)),
            version: 2
          },
          streamingAnalysis: {
            isCompressed: streamFormatInfo.compressed,
            bufferRequirements: this.calculateBufferRequirements(streamSoundSampleCount, streamSoundSize, streamSoundType),
            bandwidthEstimate: this.estimateStreamingBandwidth(streamFormatInfo, this.getSampleRateHz(streamSoundRate), streamSoundSize, streamSoundType),
            enhancedFeatures: "Supports additional compression formats"
          }
        }
      };
      
    } catch (error) {
      return {
        tagType: "SoundStreamHead2",
        description: "Defines enhanced streaming audio parameters with extended format support",
        error: `Parse error: ${error.message}`,
        data: {}
      };
    }
  }
  
  parseUnknownSoundTag(tagType, reader, length) {
    const data = [];
    const bytesToRead = Math.min(length, 32);
    
    for (let i = 0; i < bytesToRead; i++) {
      data.push(this.dataTypes.parseUI8(reader));
    }
    
    return {
      tagType: `Unknown Sound Tag ${tagType}`,
      description: "Unknown or unsupported sound-related tag",
      data: {
        rawBytes: data,
        totalLength: length,
        truncated: length > 32,
        note: length > 32 ? "Data truncated to first 32 bytes" : "Complete data shown"
      }
    };
  }
  
  // ==================== SOUNDINFO PARSING ====================
  
  parseSoundInfo(reader) {
    try {
      const flags = this.dataTypes.parseUI8(reader);
      
      const syncStop = (flags & 0x20) !== 0;
      const syncNoMultiple = (flags & 0x10) !== 0;
      const hasEnvelope = (flags & 0x08) !== 0;
      const hasLoops = (flags & 0x04) !== 0;
      const hasOutPoint = (flags & 0x02) !== 0;
      const hasInPoint = (flags & 0x01) !== 0;
      
      let inPoint = null;
      if (hasInPoint) {
        inPoint = this.dataTypes.parseUI32(reader);
      }
      
      let outPoint = null;
      if (hasOutPoint) {
        outPoint = this.dataTypes.parseUI32(reader);
      }
      
      let loopCount = null;
      if (hasLoops) {
        loopCount = this.dataTypes.parseUI16(reader);
      }
      
      let envelope = null;
      if (hasEnvelope) {
        envelope = this.parseSoundEnvelope(reader);
      }
      
      return {
        flags: {
          syncStop: syncStop,
          syncNoMultiple: syncNoMultiple,
          hasEnvelope: hasEnvelope,
          hasLoops: hasLoops,
          hasOutPoint: hasOutPoint,
          hasInPoint: hasInPoint
        },
        inPoint: inPoint,
        outPoint: outPoint,
        loopCount: loopCount,
        envelope: envelope,
        playbackAnalysis: {
          isLooped: hasLoops,
          hasVolumeControl: hasEnvelope,
          hasTimeClipping: hasInPoint || hasOutPoint,
          complexity: this.calculateSoundInfoComplexity(hasEnvelope, hasLoops, hasInPoint, hasOutPoint)
        }
      };
      
    } catch (error) {
      return {
        parseError: error.message,
        flags: {}
      };
    }
  }
  
  parseSoundEnvelope(reader) {
    try {
      const envPoints = this.dataTypes.parseUI8(reader);
      const envelopeRecords = [];
      
      for (let i = 0; i < Math.min(envPoints, 20); i++) { // Limit for performance
        const pos44 = this.dataTypes.parseUI32(reader);
        const leftLevel = this.dataTypes.parseUI16(reader);
        const rightLevel = this.dataTypes.parseUI16(reader);
        
        envelopeRecords.push({
          position: pos44,
          leftLevel: leftLevel,
          rightLevel: rightLevel,
          leftLevelPercent: Math.round((leftLevel / 32768) * 100),
          rightLevelPercent: Math.round((rightLevel / 32768) * 100)
        });
      }
      
      return {
        pointCount: envPoints,
        envelopeRecords: envelopeRecords,
        truncated: envPoints > 20,
        volumeRange: this.analyzeVolumeRange(envelopeRecords),
        envelopeType: this.determineEnvelopeType(envelopeRecords)
      };
      
    } catch (error) {
      return {
        pointCount: 0,
        envelopeRecords: [],
        parseError: error.message
      };
    }
  }
  
  // ==================== UTILITY METHODS ====================
  
  getSoundFormatInfo(formatId) {
    const formats = {
      0: { name: "PCM", description: "Uncompressed PCM", compressed: false, quality: "lossless" },
      1: { name: "ADPCM", description: "Adaptive Differential PCM", compressed: true, quality: "good" },
      2: { name: "MP3", description: "MPEG Layer 3", compressed: true, quality: "good" },
      3: { name: "PCM_LE", description: "Uncompressed PCM (little-endian)", compressed: false, quality: "lossless" },
      4: { name: "Nellymoser_16", description: "Nellymoser 16 kHz", compressed: true, quality: "fair" },
      5: { name: "Nellymoser_8", description: "Nellymoser 8 kHz", compressed: true, quality: "fair" },
      6: { name: "Nellymoser", description: "Nellymoser", compressed: true, quality: "fair" },
      11: { name: "Speex", description: "Speex voice codec", compressed: true, quality: "good" }
    };
    
    return formats[formatId] || { 
      name: `Unknown(${formatId})`, 
      description: "Unknown audio format", 
      compressed: true, 
      quality: "unknown" 
    };
  }
  
  getSampleRateHz(rateId) {
    const rates = { 0: 5512, 1: 11025, 2: 22050, 3: 44100 };
    return rates[rateId] || 44100;
  }
  
  calculateDuration(sampleCount, sampleRateHz) {
    if (sampleRateHz === 0) return { seconds: 0, formatted: "0s" };
    
    const seconds = sampleCount / sampleRateHz;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes > 0) {
      return {
        seconds: seconds,
        formatted: `${minutes}:${remainingSeconds.toFixed(1).padStart(4, '0')}`
      };
    } else {
      return {
        seconds: seconds,
        formatted: `${remainingSeconds.toFixed(1)}s`
      };
    }
  }
  
  estimateBitrate(formatInfo, sampleRateHz, bitDepth, channels) {
    if (!formatInfo.compressed) {
      // Uncompressed bitrate
      const bitsPerSecond = sampleRateHz * bitDepth * channels;
      return {
        value: Math.round(bitsPerSecond / 1000),
        unit: "kbps",
        type: "uncompressed",
        formatted: this.dataTypes.formatBitrate(bitsPerSecond)
      };
    } else {
      // Estimated compressed bitrate
      let estimatedBitrate;
      switch (formatInfo.name) {
        case "MP3":
          estimatedBitrate = sampleRateHz > 22050 ? 128 : 64;
          break;
        case "ADPCM":
          estimatedBitrate = Math.round((sampleRateHz * bitDepth * channels) / 4000);
          break;
        case "Nellymoser":
        case "Nellymoser_16":
        case "Nellymoser_8":
          estimatedBitrate = 16;
          break;
        case "Speex":
          estimatedBitrate = 8;
          break;
        default:
          estimatedBitrate = 64;
      }
      
      return {
        value: estimatedBitrate,
        unit: "kbps",
        type: "compressed_estimate",
        formatted: `~${estimatedBitrate} kbps`
      };
    }
  }
  
  calculateUncompressedSize(sampleCount, bitDepth, channels) {
    return Math.round((sampleCount * bitDepth * channels) / 8);
  }
  
  analyzeAudioQuality(formatInfo, sampleRateHz, bitDepth, channels) {
    let qualityScore = 0;
    const factors = [];
    
    // Sample rate impact
    if (sampleRateHz >= 44100) {
      qualityScore += 4;
      factors.push("CD-quality sample rate");
    } else if (sampleRateHz >= 22050) {
      qualityScore += 3;
      factors.push("Good sample rate");
    } else if (sampleRateHz >= 11025) {
      qualityScore += 2;
      factors.push("Moderate sample rate");
    } else {
      qualityScore += 1;
      factors.push("Low sample rate");
    }
    
    // Bit depth impact
    if (bitDepth >= 16) {
      qualityScore += 2;
      factors.push("16-bit resolution");
    } else {
      qualityScore += 1;
      factors.push("8-bit resolution");
    }
    
    // Channel impact
    if (channels === 2) {
      qualityScore += 1;
      factors.push("Stereo");
    } else {
      factors.push("Mono");
    }
    
    // Format impact
    if (!formatInfo.compressed) {
      qualityScore += 3;
      factors.push("Lossless compression");
    } else if (formatInfo.quality === "good") {
      qualityScore += 2;
      factors.push("Good compression");
    } else {
      qualityScore += 1;
      factors.push("Basic compression");
    }
    
    let overallQuality;
    if (qualityScore >= 9) {
      overallQuality = "excellent";
    } else if (qualityScore >= 7) {
      overallQuality = "good";
    } else if (qualityScore >= 5) {
      overallQuality = "fair";
    } else {
      overallQuality = "poor";
    }
    
    return {
      level: overallQuality,
      score: qualityScore,
      factors: factors
    };
  }
  
  assessAudioPerformance(dataLength, formatInfo, duration) {
    let impact = 0;
    const factors = [];
    
    // File size impact
    if (dataLength > 500000) { // 500KB
      impact += 3;
      factors.push("Large audio file increases memory usage");
    } else if (dataLength > 100000) { // 100KB
      impact += 2;
      factors.push("Medium audio file size");
    } else {
      impact += 1;
      factors.push("Small audio file");
    }
    
    // Duration impact
    if (duration.seconds > 30) {
      impact += 2;
      factors.push("Long duration increases processing time");
    } else if (duration.seconds > 10) {
      impact += 1;
      factors.push("Medium duration");
    }
    
    // Compression impact
    if (!formatInfo.compressed) {
      impact += 2;
      factors.push("Uncompressed format requires more CPU for playback");
    } else if (formatInfo.name === "MP3") {
      impact += 1;
      factors.push("MP3 decoding has moderate CPU impact");
    }
    
    let impactLevel;
    if (impact >= 6) {
      impactLevel = "high";
    } else if (impact >= 4) {
      impactLevel = "moderate";
    } else if (impact >= 2) {
      impactLevel = "low";
    } else {
      impactLevel = "minimal";
    }
    
    return {
      level: impactLevel,
      score: impact,
      factors: factors
    };
  }
  
  calculateMemoryFootprint(uncompressedSize, formatInfo) {
    let runtimeMemory = uncompressedSize;
    
    // Add overhead for different formats
    if (formatInfo.compressed) {
      runtimeMemory += Math.round(uncompressedSize * 0.1); // 10% overhead for decompression
    }
    
    return {
      uncompressed: uncompressedSize,
      runtime: runtimeMemory,
      uncompressedFormatted: this.dataTypes.formatBytes(uncompressedSize),
      runtimeFormatted: this.dataTypes.formatBytes(runtimeMemory),
      overhead: formatInfo.compressed ? "10% decompression overhead" : "No overhead"
    };
  }
  
  determinePlaybackType(soundInfo) {
    if (soundInfo.flags.hasLoops) {
      return soundInfo.loopCount === 0 ? "infinite_loop" : `loop_${soundInfo.loopCount}_times`;
    } else if (soundInfo.flags.hasInPoint || soundInfo.flags.hasOutPoint) {
      return "clipped_playback";
    } else if (soundInfo.flags.hasEnvelope) {
      return "volume_controlled";
    } else {
      return "simple_playback";
    }
  }
  
  assessButtonSoundComplexity(buttonSounds) {
    const activeSounds = buttonSounds.filter(s => s.hasSound).length;
    
    if (activeSounds === 0) return "no_sounds";
    if (activeSounds === 1) return "simple";
    if (activeSounds === 2) return "moderate";
    if (activeSounds >= 3) return "complex";
    return "full_interactive";
  }
  
  calculateStreamFrameDuration(sampleCount, sampleRateHz) {
    if (sampleRateHz === 0) return "unknown";
    
    const seconds = sampleCount / sampleRateHz;
    return {
      seconds: seconds,
      milliseconds: Math.round(seconds * 1000),
      formatted: seconds < 1 ? `${Math.round(seconds * 1000)}ms` : `${seconds.toFixed(2)}s`
    };
  }
  
  calculateBufferRequirements(sampleCount, sampleSize, soundType) {
    const bytesPerSample = (sampleSize === 1 ? 2 : 1) * (soundType === 1 ? 2 : 1);
    const bufferSize = sampleCount * bytesPerSample;
    
    return {
      bufferSize: bufferSize,
      bufferSizeFormatted: this.dataTypes.formatBytes(bufferSize),
      recommendedBufferMultiple: Math.max(2, Math.ceil(bufferSize / 4096))
    };
  }
  
  estimateStreamingBandwidth(formatInfo, sampleRateHz, sampleSize, soundType) {
    const bitsPerSample = (sampleSize === 1 ? 16 : 8) * (soundType === 1 ? 2 : 1);
    let bitsPerSecond;
    
    if (!formatInfo.compressed) {
      bitsPerSecond = sampleRateHz * bitsPerSample;
    } else {
      // Estimate compressed bandwidth
      switch (formatInfo.name) {
        case "MP3":
          bitsPerSecond = sampleRateHz > 22050 ? 128000 : 64000;
          break;
        case "ADPCM":
          bitsPerSecond = Math.round((sampleRateHz * bitsPerSample) / 4);
          break;
        default:
          bitsPerSecond = Math.round((sampleRateHz * bitsPerSample) / 2);
      }
    }
    
    return {
      bitsPerSecond: bitsPerSecond,
      formatted: this.dataTypes.formatBitrate(bitsPerSecond),
      bytesPerSecond: Math.round(bitsPerSecond / 8),
      bytesPerSecondFormatted: this.dataTypes.formatBytes(Math.round(bitsPerSecond / 8)) + "/s"
    };
  }
  
  analyzeStreamData(headerBytes) {
    if (headerBytes.length < 4) {
      return "Insufficient data for analysis";
    }
    
    // Look for audio format signatures
    if (headerBytes[0] === 0xFF && (headerBytes[1] & 0xE0) === 0xE0) {
      return "MP3 frame header detected";
    }
    
    if (headerBytes[0] === 0x00 && headerBytes[1] === 0x00) {
      return "PCM audio data detected";
    }
    
    return `Unknown audio format - first bytes: ${headerBytes.slice(0, 4).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(' ')}`;
  }
  
  calculateSoundInfoComplexity(hasEnvelope, hasLoops, hasInPoint, hasOutPoint) {
    let complexity = 0;
    
    if (hasEnvelope) complexity += 3;
    if (hasLoops) complexity += 2;
    if (hasInPoint || hasOutPoint) complexity += 1;
    
    if (complexity >= 5) return "very_complex";
    if (complexity >= 3) return "complex";
    if (complexity >= 1) return "moderate";
    return "simple";
  }
  
  analyzeVolumeRange(envelopeRecords) {
    if (!envelopeRecords || envelopeRecords.length === 0) {
      return { min: 0, max: 0, range: 0 };
    }
    
    let minLevel = 100;
    let maxLevel = 0;
    
    envelopeRecords.forEach(record => {
      const avgLevel = (record.leftLevelPercent + record.rightLevelPercent) / 2;
      minLevel = Math.min(minLevel, avgLevel);
      maxLevel = Math.max(maxLevel, avgLevel);
    });
    
    return {
      min: minLevel,
      max: maxLevel,
      range: maxLevel - minLevel,
      dynamic: maxLevel - minLevel > 30 ? "high" : maxLevel - minLevel > 10 ? "medium" : "low"
    };
  }
  
  determineEnvelopeType(envelopeRecords) {
    if (!envelopeRecords || envelopeRecords.length === 0) {
      return "none";
    }
    
    if (envelopeRecords.length === 1) {
      return "constant_volume";
    }
    
    const first = envelopeRecords[0];
    const last = envelopeRecords[envelopeRecords.length - 1];
    const firstAvg = (first.leftLevelPercent + first.rightLevelPercent) / 2;
    const lastAvg = (last.leftLevelPercent + last.rightLevelPercent) / 2;
    
    if (lastAvg < firstAvg * 0.1) {
      return "fade_out";
    } else if (firstAvg < lastAvg * 0.1) {
      return "fade_in";
    } else {
      return "custom_envelope";
    }
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
        case "DefineSound":
          lines.push(`  └─ Sound ID: ${data.soundId}`);
          lines.push(`  └─ Format: ${data.format.type} (${data.format.description})`);
          lines.push(`  └─ Audio: ${data.audioProperties.sampleRateFormatted}, ${data.audioProperties.bitDepth}-bit, ${data.audioProperties.channelType}`);
          lines.push(`  └─ Duration: ${data.duration.formatted}`);
          lines.push(`  └─ Size: ${data.dataInfo.dataSizeFormatted} (${data.dataInfo.compressionRatio} compression)`);
          lines.push(`  └─ Quality: ${data.qualityAnalysis.level}`);
          lines.push(`  └─ Performance Impact: ${data.performanceImpact.level}`);
          if (data.bitrate) {
            lines.push(`  └─ Bitrate: ${data.bitrate.formatted}`);
          }
          break;
          
        case "StartSound":
          lines.push(`  └─ Sound ID: ${data.soundId}`);
          lines.push(`  └─ Playback Type: ${data.playbackControl.playbackType}`);
          if (data.soundInfo && data.soundInfo.loopCount) {
            lines.push(`  └─ Loop Count: ${data.soundInfo.loopCount}`);
          }
          break;
          
        case "DefineButtonSound":
          lines.push(`  └─ Button ID: ${data.buttonId}`);
          lines.push(`  └─ Active Sounds: ${data.activeSounds}/4 states`);
          lines.push(`  └─ Complexity: ${data.interactivityLevel}`);
          const activeSounds = data.buttonSounds.filter(s => s.hasSound);
          activeSounds.slice(0, 2).forEach(sound => {
            lines.push(`  └─ ${sound.state}: Sound ${sound.soundId}`);
          });
          if (activeSounds.length > 2) {
            lines.push(`  └─ ... and ${activeSounds.length - 2} more sound states`);
          }
          break;
          
        case "SoundStreamHead":
        case "SoundStreamHead2":
          lines.push(`  └─ Stream Format: ${data.streamFormat.compression}`);
          lines.push(`  └─ Stream Audio: ${data.streamFormat.sampleRateFormatted}, ${data.streamFormat.bitDepth}-bit, ${data.streamFormat.channelType}`);
          lines.push(`  └─ Playback Audio: ${data.playbackFormat.sampleRateFormatted}, ${data.playbackFormat.bitDepth}-bit, ${data.playbackFormat.channelType}`);
          lines.push(`  └─ Frame Samples: ${data.streamProperties.sampleCount}`);
          if (data.streamProperties.hasLatencySeek) {
            lines.push(`  └─ MP3 Latency Seek: ${data.streamProperties.latencySeek}`);
          }
          if (data.streamingAnalysis.bandwidthEstimate) {
            lines.push(`  └─ Bandwidth: ${data.streamingAnalysis.bandwidthEstimate.formatted}`);
          }
          break;
          
        case "SoundStreamBlock":
          lines.push(`  └─ Stream Data: ${data.dataSizeFormatted}`);
          lines.push(`  └─ Buffer Impact: ${data.streamingProperties.bufferImpact}`);
          lines.push(`  └─ Analysis: ${data.streamAnalysis}`);
          break;
      }
    }
    
    return lines.join('\n');
  }
}

// Export for use by other parsers
window.SoundParsers = SoundParsers;
