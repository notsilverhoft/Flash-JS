/* 
 * SWF Shape Parser Translator - v1.0
 * Converts parsed shape data from ShapeParsers.js into simple raw data for WebGL renderer
 * Just handles basic coordinate transformation and data format conversion
 * Part of the Flash-JS rendering pipeline translation layer
 * SIMPLIFIED: Output raw data only, let renderer handle processing
 */
class ShapeParserTranslator {
  constructor() {
    this.output = [];
    this.twipsToPixels = 1 / 20; // SWF uses twips (1/20th pixel)
  }

  // ==================== MAIN TRANSLATION ENTRY POINT ====================
  
  translateShapeData(parsedShapeData) {
    try {
      this.output = [];
      this.output.push("Shape Translation Results:");
      this.output.push("==========================");

      if (!parsedShapeData || !parsedShapeData.data) {
        this.output.push("Error: No shape data provided for translation");
        return {
          success: false,
          error: "No shape data provided",
          output: this.output.join('\n')
        };
      }

      const data = parsedShapeData.data;
      
      // Simple raw translation - just convert coordinates and basic data
      const translatedShape = {
        shapeId: data.shapeId,
        tagType: parsedShapeData.tagType,
        version: data.version || 1,
        bounds: this.translateBounds(data.bounds),
        edgeBounds: data.edgeBounds ? this.translateBounds(data.edgeBounds) : null,
        hasTransparency: data.hasTransparency || false,
        complexity: data.complexity || "simple",
        // Raw data for renderer to process
        fillStyles: data.fillStyles,
        lineStyles: data.lineStyles,
        shapeRecords: data.shapeRecords
      };

      this.output.push(`Translating ${parsedShapeData.tagType} (ID: ${data.shapeId})`);
      this.output.push(`Version: ${translatedShape.version}`);
      this.output.push(`Bounds: ${translatedShape.bounds.width}×${translatedShape.bounds.height} px`);
      this.output.push(`Fill Styles: ${data.fillStyles ? data.fillStyles.count || 0 : 0}`);
      this.output.push(`Line Styles: ${data.lineStyles ? data.lineStyles.count || 0 : 0}`);
      this.output.push(`Shape Records: ${data.shapeRecords ? data.shapeRecords.recordCount || 0 : 0}`);
      this.output.push("Raw data translation completed - renderer will process");

      return {
        success: true,
        translatedShape: translatedShape,
        output: this.output.join('\n'),
        isShapeDefinition: true
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

  // ==================== SIMPLE COORDINATE TRANSFORMATION ====================

  translateBounds(bounds) {
    if (!bounds) return null;

    const pixelBounds = {
      xMin: bounds.xMin * this.twipsToPixels,
      yMin: bounds.yMin * this.twipsToPixels,
      xMax: bounds.xMax * this.twipsToPixels,
      yMax: bounds.yMax * this.twipsToPixels
    };

    return {
      ...pixelBounds,
      width: pixelBounds.xMax - pixelBounds.xMin,
      height: pixelBounds.yMax - pixelBounds.yMin,
      centerX: (pixelBounds.xMin + pixelBounds.xMax) / 2,
      centerY: (pixelBounds.yMin + pixelBounds.yMax) / 2
    };
  }

  // ==================== DEBUG OUTPUT ====================

  getDebugOutput() {
    return this.output.join('\n');
  }
}

// Export for use by rendering pipeline
window.ShapeParserTranslator = ShapeParserTranslator;
