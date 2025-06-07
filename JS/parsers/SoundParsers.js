/* 
 * SWF Sound Definition Tags Parser - v1.0
 * Handles sound definitions, playback commands, and streaming audio
 * DefineSound (Tag 14), StartSound (Tag 15), DefineButtonSound (Tag 17)
 * SoundStreamHead/SoundStreamHead2 (Tags 18, 45), SoundStreamBlock (Tag 19)
 * Essential for multimedia Flash content analysis
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
      // - SoundFormat (UB[4])
      // - SoundRate (UB[2]) 
      // - SoundSize (UB[1])
      // - SoundType (UB[1])
      // - SoundSampleCount (UI32)
      // - SoundData (UI8[length - 7])
      
      const soundId = this.dataTypes.parseUI16(reader);
      
      // Parse sound format flags (1 byte total)
      const formatByte = this.dataTypes.parseUI8(reader);
      const soundFormat = (formatByte >> 4) & 0x0F;
      const soundRate = (formatByte >> 2) & 0x03;
      const soundSize = (formatByte >> 1) & 0x01;
      const soundType = formatByte & 0x01;
      
      const soundSampleCount = this.dataTypes.parseUI32(reader);
      
      const soundDataLength = length - 7; // SoundId(2) + FormatByte(1) + SampleCount(4)
      
      // Read first few bytes of sound data for analysis
      const soundDataHeader = [];
      const headerBytesToRead = Math.min(soundDataLength, 32);
      
      for (let i = 0; i < headerBytesToRead; i++) {
        soundDataHeader.push(this.dataTypes.parseUI8(reader));
      }
      
      return {
        tagType: "DefineSound",
        description: "Defines a sound resource with audio data",
        data: {
          soundId: soundId,
          format: this.getSoundFormatInfo(soundFormat),
          sampleRate: this.getSampleRateInfo(soundRate),
          sampleSize: soundSize === 0 ? "8-bit" : "16-bit",
          channels: soundType === 0 ? "mono" : "stereo",
          sampleCount: soundSampleCount,
          dataLength: soundDataLength,
          estimatedDuration: this.calculateDuration(soundSampleCount, soundRate),
          soundDataHeader: soundDataHeader.map(byte => `0x${byte.toString(16).padStart(2, '0')}`),
          audioAnalysis: this.analyzeSoundData(soundDataHeader, soundFormat),
          compressionRatio: soundDataLength > 0 ? (soundSampleCount * (soundSize + 1) * (soundType + 1)) / soundDataLength : null
        }
      };
      
    } catch (error) {
      return {
        tagType: "DefineSound",
        description: "Defines a sound resource with audio data",
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
        description: "Starts playback of a defined sound",
        data: {
          soundId: soundId,
          soundInfo: soundInfo,
          action: "start_playback",
          hasLooping: soundInfo.hasLoops,
          hasEnvelope: soundInfo.hasEnvelope,
          synchronization: soundInfo.syncStop ? "stop" : (soundInfo.syncNoMultiple ? "no_multiple" : "normal")
        }
      };
      
    } catch (error) {
      return {
        tagType: "StartSound",
        description: "Starts playback of a defined sound",
        error: `Parse error: ${error.message}`,
        data: {}
      };
    }
  }
  
  parseDefineButtonSound(reader, length) {
    try {
      // DefineButtonSound format:
      // - ButtonId (UI16)
      // - ButtonSoundChar0 (UI16) - Over state sound
      // - ButtonSoundInfo0 (SOUNDINFO)
      // - ButtonSoundChar1 (UI16) - Up state sound  
      // - ButtonSoundInfo1 (SOUNDINFO)
      // - ButtonSoundChar2 (UI16) - Down state sound
      // - ButtonSoundInfo2 (SOUNDINFO)
      // - ButtonSoundChar3 (UI16) - Hit test state sound
      // - ButtonSoundInfo3 (SOUNDINFO)
      
      const buttonId = this.dataTypes.parseUI16(reader);
      const buttonSounds = [];
      const stateNames = ["over", "up", "down", "hit"];
      
      for (let i = 0; i < 4; i++) {
        const soundId = this.dataTypes.parseUI16(reader);
        let soundInfo = null;
        
        if (soundId !== 0) {
          soundInfo = this.parseSoundInfo(reader);
        }
        
        buttonSounds.push({
          state: stateNames[i],
          soundId: soundId,
          soundInfo: soundInfo,
          hasSound: soundId !== 0
        });
      }
      
      return {
        tagType: "DefineButtonSound",
        description: "Associates sounds with button states",
        data: {
          buttonId: buttonId,
          buttonSounds: buttonSounds,
          activeSounds: buttonSounds.filter(sound => sound.hasSound),
          soundCount: buttonSounds.filter(sound => sound.hasSound).length
        }
      };
      
    } catch (error) {
      return {
        tagType: "DefineButtonSound",
        description: "Associates sounds with button states",
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
      // - LatencySeek (SI16) - only if compression is MP3
      
      const playbackByte = this.dataTypes.parseUI8(reader);
      const playbackSoundRate = (playbackByte >> 2) & 0x03;
      const playbackSoundSize = (playbackByte >> 1) & 0x01;
      const playbackSoundType = playbackByte & 0x01;
      
      const streamByte = this.dataTypes.parseUI8(reader);
      const streamSoundCompression = (streamByte >> 4) & 0x0F;
      const streamSoundRate = (streamByte >> 2) & 0x03;
      const streamSoundSize = (streamByte >> 1) & 0x01;
      const streamSoundType = streamByte & 0x01;
      
      const streamSoundSampleCount = this.dataTypes.parseUI16(reader);
      
      let latencySeek = null;
      if (streamSoundCompression === 2) { // MP3 compression
        latencySeek = this.dataTypes.parseSI16(reader);
      }
      
      return {
        tagType: "SoundStreamHead",
        description: "Defines streaming sound format and playback settings",
        data: {
          playback: {
            sampleRate: this.getSampleRateInfo(playbackSoundRate),
            sampleSize: playbackSoundSize === 0 ? "8-bit" : "16-bit",
            channels: playbackSoundType === 0 ? "mono" : "stereo"
          },
          stream: {
            compression: this.getStreamCompressionInfo(streamSoundCompression),
            sampleRate: this.getSampleRateInfo(streamSoundRate),
            sampleSize: streamSoundSize === 0 ? "8-bit" : "16-bit", 
            channels: streamSoundType === 0 ? "mono" : "stereo"
          },
          streamSoundSampleCount: streamSoundSampleCount,
          latencySeek: latencySeek,
          isMP3: streamSoundCompression === 2,
          version: 1
        }
      };
      
    } catch (error) {
      return {
        tagType: "SoundStreamHead",
        description: "Defines streaming sound format and playback settings",
        error: `Parse error: ${error.message}`,
        data: {}
      };
    }
  }
  
  parseSoundStreamHead2(reader, length) {
    try {
      // SoundStreamHead2 is identical to SoundStreamHead but supports more compression formats
      const playbackByte = this.dataTypes.parseUI8(reader);
      const playbackSoundRate = (playbackByte >> 2) & 0x03;
      const playbackSoundSize = (playbackByte >> 1) & 0x01;
      const playbackSoundType = playbackByte & 0x01;
      
      const streamByte = this.dataTypes.parseUI8(reader);
      const streamSoundCompression = (streamByte >> 4) & 0x0F;
      const streamSoundRate = (streamByte >> 2) & 0x03;
      const streamSoundSize = (streamByte >> 1) & 0x01;
      const streamSoundType = streamByte & 0x01;
      
      const streamSoundSampleCount = this.dataTypes.parseUI16(reader);
      
      let latencySeek = null;
      if (streamSoundCompression === 2) { // MP3 compression
        latencySeek = this.dataTypes.parseSI16(reader);
      }
      
      return {
        tagType: "SoundStreamHead2",
        description: "Defines enhanced streaming sound format (Flash 8+)",
        data: {
          playback: {
            sampleRate: this.getSampleRateInfo(playbackSoundRate),
            sampleSize: playbackSoundSize === 0 ? "8-bit" : "16-bit",
            channels: playbackSoundType === 0 ? "mono" : "stereo"
          },
          stream: {
            compression: this.getStreamCompressionInfo(streamSoundCompression),
            sampleRate: this.getSampleRateInfo(streamSoundRate),
            sampleSize: streamSoundSize === 0 ? "8-bit" : "16-bit",
            channels: streamSoundType === 0 ? "mono" : "stereo"
          },
          streamSoundSampleCount: streamSoundSampleCount,
          latencySeek: latencySeek,
          isMP3: streamSoundCompression === 2,
          version: 2,
          note: "Enhanced streaming audio with additional codec support"
        }
      };
      
    } catch (error) {
      return {
        tagType: "SoundStreamHead2",
        description: "Defines enhanced streaming sound format (Flash 8+)",
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
      
      return {
        tagType: "SoundStreamBlock",
        description: "Contains a block of streaming audio data",
        data: {
          dataLength: length,
          streamDataHeader: streamDataHeader.map(byte => `0x${byte.toString(16).padStart(2, '0')}`),
          truncated: length > 32,
          note: length > 32 ? `Data block: ${length} bytes (showing first 32)` : `Complete data block: ${length} bytes`,
          blockType: "streaming_audio_data"
        }
      };
      
    } catch (error) {
      return {
        tagType: "SoundStreamBlock",
        description: "Contains a block of streaming audio data",
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
      description: "Unknown or unsupported sound tag",
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
      // SOUNDINFO format:
      // - Reserved (UB[2])
      // - SyncStop (UB[1])
      // - SyncNoMultiple (UB[1]) 
      // - HasEnvelope (UB[1])
      // - HasLoops (UB[1])
      // - HasOutPoint (UB[1])
      // - HasInPoint (UB[1])
      // - InPoint (UI32) - if HasInPoint
      // - OutPoint (UI32) - if HasOutPoint
      // - LoopCount (UI16) - if HasLoops
      // - EnvPoints (UI8) - if HasEnvelope
      // - EnvelopeRecords - if HasEnvelope
      
      const infoByte = this.dataTypes.parseUI8(reader);
      const syncStop = (infoByte & 0x20) !== 0;
      const syncNoMultiple = (infoByte & 0x10) !== 0;
      const hasEnvelope = (infoByte & 0x08) !== 0;
      const hasLoops = (infoByte & 0x04) !== 0;
      const hasOutPoint = (infoByte & 0x02) !== 0;
      const hasInPoint = (infoByte & 0x01) !== 0;
      
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
        const envPoints = this.dataTypes.parseUI8(reader);
        const envelopeRecords = [];
        
        for (let i = 0; i < envPoints; i++) {
          const pos44 = this.dataTypes.parseUI32(reader);
          const leftLevel = this.dataTypes.parseUI16(reader);
          const rightLevel = this.dataTypes.parseUI16(reader);
          
          envelopeRecords.push({
            position: pos44,
            leftLevel: leftLevel,
            rightLevel: rightLevel
          });
        }
        
        envelope = {
          points: envPoints,
          records: envelopeRecords
        };
      }
      
      return {
        syncStop: syncStop,
        syncNoMultiple: syncNoMultiple,
        hasEnvelope: hasEnvelope,
        hasLoops: hasLoops,
        hasInPoint: hasInPoint,
        hasOutPoint: hasOutPoint,
        inPoint: inPoint,
        outPoint: outPoint,
        loopCount: loopCount,
        envelope: envelope
      };
      
    } catch (error) {
      return {
        parseError: error.message,
        syncStop: false,
        syncNoMultiple: false,
        hasEnvelope: false,
        hasLoops: false,
        hasInPoint: false,
        hasOutPoint: false
      };
    }
  }
  
  // ==================== UTILITY METHODS ====================
  
  getSoundFormatInfo(format) {
    const formats = {
      0: { name: "Uncompressed", description: "Native uncompressed PCM" },
      1: { name: "ADPCM", description: "Adaptive Delta PCM compression" },
      2: { name: "MP3", description: "MPEG Layer 3 compression" },
      3: { name: "Uncompressed Little Endian", description: "PCM little endian" },
      4: { name: "Nellymoser 16kHz", description: "Nellymoser ASAO 16kHz" },
      5: { name: "Nellymoser 8kHz", description: "Nellymoser ASAO 8kHz" },
      6: { name: "Nellymoser", description: "Nellymoser ASAO variable rate" },
      11: { name: "Speex", description: "Speex voice compression" }
    };
    
    return formats[format] || { 
      name: `Unknown (${format})`, 
      description: "Unrecognized audio format" 
    };
  }
  
  getStreamCompressionInfo(compression) {
    const compressions = {
      0: { name: "Uncompressed", description: "Raw PCM data" },
      1: { name: "ADPCM", description: "Adaptive Delta PCM" },
      2: { name: "MP3", description: "MPEG Layer 3" },
      3: { name: "Uncompressed Little Endian", description: "PCM little endian" },
      4: { name: "Nellymoser 16kHz", description: "Nellymoser 16kHz mono" },
      5: { name: "Nellymoser 8kHz", description: "Nellymoser 8kHz mono" },
      6: { name: "Nellymoser", description: "Nellymoser variable rate" }
    };
    
    return compressions[compression] || { 
      name: `Unknown (${compression})`, 
      description: "Unrecognized compression format" 
    };
  }
  
  getSampleRateInfo(rate) {
    const rates = {
      0: { hz: 5512, description: "5.5kHz" },
      1: { hz: 11025, description: "11kHz" },
      2: { hz: 22050, description: "22kHz" },
      3: { hz: 44100, description: "44kHz" }
    };
    
    return rates[rate] || { 
      hz: 0, 
      description: `Unknown (${rate})` 
    };
  }
  
  calculateDuration(sampleCount, sampleRate) {
    const rateInfo = this.getSampleRateInfo(sampleRate);
    if (rateInfo.hz > 0) {
      const seconds = sampleCount / rateInfo.hz;
      return {
        seconds: seconds,
        formatted: this.formatDuration(seconds)
      };
    }
    return null;
  }
  
  formatDuration(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    const milliseconds = Math.floor((seconds % 1) * 1000);
    
    if (minutes > 0) {
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
    } else {
      return `${remainingSeconds}.${milliseconds.toString().padStart(3, '0')}s`;
    }
  }
  
  analyzeSoundData(headerBytes, format) {
    if (headerBytes.length < 4) {
      return "Insufficient data for analysis";
    }
    
    // Basic audio format detection
    switch (format) {
      case 2: // MP3
        if (headerBytes[0] === 0xFF && (headerBytes[1] & 0xE0) === 0xE0) {
          return "Valid MP3 frame header detected";
        }
        return "MP3 format but no valid frame header found";
        
      case 1: // ADPCM
        return "ADPCM compressed audio data";
        
      case 0: // Uncompressed
        return "Raw PCM audio data";
        
      default:
        return `Audio format ${format} - header analysis not implemented`;
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
          lines.push(`  └─ Format: ${data.format.name} (${data.format.description})`);
          lines.push(`  └─ Sample Rate: ${data.sampleRate.description}`);
          lines.push(`  └─ Quality: ${data.sampleSize}, ${data.channels}`);
          lines.push(`  └─ Samples: ${data.sampleCount.toLocaleString()}`);
          if (data.estimatedDuration) {
            lines.push(`  └─ Duration: ~${data.estimatedDuration.formatted}`);
          }
          lines.push(`  └─ Data Size: ${(data.dataLength / 1024).toFixed(1)} KB`);
          break;
          
        case "StartSound":
          lines.push(`  └─ Sound ID: ${data.soundId}`);
          lines.push(`  └─ Action: ${data.action}`);
          if (data.hasLooping) {
            lines.push(`  └─ Looping: Yes`);
          }
          if (data.hasEnvelope) {
            lines.push(`  └─ Volume Envelope: Yes`);
          }
          break;
          
        case "DefineButtonSound":
          lines.push(`  └─ Button ID: ${data.buttonId}`);
          lines.push(`  └─ Active Sounds: ${data.soundCount}/4 states`);
          data.activeSounds.forEach(sound => {
            lines.push(`    • ${sound.state}: Sound ID ${sound.soundId}`);
          });
          break;
          
        case "SoundStreamHead":
        case "SoundStreamHead2":
          lines.push(`  └─ Playback: ${data.playback.sampleRate.description}, ${data.playback.sampleSize}, ${data.playback.channels}`);
          lines.push(`  └─ Stream: ${data.stream.compression.name}, ${data.stream.sampleRate.description}`);
          lines.push(`  └─ Samples per Block: ${data.streamSoundSampleCount}`);
          if (data.isMP3) {
            lines.push(`  └─ MP3 Latency: ${data.latencySeek} samples`);
          }
          break;
          
        case "SoundStreamBlock":
          lines.push(`  └─ Block Size: ${(data.dataLength / 1024).toFixed(1)} KB`);
          break;
      }
    }
    
    return lines.join('\n');
  }
}

// Export for use by other parsers
window.SoundParsers = SoundParsers;
