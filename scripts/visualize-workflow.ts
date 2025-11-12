#!/usr/bin/env tsx

/**
 * Workflow Visualization Tool
 * Generates Mermaid diagrams and documentation from workflow.yaml
 * 
 * Usage:
 *   npm run visualize
 *   npm run visualize workflow.yaml
 *   npm run visualize workflow.yaml --output workflow.md
 */

import { loadWorkflow } from "../src/lib/config";
import { generateWorkflowDiagram, generateWorkflowDocs } from "../src/lib/visualize";
import fs from "node:fs";
import path from "node:path";

function main() {
  const args = process.argv.slice(2);
  const workflowFile = args[0] || "workflow.yaml";
  const outputIndex = args.indexOf("--output");
  const outputFile = outputIndex >= 0 ? args[outputIndex + 1] : null;
  
  try {
    const workflow = loadWorkflow(workflowFile);
    
    // Generate diagram only or full docs
    const diagramOnly = args.includes("--diagram");
    const output = diagramOnly 
      ? generateWorkflowDiagram(workflow)
      : generateWorkflowDocs(workflow);
    
    if (outputFile) {
      fs.writeFileSync(outputFile, output, "utf8");
      // console.log(`✅ Saved to: ${outputFile}`);
      // console.log("");
      // console.log("View the Mermaid diagram at:");
      // console.log(`   https://mermaid.live/edit#${Buffer.from(output).toString('base64')}`);
    } else {
      console.log(output);
      // console.log("");
      // console.log("💡 Tip: Save to file with --output workflow.md");
      // console.log("💡 Tip: View diagram only with --diagram");
    }
  } catch (error) {
    // console.error("❌ Error:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();

