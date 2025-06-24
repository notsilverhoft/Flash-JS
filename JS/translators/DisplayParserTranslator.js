/* 
 * SWF Display Parser Translator - v1.0
 * Converts parsed display list data from DisplayParsers.js into simple raw data for WebGL renderer
 * Just handles basic coordinate transformation and data format conversion
 * Part of the Flash-JS rendering pipeline translation layer
 * SIMPLIFIED: Output raw data only, let renderer handle processing
 */
class DisplayParserTranslator {
  constructor() {
    this.output = [];
    this.twipsToPixels = 1 / 20; // SWF uses twips (1/20th pixel)
  }

  // ==================== MAIN TRANSLATION ENTRY POINT ====================
  
  translateDisplayData(parsedDisplayData) {
    try {
      this.output = [];
      this.output.push("Display Translation Results:");
      this.output.push("============================");

      if (!parsedDisplayData || !parsedDisplayData.data) {
        this.output.push("Error: No display data provided for translation");
        return {
          success: false,
          error: "No display data provided",
          output: this.output.join('\n')
        };
      }

      const data = parsedDisplayData.data;
      
      this.output.push(`Translating ${parsedDisplayData.tagType}`);

      // Simple raw translation - just extract key data for renderer
      const translatedData = {
        tagType: parsedDisplayData.tagType,
        depth: data.depth,
        characterId: data.characterId,
        // Raw matrix data for renderer to process
        matrix: data.matrix,
        colorTransform: data.colorTransform,
        // Raw flags and properties
        flags: data.flags,
        name: data.name,
        ratio: data.ratio,
        clipDepth: data.clipDepth,
        // PlaceObject3 specific raw data
        className: data.className,
        filterList: data.filterList,
        blendMode: data.blendMode,
        cacheAsBitmap: data.cacheAsBitmap,
        visible: data.visible,
        backgroundColor: data.backgroundColor,
        // Operation metadata
        isMove: data.isMove,
        isNewPlacement: data.isNewPlacement
      };

      if (data.characterId !== undefined && data.depth !== undefined) {
        this.output.push(`Character: ${data.characterId}, Depth: ${data.depth}`);
      } else if (data.depth !== undefined) {
        this.output.push(`Depth: ${data.depth}`);
      }

      this.output.push("Raw data translation completed - renderer will process");

      return {
        success: true,
        tagType: parsedDisplayData.tagType,
        translatedData: translatedData,
        output: this.output.join('\n'),
        isDisplayCommand: true,
        // Simple metadata for renderer
        characterId: data.characterId,
        depth: data.depth
      };

    } catch (error) {
      this.output.push(`Translation error: ${error.message}`);
      return {
        success: false,
        error: error.message,
        output: this.output.join('\n')
      };
    }
  }

  // ==================== DEBUG OUTPUT ====================

  getDebugOutput() {
    return this.output.join('\n');
  }
}

// Export for use by rendering pipeline
window.DisplayParserTranslator = DisplayParserTranslator;
