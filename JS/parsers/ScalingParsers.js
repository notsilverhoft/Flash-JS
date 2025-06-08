/* 
 * SWF Scaling Definition Tags Parser - v1.0
 * Handles 9-slice scaling grid definitions for UI elements
 * DefineScalingGrid (Tag 78)
 * Essential for Flash applications with scalable interface elements
 */
class ScalingParsers {
  constructor() {
    this.dataTypes = new SWFDataTypes();
  }
  
  // ==================== TAG PARSING DISPATCHER ====================
  
  parseTag(tagType, tagData, offset, length) {
    const reader = new BitReader(tagData, offset);
    
    switch (tagType) {
      case 78:
        return this.parseDefineScalingGrid(reader, length);
      default:
        return this.parseUnknownScalingTag(tagType, reader, length);
    }
  }
  
  // ==================== SPECIFIC TAG PARSERS ====================
  
  parseDefineScalingGrid(reader, length) {
    try {
      // DefineScalingGrid format:
      // - CharacterID (UI16)
      // - Splitter (RECT) - defines the 9-slice grid borders
      
      const characterId = this.dataTypes.parseUI16(reader);
      const splitter = this.dataTypes.parseRECT(reader);
      
      // Calculate scaling grid properties
      const gridAnalysis = this.analyzeScalingGrid(splitter);
      const uiOptimization = this.analyzeUIOptimization(splitter);
      
      return {
        tagType: "DefineScalingGrid",
        description: "Defines 9-slice scaling grid for scalable UI elements",
        data: {
          characterId: characterId,
          splitter: splitter,
          splitterFormatted: this.dataTypes.formatRECT(splitter),
          gridBorders: {
            left: splitter.xMin,
            right: splitter.xMax,
            top: splitter.yMin,
            bottom: splitter.yMax,
            leftPixels: this.dataTypes.twipsToPixels(splitter.xMin),
            rightPixels: this.dataTypes.twipsToPixels(splitter.xMax),
            topPixels: this.dataTypes.twipsToPixels(splitter.yMin),
            bottomPixels: this.dataTypes.twipsToPixels(splitter.yMax)
          },
          scalingBehavior: {
            cornerPreservation: "Corners remain fixed size",
            edgeScaling: "Edges scale in one direction only",
            centerScaling: "Center scales in both directions",
            aspectRatioPreservation: gridAnalysis.preservesAspectRatio
          },
          gridAnalysis: gridAnalysis,
          uiOptimization: uiOptimization,
          usageContext: this.determineUsageContext(gridAnalysis),
          performanceImpact: this.assessPerformanceImpact(gridAnalysis)
        }
      };
      
    } catch (error) {
      return {
        tagType: "DefineScalingGrid",
        description: "Defines 9-slice scaling grid for scalable UI elements",
        error: `Parse error: ${error.message}`,
        data: {}
      };
    }
  }
  
  parseUnknownScalingTag(tagType, reader, length) {
    const data = [];
    const bytesToRead = Math.min(length, 32);
    
    for (let i = 0; i < bytesToRead; i++) {
      data.push(this.dataTypes.parseUI8(reader));
    }
    
    return {
      tagType: `Unknown Scaling Tag ${tagType}`,
      description: "Unknown or unsupported scaling definition tag",
      data: {
        rawBytes: data,
        totalLength: length,
        truncated: length > 32,
        note: length > 32 ? "Data truncated to first 32 bytes" : "Complete data shown"
      }
    };
  }
  
  // ==================== SCALING ANALYSIS METHODS ====================
  
  analyzeScalingGrid(splitter) {
    const leftBorder = Math.abs(splitter.xMin);
    const rightBorder = Math.abs(splitter.xMax);
    const topBorder = Math.abs(splitter.yMin);
    const bottomBorder = Math.abs(splitter.yMax);
    
    // Calculate grid dimensions in pixels
    const leftPixels = this.dataTypes.twipsToPixels(leftBorder);
    const rightPixels = this.dataTypes.twipsToPixels(rightBorder);
    const topPixels = this.dataTypes.twipsToPixels(topBorder);
    const bottomPixels = this.dataTypes.twipsToPixels(bottomBorder);
    
    // Analyze symmetry
    const horizontalSymmetry = Math.abs(leftPixels - rightPixels) < 1;
    const verticalSymmetry = Math.abs(topPixels - bottomPixels) < 1;
    const perfectSymmetry = horizontalSymmetry && verticalSymmetry;
    
    // Analyze border thickness
    const maxBorderPixels = Math.max(leftPixels, rightPixels, topPixels, bottomPixels);
    const minBorderPixels = Math.min(leftPixels, rightPixels, topPixels, bottomPixels);
    const borderUniformity = (maxBorderPixels - minBorderPixels) < 2;
    
    // Determine grid type
    let gridType = "custom";
    if (perfectSymmetry && borderUniformity) {
      gridType = "uniform";
    } else if (horizontalSymmetry || verticalSymmetry) {
      gridType = "semi_symmetric";
    } else if (borderUniformity) {
      gridType = "uniform_thickness";
    }
    
    // Aspect ratio preservation analysis
    const preservesAspectRatio = horizontalSymmetry && verticalSymmetry;
    
    return {
      gridType: gridType,
      symmetry: {
        horizontal: horizontalSymmetry,
        vertical: verticalSymmetry,
        perfect: perfectSymmetry
      },
      borderThickness: {
        left: leftPixels,
        right: rightPixels,
        top: topPixels,
        bottom: bottomPixels,
        max: maxBorderPixels,
        min: minBorderPixels,
        uniform: borderUniformity,
        average: (leftPixels + rightPixels + topPixels + bottomPixels) / 4
      },
      preservesAspectRatio: preservesAspectRatio,
      complexity: maxBorderPixels > 20 ? "complex" : maxBorderPixels > 10 ? "moderate" : "simple"
    };
  }
  
