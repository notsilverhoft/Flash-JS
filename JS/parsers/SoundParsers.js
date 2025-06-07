/* 
 * SWF Sound Definition Tags Parser - v1.0
 * Handles audio content definitions and streaming
 * DefineSound (Tag 14), StartSound (Tag 15), SoundStreamHead/Head2 (Tags 18, 45)
 * SoundStreamBlock (Tag 19), DefineButtonSound (Tag 17)
 * Audio format analysis, compression detection, and streaming support
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
      const soundId = this.dataTypes.parseUI16(reader);
      
      const soundFlags = this.dataTypes.parseUI8(reader);
      const soundFormat = (soundFlags >> 4) & 0x0F;
      const soundRate = (soundFlags >> 2) & 0x03;
      const soundSize = (soundFlags >> 1) & 0x01;
      const soundType = soundFlags & 0x01;
      
      const soundSampleCount = this.dataTypes.parseUI32(reader);
      const soundDataLength = length - 7;
      
      const formatInfo = this.getSoundFormatInfo(soundFormat);
      const rateInfo = this.getSoundRateInfo(soundRate);
      const sampleData = this.analyzeSoundData(reader, soundDataLength, soundFormat);
      
      return {
        tagType: "DefineSound",
        description: "Defines an embedded sound with audio data",
        data: {
          soundId: soundId,
          format: formatInfo,
          sampleRate: rateInfo,
          sampleSize: soundSize === 0 ? 8 : 16,
          channels: soundType === 0 ? 1 : 2,
          sampleCount: soundSampleCount,
          dataLength: soundDataLength,
          sampleData: sampleData,
          duration: this.calculateDuration(soundSampleCount, rateInfo.hz),
          estimatedFileSize: this.estimateFileSize(soundDataLength, formatInfo.compression),
          audioQuality: this.assessAudioQuality(formatInfo, rateInfo, soundSize, soundType)
        }
      };
      
    } catch (error) {
      return {
        tagType: "DefineSound",
        description: "Defines an embedded sound with audio data",
        error: `Parse error: ${error.message}`,
        data: {}
      };
    }
  }
  
  parseStartSound(reader, length) {
    try {
      const soundId = this.dataTypes.parseUI16(reader);
      const soundInfo = this.parseSoundInfo(reader);
      
      return {
        tagType: "StartSound",
        description: "Starts playback of a previously defined sound",
        data: {
          soundId: soundId,
          soundInfo: soundInfo,
          playbackControl: this.analyzeSoundInfo(soundInfo)
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
      const buttonId = this.dataTypes.parseUI16(reader);
      
      const buttonSounds = [];
      const stateNames = ["Over", "Down", "Hit", "Up"];
      
      for (let i = 0; i < 4; i++) {
        const soundCharId = this.dataTypes.parseUI16(reader);
        
        if (soundCharId !== 0) {
          const soundInfo = this.parseSoundInfo(reader);
          buttonSounds.push({
            state: stateNames[i],
            soundId: soundCharId,
            soundInfo: soundInfo,
            playbackControl: this.analyzeSoundInfo(soundInfo)
          });
        } else {
          buttonSounds.push({
            state: stateNames[i],
            soundId: null,
            note: "No sound for this state"
          });
        }
      }
      
      return {
        tagType: "DefineButtonSound",
        description: "Defines sounds for button states (over, down, hit, up)",
        data: {
          buttonId: buttonId,
          buttonSounds: buttonSounds,
          soundCount: buttonSounds.filter(s => s.soundId !== null).length,
          hasStateSounds: {
            over: buttonSounds[0].soundId !== null,
            down: buttonSounds[1].soundId !== null,
            hit: buttonSounds[2].soundId !== null,
            up: buttonSounds[3].soundId !== null
          }
        }
      };
      
    } catch (error) {
      return {
        tagType: "DefineButtonSound",
        description: "Defines sounds for button states (over, down, hit, up)",
        error: `Parse error: ${error.message}`,
        data: {}
      };
    }
  }
  
  parseSoundStreamHead(reader, length) {
    try {
      const playbackFlags = this.dataTypes.parseUI8(reader);
      const playbackSoundRate = (playbackFlags >> 2) & 0x03;
      const playbackSoundSize = (playbackFlags >> 1) & 0x01;
      const playbackSoundType = playbackFlags & 0x01;
      
      const streamFlags = this.dataTypes.parseUI8(reader);
      const streamSoundCompression = (streamFlags >> 4) & 0x0F;
      const streamSoundRate = (streamFlags >> 2) & 0x03;
      const streamSoundSize = (streamFlags >> 1) & 0x01;
      const streamSoundType = streamFlags & 0x01;
      
      const streamSoundSampleCount = this.dataTypes.parseUI16(reader);
      
      let latencySeek = null;
      if (streamSoundCompression === 2) {
        latencySeek = this.dataTypes.parseSI16(reader);
      }
      
      return {
        tagType: "SoundStreamHead",
        description: "Defines the format for streaming sound data",
        data: {
          playback: {
            sampleRate: this.getSoundRateInfo(playbackSoundRate),
            sampleSize: playbackSoundSize === 0 ? 8 : 16,
            channels: playbackSoundType === 0 ? 1 : 2
          },
          stream: {
            compression: this.getSoundFormatInfo(streamSoundCompression),
            sampleRate: this.getSoundRateInfo(streamSoundRate),
            sampleSize: streamSoundSize === 0 ? 8 : 16,
            channels: streamSoundType === 0 ? 1 : 2,
            sampleCount: streamSoundSampleCount
          },
          latencySeek: latencySeek,
          streamType: "audio",
          version: 1
        }
      };
      
    } catch (error) {
      return {
        tagType: "SoundStreamHead",
        description: "Defines the format for streaming sound data",
        error: `Parse error: ${error.message}`,
        data: {}
      };
    }
  }
  
  parseSoundStreamHead2(reader, length) {
    try {
      const playbackFlags = this.dataTypes.parseUI8(reader);
      const playbackSoundRate = (playbackFlags >> 2) & 0x03;
      const playbackSoundSize = (playbackFlags >> 1) & 0x01;
      const playbackSoundType = playbackFlags & 0x01;
      
      const streamFlags = this.dataTypes.parseUI8(reader);
      const streamSoundCompression = (streamFlags >> 4) & 0x0F;
      const streamSoundRate = (streamFlags >> 2) & 0x03;
      const streamSoundSize = (streamFlags >> 1) & 0x01;
      const streamSoundType = streamFlags & 0x01;
      
      const streamSoundSampleCount = this.dataTypes.parseUI16(reader);
      
      let latencySeek = null;
      if (streamSoundCompression === 2) {
        latencySeek = this.dataTypes.parseSI16(reader);
      }
      
      return {
        tagType: "SoundStreamHead2",
        description: "Defines enhanced format for streaming sound data",
        data: {
          playback: {
            sampleRate: this.getSoundRateInfo(playbackSoundRate),
            sampleSize: playbackSoundSize === 0 ? 8 : 16,
            channels: playbackSoundType === 0 ? 1 : 2
          },
          stream: {
            compression: this.getSoundFormatInfo(streamSoundCompression),
            sampleRate: this.getSoundRateInfo(streamSoundRate),
            sampleSize: streamSoundSize === 0 ? 8 : 16,
            channels: streamSoundType === 0 ? 1 : 2,
            sampleCount: streamSoundSampleCount
          },
          latencySeek: latencySeek,
          streamType: "audio",
          version: 2,
          note: "Enhanced streaming audio format"
        }
      };
      
    } catch (error) {
      return {
        tagType: "SoundStreamHead2",
        description: "Defines enhanced format for streaming sound data",
        error: `Parse error: ${error.message}`,
        data: {}
      };
    }
  }
  
  parseSoundStreamBlock(reader, length) {
    try {
      const streamData = this.analyzeStreamData(reader, length);
      
      return {
        tagType: "SoundStreamBlock",
        description: "Contains a block of streaming sound data",
        data: {
          dataLength: length,
          streamData: streamData,
          blockType: "audio_stream",
          note: "Raw streaming audio data - requires SoundStreamHead for format"
        }
      };
      
    } catch (error) {
      return {
        tagType: "SoundStreamBlock",
        description: "Contains a block of streaming sound data",
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
      description: "Unknown or unsupported sound definition tag",
      data: {
        rawBytes: data,
        totalLength: length,
        truncated: length > 32,
        note: length > 32 ? "Data truncated to first 32 bytes" : "Complete data shown"
      }
    };
  }
  
  // ==================== SOUND INFO PARSING ====================
  
  parseSoundInfo(reader) {
    try {
      const flags = this.dataTypes.parseUI8(reader);
      
      const syncStop = (flags & 0x20) !== 0;
      const syncNoMultiple = (flags & 0x10) !== 0;
      const hasEnvelope = (flags & 0x08) !== 0;
      const hasLoops = (flags & 0x04) !== 0;
      const hasOutPoint = (flags & 0x02) !== 0;
      const hasInPoint = (flags & 0x01) !== 0;
      
      const soundInfo = {
        syncStop: syncStop,
        syncNoMultiple: syncNoMultiple,
        hasEnvelope: hasEnvelope,
        hasLoops: hasLoops,
        hasOutPoint: hasOutPoint,
        hasInPoint: hasInPoint
      };
      
      if (hasInPoint) {
        soundInfo.inPoint = this.dataTypes.parseUI32(reader);
      }
      
      if (hasOutPoint) {
        soundInfo.outPoint = this.dataTypes.parseUI32(reader);
      }
      
      if (hasLoops) {
        soundInfo.loopCount = this.dataTypes.parseUI16(reader);
      }
      
      if (hasEnvelope) {
        const envelopeRecords = this.dataTypes.parseUI8(reader);
        soundInfo.envelope = [];
        
        for (let i = 0; i < envelopeRecords; i++) {
          soundInfo.envelope.push({
            pos44: this.dataTypes.parseUI32(reader),
            leftLevel: this.dataTypes.parseUI16(reader),
            rightLevel: this.dataTypes.parseUI16(reader)
          });
        }
      }
      
      return soundInfo;
      
    } catch (error) {
      return {
        parseError: error.message
      };
    }
  }
  
  // ==================== UTILITY METHODS ====================
  
  getSoundFormatInfo(format) {
    const formats = {
      0: { name: "Uncompressed, native endian", compression: "none", quality: "lossless" },
      1: { name: "ADPCM", compression: "adpcm", quality: "compressed" },
      2: { name: "MP3", compression: "mp3", quality: "lossy" },
      3: { name: "Uncompressed, little endian", compression: "none", quality: "lossless" },
      4: { name: "Nellymoser 16kHz mono", compression: "nellymoser", quality: "speech" },
      5: { name: "Nellymoser 8kHz mono", compression: "nellymoser", quality: "speech" },
      6: { name: "Nellymoser", compression: "nellymoser", quality: "compressed" },
      11: { name: "Speex", compression: "speex", quality: "speech" }
    };
    
    return formats[format] || { 
      name: `Unknown format ${format}`, 
      compression: "unknown", 
      quality: "unknown" 
    };
  }
  
  getSoundRateInfo(rate) {
    const rates = {
      0: { hz: 5512, description: "5.5 kHz" },
      1: { hz: 11025, description: "11 kHz" },
      2: { hz: 22050, description: "22 kHz" },
      3: { hz: 44100, description: "44 kHz" }
    };
    
    return rates[rate] || { hz: 0, description: "Unknown rate" };
  }
  
  analyzeSoundData(reader, dataLength, format) {
    const analysis = {
      dataLength: dataLength,
      format: format,
      hasData: dataLength > 0
    };
    
    if (dataLength > 0) {
      const headerBytes = [];
      const bytesToRead = Math.min(dataLength, 16);
      
      for (let i = 0; i < bytesToRead; i++) {
        headerBytes.push(this.dataTypes.parseUI8(reader));
      }
      
      analysis.header = headerBytes;
      analysis.headerAnalysis = this.analyzeAudioHeader(headerBytes, format);
    }
    
    return analysis;
  }
  
  analyzeAudioHeader(headerBytes, format) {
    if (headerBytes.length < 4) {
      return "Insufficient data for analysis";
    }
    
    switch (format) {
      case 2: // MP3
        if (headerBytes[0] === 0xFF && (headerBytes[1] & 0xE0) === 0xE0) {
          return "Valid MP3 frame sync detected";
        }
        return "MP3 format but no sync pattern found";
        
      case 1: // ADPCM
        return "ADPCM compressed audio data";
        
      case 0:
      case 3: // Uncompressed
        return "Raw PCM audio data";
        
      default:
        return `Format ${format} audio data`;
    }
  }
  
  analyzeStreamData(reader, length) {
    const analysis = {
      dataLength: length,
      blockType: "stream"
    };
    
    if (length > 0) {
      const firstBytes = [];
      const bytesToRead = Math.min(length, 8);
      
      for (let i = 0; i < bytesToRead; i++) {
        firstBytes.push(this.dataTypes.parseUI8(reader));
      }
      
      analysis.firstBytes = firstBytes;
      analysis.note = "Streaming audio block - format defined in SoundStreamHead";
    }
    
    return analysis;
  }
  
  analyzeSoundInfo(soundInfo) {
    const controls = [];
    
    if (soundInfo.syncStop) controls.push("Stop on sync");
    if (soundInfo.syncNoMultiple) controls.push("No multiple instances");
    if (soundInfo.hasLoops && soundInfo.loopCount) {
      controls.push(`Loop ${soundInfo.loopCount} times`);
    }
    if (soundInfo.hasInPoint) controls.push(`Start at sample ${soundInfo.inPoint}`);
    if (soundInfo.hasOutPoint) controls.push(`End at sample ${soundInfo.outPoint}`);
    if (soundInfo.hasEnvelope) controls.push("Volume envelope");
    
    return {
      controls: controls,
      isSimplePlayback: controls.length === 0,
      hasTimingControl: soundInfo.hasInPoint || soundInfo.hasOutPoint,
      hasVolumeControl: soundInfo.hasEnvelope,
      isLooped: soundInfo.hasLoops && soundInfo.loopCount > 0
    };
  }
  
  calculateDuration(sampleCount, sampleRate) {
    if (sampleRate === 0) return "Unknown duration";
    
    const seconds = sampleCount / sampleRate;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = (seconds % 60).toFixed(1);
    
    if (minutes > 0) {
      return `${minutes}:${remainingSeconds.padStart(4, '0')} min`;
    } else {
      return `${remainingSeconds} sec`;
    }
  }
  
  estimateFileSize(dataLength, formatInfo) {
    let compressionRatio = 1.0;
    
    switch (formatInfo.compression) {
      case "mp3":
        compressionRatio = 0.1;
        break;
      case "adpcm":
        compressionRatio = 0.25;
        break;
      case "nellymoser":
        compressionRatio = 0.15;
        break;
      case "speex":
        compressionRatio = 0.08;
        break;
    }
    
    const estimatedUncompressed = dataLength / compressionRatio;
    
    return {
      compressed: this.formatBytes(dataLength),
      estimatedUncompressed: this.formatBytes(estimatedUncompressed),
      compressionRatio: compressionRatio,
      note: formatInfo.compression === "none" ? "Uncompressed data" : `${formatInfo.compression.toUpperCase()} compression`
    };
  }
  
  assessAudioQuality(formatInfo, rateInfo, sampleSize, channels) {
    let qualityScore = 0;
    
    if (rateInfo.hz >= 44100) qualityScore += 3;
    else if (rateInfo.hz >= 22050) qualityScore += 2;
    else if (rateInfo.hz >= 11025) qualityScore += 1;
    
    if (sampleSize === 16) qualityScore += 2;
    else qualityScore += 1;
    
    if (channels === 2) qualityScore += 1;
    
    if (formatInfo.quality === "lossless") qualityScore += 2;
    else if (formatInfo.quality === "compressed") qualityScore += 1;
    
    const maxScore = 8;
    const percentage = Math.round((qualityScore / maxScore) * 100);
    
    let rating;
    if (percentage >= 80) rating = "High";
    else if (percentage >= 60) rating = "Good";
    else if (percentage >= 40) rating = "Fair";
    else rating = "Low";
    
    return {
      rating: rating,
      percentage: percentage,
      factors: {
        sampleRate: rateInfo.description,
        bitDepth: `${sampleSize}-bit`,
        channels: channels === 2 ? "Stereo" : "Mono",
        compression: formatInfo.name
      }
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
      
      switch (parsedTag.tagType) {
        case "DefineSound":
          lines.push(`  └─ Sound ID: ${data.soundId}`);
          lines.push(`  └─ Format: ${data.format.name}`);
          lines.push(`  └─ Quality: ${data.audioQuality.rating} (${data.audioQuality.percentage}%)`);
          lines.push(`  └─ Sample Rate: ${data.sampleRate.description}`);
          lines.push(`  └─ Channels: ${data.channels === 2 ? 'Stereo' : 'Mono'}`);
          lines.push(`  └─ Duration: ${data.duration}`);
          lines.push(`  └─ Data Size: ${data.estimatedFileSize.compressed}`);
          break;
          
        case "StartSound":
          lines.push(`  └─ Sound ID: ${data.soundId}`);
          if (data.playbackControl.isLooped) {
            lines.push(`  └─ Looped: Yes`);
          }
          if (data.playbackControl.hasTimingControl) {
            lines.push(`  └─ Has Timing Control: Yes`);
          }
          if (data.playbackControl.hasVolumeControl) {
            lines.push(`  └─ Has Volume Envelope: Yes`);
          }
          break;
          
        case "DefineButtonSound":
          lines.push(`  └─ Button ID: ${data.buttonId}`);
          lines.push(`  └─ Sound States: ${data.soundCount}/4`);
          
          const activeStates = Object.entries(data.hasStateSounds)
            .filter(([state, hasSound]) => hasSound)
            .map(([state]) => state);
          
          if (activeStates.length > 0) {
            lines.push(`  └─ Active States: ${activeStates.join(', ')}`);
          }
          break;
          
        case "SoundStreamHead":
        case "SoundStreamHead2":
          lines.push(`  └─ Stream Format: ${data.stream.compression.name}`);
          lines.push(`  └─ Stream Rate: ${data.stream.sampleRate.description}`);
          lines.push(`  └─ Playback Rate: ${data.playback.sampleRate.description}`);
          lines.push(`  └─ Channels: ${data.stream.channels === 2 ? 'Stereo' : 'Mono'}`);
          if (data.latencySeek !== null) {
            lines.push(`  └─ MP3 Latency: ${data.latencySeek} samples`);
          }
          break;
          
        case "SoundStreamBlock":
          lines.push(`  └─ Block Size: ${this.formatBytes(data.dataLength)}`);
          break;
      }
      
      if (data.note) {
        lines.push(`  └─ ${data.note}`);
      }
    }
    
    return lines.join('\n');
  }
}

// Export for use by other parsers
window.SoundParsers = SoundParsers;
