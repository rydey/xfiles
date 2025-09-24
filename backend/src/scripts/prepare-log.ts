import * as fs from 'fs';
import * as path from 'path';

interface LogPreparationOptions {
  inputFile: string;
  outputFile?: string;
  encoding?: string;
  normalizeDates?: boolean;
  cleanEmptyLines?: boolean;
  validateFormat?: boolean;
}

class LogPreparer {
  async prepareLogFile(options: LogPreparationOptions) {
    const {
      inputFile,
      outputFile = inputFile.replace(/\.txt$/, '-prepared.txt'),
      encoding = 'utf8',
      normalizeDates = true,
      cleanEmptyLines = true,
      validateFormat = true
    } = options;

    console.log(`🔧 Preparing log file: ${inputFile}`);
    console.log(`📤 Output file: ${outputFile}`);

    if (!fs.existsSync(inputFile)) {
      throw new Error(`Input file not found: ${inputFile}`);
    }

    const content = fs.readFileSync(inputFile, encoding);
    const lines = content.split('\n');
    
    let processedLines: string[] = [];
    let stats = {
      totalLines: lines.length,
      processedLines: 0,
      cleanedLines: 0,
      errors: 0,
      warnings: 0
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;

      try {
        let processedLine = line;

        // Clean empty lines
        if (cleanEmptyLines && !line.trim()) {
          stats.cleanedLines++;
          continue;
        }

        // Normalize dates (DD/MM/YYYY format)
        if (normalizeDates) {
          processedLine = this.normalizeDate(processedLine);
        }

        // Validate format
        if (validateFormat) {
          const validation = this.validateLine(processedLine, lineNumber);
          if (validation.error) {
            console.warn(`⚠️  Line ${lineNumber}: ${validation.error}`);
            stats.warnings++;
          }
        }

        processedLines.push(processedLine);
        stats.processedLines++;

      } catch (error) {
        console.error(`❌ Error processing line ${lineNumber}: ${error}`);
        stats.errors++;
      }
    }

    // Write processed content
    fs.writeFileSync(outputFile, processedLines.join('\n'), encoding);

    console.log('\n📊 Preparation Statistics:');
    console.log(`   Total lines: ${stats.totalLines}`);
    console.log(`   Processed lines: ${stats.processedLines}`);
    console.log(`   Cleaned lines: ${stats.cleanedLines}`);
    console.log(`   Errors: ${stats.errors}`);
    console.log(`   Warnings: ${stats.warnings}`);
    console.log(`   Success rate: ${((stats.processedLines - stats.errors) / stats.totalLines * 100).toFixed(1)}%`);

    return {
      outputFile,
      stats
    };
  }

  private normalizeDate(line: string): string {
    // Convert various date formats to DD/MM/YYYY
    const datePatterns = [
      // MM/DD/YYYY -> DD/MM/YYYY
      { pattern: /(\d{1,2})\/(\d{1,2})\/(\d{4})/g, replacement: '$2/$1/$3' },
      // YYYY-MM-DD -> DD/MM/YYYY
      { pattern: /(\d{4})-(\d{1,2})-(\d{1,2})/g, replacement: '$3/$2/$1' },
      // DD-MM-YYYY -> DD/MM/YYYY
      { pattern: /(\d{1,2})-(\d{1,2})-(\d{4})/g, replacement: '$1/$2/$3' }
    ];

    let normalized = line;
    for (const { pattern, replacement } of datePatterns) {
      normalized = normalized.replace(pattern, replacement);
    }

    return normalized;
  }

  private validateLine(line: string, lineNumber: number): { error?: string; warning?: string } {
    const trimmed = line.trim();
    
    if (!trimmed) {
      return { warning: 'Empty line' };
    }

    // Check for valid record types
    const validTypes = ['SMS', 'Call Log', 'Calendar', 'Instant'];
    const hasValidType = validTypes.some(type => trimmed.startsWith(type));
    
    if (!hasValidType) {
      return { warning: 'Line does not start with valid record type' };
    }

    // Check for date format
    const datePattern = /\d{2}\/\d{2}\/\d{4}/;
    if (!datePattern.test(trimmed)) {
      return { error: 'No valid date found (expected DD/MM/YYYY)' };
    }

    // Check for phone number format (basic)
    const phonePattern = /\+?\d{10,15}/;
    if (trimmed.includes('From:') || trimmed.includes('To:')) {
      if (!phonePattern.test(trimmed)) {
        return { warning: 'No phone number found in From/To field' };
      }
    }

    return {};
  }

