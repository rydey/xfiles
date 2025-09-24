import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as readline from 'readline';

const prisma = new PrismaClient();

interface ParsedRecord {
  id: number;
  type: 'Calendar' | 'Call Log' | 'SMS Messages' | 'Instant Messages';
  direction?: 'From' | 'To';
  timestamp: Date;
  phoneNumber?: string;
  name?: string;
  content?: string;
  attachment?: string;
  location?: string;
  deleted: boolean;
  rawLine: string;
}

interface ImportStats {
  totalLines: number;
  processedRecords: number;
  createdContacts: number;
  createdMessages: number;
  errors: number;
  skippedLines: number;
}

class TableLogParser {
  private contactCache = new Map<string, number>();
  private stats: ImportStats = {
    totalLines: 0,
    processedRecords: 0,
    createdContacts: 0,
    createdMessages: 0,
    errors: 0,
    skippedLines: 0
  };

  async parseLogFile(filePath: string, options: {
    dryRun?: boolean;
    skipDuplicates?: boolean;
    batchSize?: number;
  } = {}) {
    const { dryRun = false, skipDuplicates = true, batchSize = 100 } = options;
    
    console.log(`🚀 Starting ${dryRun ? 'DRY RUN' : 'LIVE'} import of ${filePath}`);
    console.log(`📊 Options: skipDuplicates=${skipDuplicates}, batchSize=${batchSize}`);
    
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    let batch: ParsedRecord[] = [];
    let isHeader = true;
    let columnMapping: { [key: string]: number } = {};

    for await (const line of rl) {
      this.stats.totalLines++;
      
      // Skip empty lines
      if (!line.trim()) {
        this.stats.skippedLines++;
        continue;
      }

      // Skip header lines
      if (isHeader) {
        if (line.includes('Type') && line.includes('Direction')) {
          // This is the header line, parse column positions
          columnMapping = this.parseHeader(line);
          isHeader = false;
        }
        this.stats.skippedLines++;
        continue;
      }

      // Skip separator lines
      if (line.includes('---') || line.match(/^\s*$/)) {
        this.stats.skippedLines++;
        continue;
      }

      try {
        const parsed = this.parseTableRow(line, columnMapping);
        if (parsed) {
          batch.push(parsed);
          this.stats.processedRecords++;
          
          // Process batch when it reaches batchSize
          if (batch.length >= batchSize) {
            await this.processBatch(batch, { dryRun, skipDuplicates });
            batch = [];
          }
        }
      } catch (error) {
        console.error(`❌ Error processing line ${this.stats.totalLines}:`, error);
        this.stats.errors++;
      }
    }

    // Process remaining batch
    if (batch.length > 0) {
      await this.processBatch(batch, { dryRun, skipDuplicates });
    }

    this.printStats();
  }

  private parseHeader(headerLine: string): { [key: string]: number } {
    const columns = headerLine.split(/\s{2,}/); // Split on multiple spaces
    const mapping: { [key: string]: number } = {};
    
    columns.forEach((col, index) => {
      const cleanCol = col.trim().toLowerCase();
      if (cleanCol.includes('type')) mapping.type = index;
      if (cleanCol.includes('direction')) mapping.direction = index;
      if (cleanCol.includes('timestamp')) mapping.timestamp = index;
      if (cleanCol.includes('party')) mapping.party = index;
      if (cleanCol.includes('description')) mapping.description = index;
      if (cleanCol.includes('deleted')) mapping.deleted = index;
    });
    
    console.log('📋 Column mapping:', mapping);
    return mapping;
  }