  analyzeUIOptimization(splitter) {
    const leftPixels = this.dataTypes.twipsToPixels(Math.abs(splitter.xMin));
    const rightPixels = this.dataTypes.twipsToPixels(Math.abs(splitter.xMax));
    const topPixels = this.dataTypes.twipsToPixels(Math.abs(splitter.yMin));
    const bottomPixels = this.dataTypes.twipsToPixels(Math.abs(splitter.yMax));
    
    // Determine optimization characteristics
    const optimizations = [];
    let optimizationLevel = 0;
    
    // Check for common UI patterns
    if (leftPixels > 0 && rightPixels > 0 && topPixels > 0 && bottomPixels > 0) {
      optimizations.push("Full 9-slice grid (optimal for buttons and panels)");
      optimizationLevel += 3;
    }
    
    if (leftPixels === rightPixels && topPixels === bottomPixels) {
      optimizations.push("Symmetric scaling (maintains visual balance)");
      optimizationLevel += 2;
    }
    
    if (Math.max(leftPixels, rightPixels, topPixels, bottomPixels) <= 10) {
      optimizations.push("Thin borders (memory efficient)");
      optimizationLevel += 1;
    } else if (Math.max(leftPixels, rightPixels, topPixels, bottomPixels) > 30) {
      optimizations.push("Thick borders (detailed graphics preservation)");
      optimizationLevel += 1;
    }
    
    // Check for potential issues
    const issues = [];
    if (Math.min(leftPixels, rightPixels, topPixels, bottomPixels) === 0) {
      issues.push("Zero-width borders may cause scaling artifacts");
    }
    
    if (Math.abs(leftPixels - rightPixels) > 10 || Math.abs(topPixels - bottomPixels) > 10) {
      issues.push("Asymmetric borders may cause visual distortion");
    }
    
    // Determine UI element type
    let elementType = "unknown";
    if (leftPixels > 5 && rightPixels > 5 && topPixels > 5 && bottomPixels > 5) {
      elementType = "button_or_panel";
    } else if (topPixels > 10 || bottomPixels > 10) {
      elementType = "horizontal_bar";
    } else if (leftPixels > 10 || rightPixels > 10) {
      elementType = "vertical_bar";
    } else {
      elementType = "minimal_scaling";
    }
    
    return {
      optimizations: optimizations,
      issues: issues,
      optimizationLevel: optimizationLevel,
      elementType: elementType,
      memoryEfficiency: optimizationLevel > 2 ? "high" : optimizationLevel > 1 ? "medium" : "basic",
      visualQuality: issues.length === 0 ? "excellent" : issues.length === 1 ? "good" : "needs_attention"
    };
  }
  
  determineUsageContext(gridAnalysis) {
    const contexts = [];
    
    switch (gridAnalysis.gridType) {
      case "uniform":
        contexts.push("UI buttons", "dialog boxes", "uniform panels");
        break;
      case "semi_symmetric":
        contexts.push("navigation bars", "toolbars", "directional elements");
        break;
      case "uniform_thickness":
        contexts.push("borders", "frames", "decorative elements");
        break;
      default:
        contexts.push("custom UI elements", "specialized graphics");
    }
    
    // Add complexity-based contexts
    if (gridAnalysis.complexity === "complex") {
      contexts.push("detailed artwork", "textured surfaces");
    } else if (gridAnalysis.complexity === "simple") {
      contexts.push("clean interfaces", "minimalist design");
    }
    
    return {
      primaryContexts: contexts,
      bestUseCase: contexts[0] || "general UI scaling",
      designPattern: gridAnalysis.gridType === "uniform" ? "consistent_design" : 
                   gridAnalysis.preservesAspectRatio ? "proportional_design" : "adaptive_design"
    };
  }
  