  async analyzeLogFile(inputFile: string) {
    console.log(`🔍 Analyzing log file: ${inputFile}`);

    if (!fs.existsSync(inputFile)) {
      throw new Error(`File not found: ${inputFile}`);
    }

    const content = fs.readFileSync(inputFile, 'utf8');
    const lines = content.split('\n');

    const analysis = {
      totalLines: lines.length,
      emptyLines: 0,
      recordTypes: {
        SMS: 0,
        'Call Log': 0,
        Calendar: 0,
        Instant: 0,
        Unknown: 0
      },
      dateFormats: new Set<string>(),
      phoneNumbers: new Set<string>(),
      issues: [] as string[]
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;

      if (!line.trim()) {
        analysis.emptyLines++;
        continue;
      }

      // Count record types
      if (line.startsWith('SMS')) analysis.recordTypes.SMS++;
      else if (line.startsWith('Call Log')) analysis.recordTypes['Call Log']++;
      else if (line.startsWith('Calendar')) analysis.recordTypes.Calendar++;
      else if (line.startsWith('Instant')) analysis.recordTypes.Instant++;
      else analysis.recordTypes.Unknown++;

      // Extract date formats
      const dateMatches = line.match(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}/g);
      if (dateMatches) {
        dateMatches.forEach(date => analysis.dateFormats.add(date));
      }

      // Extract phone numbers
      const phoneMatches = line.match(/\+?\d{10,15}/g);
      if (phoneMatches) {
        phoneMatches.forEach(phone => analysis.phoneNumbers.add(phone));
      }

      // Check for common issues
      if (line.includes('From:') && !line.match(/\+?\d{10,15}/)) {
        analysis.issues.push(`Line ${lineNumber}: From field without phone number`);
      }

      if (line.includes('To:') && !line.match(/\+?\d{10,15}/)) {
        analysis.issues.push(`Line ${lineNumber}: To field without phone number`);
      }
    }

    console.log('\n📊 Log File Analysis:');
    console.log(`   Total lines: ${analysis.totalLines}`);
    console.log(`   Empty lines: ${analysis.emptyLines}`);
    console.log(`   Record types:`);
    Object.entries(analysis.recordTypes).forEach(([type, count]) => {
      console.log(`     ${type}: ${count}`);
    });
    console.log(`   Unique date formats: ${analysis.dateFormats.size}`);
    console.log(`   Unique phone numbers: ${analysis.phoneNumbers.size}`);
    console.log(`   Issues found: ${analysis.issues.length}`);

    if (analysis.issues.length > 0) {
      console.log('\n⚠️  Issues:');
      analysis.issues.slice(0, 10).forEach(issue => console.log(`   ${issue}`));
      if (analysis.issues.length > 10) {
        console.log(`   ... and ${analysis.issues.length - 10} more issues`);
      }
    }

    return analysis;
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const inputFile = args[1];

  if (!command || !inputFile) {
    console.error('❌ Usage: npm run prepare-log <analyze|prepare> <input-file> [output-file]');
    console.error('   analyze: Analyze log file structure and issues');
    console.error('   prepare: Clean and normalize log file');
    process.exit(1);
  }

  const preparer = new LogPreparer();

  try {
    if (command === 'analyze') {
      await preparer.analyzeLogFile(inputFile);
    } else if (command === 'prepare') {
      const outputFile = args[2];
      await preparer.prepareLogFile({
        inputFile,
        outputFile,
        normalizeDates: true,
        cleanEmptyLines: true,
        validateFormat: true
      });
    } else {
      console.error('❌ Invalid command. Use "analyze" or "prepare"');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { LogPreparer };