  private parseTableRow(line: string, columnMapping: { [key: string]: number }): ParsedRecord | null {
    // Split the line into columns (handle multiple spaces)
    const columns = line.split(/\s{2,}/);
    
    if (columns.length < 3) {
      return null; // Skip malformed lines
    }

    const type = this.extractColumn(columns, columnMapping.type, 'type');
    const direction = this.extractColumn(columns, columnMapping.direction, 'direction');
    const timestamp = this.extractColumn(columns, columnMapping.timestamp, 'timestamp');
    const party = this.extractColumn(columns, columnMapping.party, 'party');
    const description = this.extractColumn(columns, columnMapping.description, 'description');
    const deleted = this.extractColumn(columns, columnMapping.deleted, 'deleted');

    // Skip if no valid type
    if (!type || !['Calendar', 'Call Log', 'SMS Messages', 'Instant Messages'].includes(type)) {
      return null;
    }

    // Parse timestamp
    const parsedTimestamp = this.parseTimestamp(timestamp);
    if (!parsedTimestamp) {
      return null;
    }

    // Extract phone number and name from party field
    const { phoneNumber, name } = this.parseParty(party);

    // Map type to our enum
    const messageType = this.mapMessageType(type);
    const messageDirection = this.mapDirection(direction);

    return {
      id: this.stats.processedRecords + 1,
      type: messageType,
      direction: messageDirection,
      timestamp: parsedTimestamp,
      phoneNumber,
      name,
      content: description,
      deleted: deleted?.toLowerCase() === 'yes',
      rawLine: line
    };
  }

  private extractColumn(columns: string[], index: number | undefined, fieldName: string): string | null {
    if (index === undefined || index >= columns.length) {
      return null;
    }
    return columns[index]?.trim() || null;
  }

  private parseTimestamp(timestampStr: string | null): Date | null {
    if (!timestampStr) return null;

    // Handle various timestamp formats
    // Format: DD/MM/YYYY or DD/MM/YYYY HH:MM:SS(UTC+0)
    const timestampPatterns = [
      /(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2}:\d{2})/,
      /(\d{2}\/\d{2}\/\d{4})/
    ];