  assessPerformanceImpact(gridAnalysis) {
    let impact = 0;
    const factors = [];
    
    // Border complexity impact
    if (gridAnalysis.complexity === "complex") {
      impact += 3;
      factors.push("Complex borders increase rendering cost");
    } else if (gridAnalysis.complexity === "moderate") {
      impact += 2;
      factors.push("Moderate borders add some rendering overhead");
    } else {
      impact += 1;
      factors.push("Simple borders minimize rendering cost");
    }
    
    // Symmetry impact (symmetric scaling is more efficient)
    if (gridAnalysis.symmetry.perfect) {
      factors.push("Perfect symmetry enables rendering optimizations");
    } else if (gridAnalysis.symmetry.horizontal || gridAnalysis.symmetry.vertical) {
      impact += 1;
      factors.push("Partial symmetry allows some optimizations");
    } else {
      impact += 2;
      factors.push("Asymmetric scaling requires more processing");
    }
    
    // Memory impact
    const avgBorderSize = gridAnalysis.borderThickness.average;
    if (avgBorderSize > 20) {
      impact += 2;
      factors.push("Large borders increase texture memory usage");
    } else if (avgBorderSize < 5) {
      factors.push("Small borders minimize memory footprint");
    }
    
    let impactLevel;
    if (impact <= 2) {
      impactLevel = "low";
    } else if (impact <= 4) {
      impactLevel = "moderate";
    } else {
      impactLevel = "high";
    }
    
    return {
      impactLevel: impactLevel,
      impactScore: impact,
      factors: factors,
      recommendation: impact > 4 ? "Consider simplifying for better performance" :
                     impact > 2 ? "Good balance of features and performance" :
                     "Optimal performance characteristics"
    };
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
        case "DefineScalingGrid":
          lines.push(`  └─ Character ID: ${data.characterId}`);
          
          if (data.gridBorders) {
            lines.push(`  └─ Grid Borders (pixels):`);
            lines.push(`    • Left: ${data.gridBorders.leftPixels.toFixed(1)}px`);
            lines.push(`    • Right: ${data.gridBorders.rightPixels.toFixed(1)}px`);
            lines.push(`    • Top: ${data.gridBorders.topPixels.toFixed(1)}px`);
            lines.push(`    • Bottom: ${data.gridBorders.bottomPixels.toFixed(1)}px`);
          }
          
          if (data.gridAnalysis) {
            lines.push(`  └─ Grid Type: ${data.gridAnalysis.gridType}`);
            lines.push(`  └─ Complexity: ${data.gridAnalysis.complexity}`);
            
            if (data.gridAnalysis.symmetry.perfect) {
              lines.push(`  └─ Symmetry: Perfect (optimal scaling)`);
            } else if (data.gridAnalysis.symmetry.horizontal || data.gridAnalysis.symmetry.vertical) {
              lines.push(`  └─ Symmetry: Partial`);
            } else {
              lines.push(`  └─ Symmetry: Asymmetric`);
            }
          }
          
          if (data.uiOptimization) {
            lines.push(`  └─ UI Element Type: ${data.uiOptimization.elementType}`);
            lines.push(`  └─ Visual Quality: ${data.uiOptimization.visualQuality}`);
            lines.push(`  └─ Memory Efficiency: ${data.uiOptimization.memoryEfficiency}`);
            
            if (data.uiOptimization.optimizations.length > 0) {
              lines.push(`  └─ Optimizations:`);
              data.uiOptimization.optimizations.slice(0, 2).forEach(opt => {
                lines.push(`    • ${opt}`);
              });
            }
            
            if (data.uiOptimization.issues.length > 0) {
              lines.push(`  └─ Potential Issues:`);
              data.uiOptimization.issues.forEach(issue => {
                lines.push(`    ⚠ ${issue}`);
              });
            }
          }
          
          if (data.usageContext) {
            lines.push(`  └─ Best Use Case: ${data.usageContext.bestUseCase}`);
            lines.push(`  └─ Design Pattern: ${data.usageContext.designPattern}`);
          }
          
          if (data.performanceImpact) {
            lines.push(`  └─ Performance Impact: ${data.performanceImpact.impactLevel}`);
            lines.push(`  └─ Recommendation: ${data.performanceImpact.recommendation}`);
          }
          break;
          
        default:
          if (data.note) {
            lines.push(`  └─ ${data.note}`);
          }
          break;
      }
    }
    
    return lines.join('\n');
  }
}

// Export for use by other parsers
window.ScalingParsers = ScalingParsers;