    for (const pattern of timestampPatterns) {
      const match = timestampStr.match(pattern);
      if (match) {
        const [, dateStr, timeStr] = match;
        const [day, month, year] = dateStr.split('/');
        
        if (timeStr) {
          const [hours, minutes, seconds] = timeStr.split(':');
          return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), 
                         parseInt(hours), parseInt(minutes), parseInt(seconds));
        } else {
          return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        }
      }
    }

    return null;
  }

  private parseParty(partyStr: string | null): { phoneNumber?: string; name?: string } {
    if (!partyStr) return {};

    // Extract phone number (starts with + or digits)
    const phoneMatch = partyStr.match(/(\+?\d{7,15})/);
    const phoneNumber = phoneMatch ? phoneMatch[1] : undefined;

    // Extract name (everything after phone number)
    let name = partyStr;
    if (phoneNumber) {
      name = partyStr.replace(phoneNumber, '').trim();
    }

    return {
      phoneNumber,
      name: name || undefined
    };
  }

  private mapMessageType(type: string): 'Calendar' | 'Call Log' | 'SMS Messages' | 'Instant Messages' {
    switch (type) {
      case 'Calendar': return 'Calendar';
      case 'Call Log': return 'Call Log';
      case 'SMS Messages': return 'SMS Messages';
      case 'Instant Messages': return 'Instant Messages';
      default: return 'Calendar';
    }
  }

  private mapDirection(direction: string | null): 'From' | 'To' | undefined {
    if (!direction) return undefined;
    return direction === 'From' ? 'From' : direction === 'To' ? 'To' : undefined;
  }

  private async processBatch(records: ParsedRecord[], options: { dryRun: boolean; skipDuplicates: boolean }) {
    if (options.dryRun) {
      console.log(`📝 DRY RUN: Would process ${records.length} records`);
      return;
    }

    for (const record of records) {
      try {
        await this.insertRecord(record, options.skipDuplicates);
      } catch (error) {
        console.error(`❌ Error inserting record:`, error);
        this.stats.errors++;
      }
    }
  }

  private async getOrCreateContact(phoneNumber: string, name?: string): Promise<number> {
    // Check cache first
    if (this.contactCache.has(phoneNumber)) {
      return this.contactCache.get(phoneNumber)!;
    }

    // Check database
    let contact = await prisma.contact.findUnique({
      where: { phoneNumber }
    });

    if (!contact) {
      contact = await prisma.contact.create({
        data: {
          phoneNumber,
          name: name || null,
          type: 'INDIVIDUAL'
        }
      });
      this.stats.createdContacts++;
    }

    // Cache the result
    this.contactCache.set(phoneNumber, contact.id);
    
    return contact.id;
  }

  private async insertRecord(record: ParsedRecord, skipDuplicates: boolean) {
    // Check for duplicates if requested
    if (skipDuplicates) {
      const existing = await prisma.message.findFirst({
        where: {
          messageType: this.mapToMessageType(record.type),
          direction: this.mapToDirection(record.direction),
          timestamp: record.timestamp,
          content: record.content
        }
      });
      
      if (existing) {
        console.log(`⏭️  Skipping duplicate record`);
        return;
      }
    }

    let senderId: number | null = null;
    let receiverId: number | null = null;

    // Handle sender/receiver based on direction
    if (record.phoneNumber) {
      const contactId = await this.getOrCreateContact(record.phoneNumber, record.name);
      
      if (record.direction === 'From') {
        senderId = contactId;
      } else if (record.direction === 'To') {
        receiverId = contactId;
      } else {
        // If no direction specified, assume it's a sender
        senderId = contactId;
      }
    }

    // Create message
    await prisma.message.create({
      data: {
        messageType: this.mapToMessageType(record.type),
        direction: this.mapToDirection(record.direction),
        senderId,
        receiverId,
        timestamp: record.timestamp,
        content: record.content,
        attachment: record.attachment,
        location: record.location,
        rawLine: record.rawLine
      }
    });

    this.stats.createdMessages++;
    console.log(`✅ Imported ${record.type} from ${record.phoneNumber || 'unknown'}`);
  }

  private mapToMessageType(type: string): 'SMS' | 'CALL' | 'INSTANT' | 'CALENDAR' {
    switch (type) {
      case 'SMS Messages': return 'SMS';
      case 'Call Log': return 'CALL';
      case 'Instant Messages': return 'INSTANT';
      case 'Calendar': return 'CALENDAR';
      default: return 'CALENDAR';
    }
  }

  private mapToDirection(direction?: string): 'FROM' | 'TO' | 'UNKNOWN' {
    switch (direction) {
      case 'From': return 'FROM';
      case 'To': return 'TO';
      default: return 'UNKNOWN';
    }
  }

  private printStats() {
    console.log('\n📊 Import Statistics:');
    console.log(`   Total lines processed: ${this.stats.totalLines}`);
    console.log(`   Records processed: ${this.stats.processedRecords}`);
    console.log(`   Contacts created: ${this.stats.createdContacts}`);
    console.log(`   Messages created: ${this.stats.createdMessages}`);
    console.log(`   Errors: ${this.stats.errors}`);
    console.log(`   Skipped lines: ${this.stats.skippedLines}`);
    console.log(`   Success rate: ${((this.stats.processedRecords - this.stats.errors) / this.stats.processedRecords * 100).toFixed(1)}%`);
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const logFilePath = args[0];
  
  if (!logFilePath) {
    console.error('❌ Please provide log file path');
    console.error('Usage: npm run parse-table-log <path-to-log.txt> [--dry-run] [--no-skip-duplicates] [--batch-size=100]');
    process.exit(1);
  }

  if (!fs.existsSync(logFilePath)) {
    console.error(`❌ File not found: ${logFilePath}`);
    process.exit(1);
  }

  const options = {
    dryRun: args.includes('--dry-run'),
    skipDuplicates: !args.includes('--no-skip-duplicates'),
    batchSize: parseInt(args.find(arg => arg.startsWith('--batch-size='))?.split('=')[1] || '100')
  };

  const parser = new TableLogParser();
  
  try {
    await parser.parseLogFile(logFilePath, options);
    console.log('🎉 Import completed successfully!');
  } catch (error) {
    console.error('❌ Import failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}

export { TableLogParser };
