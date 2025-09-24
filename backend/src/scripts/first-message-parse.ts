import * as fs from 'fs';
import * as readline from 'readline';

async function parseFirstMessage(filePath: string) {
  console.log(`🔍 FIRST MESSAGE PARSER: Starting parse of ${filePath}`);
  
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let currentRecord: string[] = [];
  let isProcessingMessage = false;
  let foundFirstMessage = false;

  for await (const line of rl) {
    // Stop after first message
    if (foundFirstMessage) {
      break;
    }
    
    // Skip empty lines
    if (!line.trim()) {
      continue;
    }

    // Check if this is a new message start (ID + type + direction + date pattern)
    const isNewMessage = /^\s*(\d+)\s+(SMS|Instant)\s+(From|To)?\s+(\d{2}\/\d{2}\/\d{4})/.test(line);
    
    if (isNewMessage) {
      if (currentRecord.length > 0) {
        // Process the first message
        console.log(`\n🔍 PROCESSING FIRST MESSAGE:`);
        console.log(`Raw lines:`, currentRecord);
        
        // Parse the start line
        const startLine = currentRecord[0];
        const startMatch = startLine.match(/^\s*(\d+)\s+(SMS|Instant)\s+(From|To)?\s+(\d{2}\/\d{2}\/\d{4})\s+(.*)$/);
        
        if (startMatch) {
          const [, id, type, direction, dateStr, rest] = startMatch;
          console.log(`📊 PARSED: ID=${id}, Type=${type}, Direction=${direction}, Date=${dateStr}`);
          console.log(`📄 REST: ${rest}`);
          
          // Extract phone number and name from the rest
          const fromMatch = rest.match(/From:\s*([^\s]+)(?:\s+(.*))?/);
          const toMatch = rest.match(/To:\s*([^\s]+)(?:\s+(.*))?/);
          
          if (fromMatch) {
            const phoneNumber = fromMatch[1];
            const name = fromMatch[2]?.trim();
            const contentStart = rest.replace(/From:\s*[^\s]+(?:\s+.*)?/, '').trim();
            console.log(`📞 PHONE: ${phoneNumber}`);
            console.log(`👤 NAME: ${name}`);
            console.log(`📝 CONTENT_START: ${contentStart}`);
          } else if (toMatch) {
            const phoneNumber = toMatch[1];
            const name = toMatch[2]?.trim();
            const contentStart = rest.replace(/To:\s*[^\s]+(?:\s+.*)?/, '').trim();
            console.log(`📞 PHONE: ${phoneNumber}`);
            console.log(`👤 NAME: ${name}`);
            console.log(`📝 CONTENT_START: ${contentStart}`);
          }
          
          // Find time from continuation lines
          let timeStr = '';
          let contentLines: string[] = [];
          
          for (let i = 1; i < currentRecord.length; i++) {
            const line = currentRecord[i];
            const timeMatch = line.match(/(\d{2}:\d{2}:\d{2})\(UTC\+0\)/);
            if (timeMatch) {
              timeStr = timeMatch[1];
              console.log(`⏰ TIME FOUND: ${timeStr}`);
              
              const contentAfterTime = line.replace(/\d{2}:\d{2}:\d{2}\(UTC\+0\)/, '').trim();
              if (contentAfterTime) {
                contentLines.push(contentAfterTime);
                console.log(`📝 CONTENT AFTER TIME: ${contentAfterTime}`);
              }
            } else {
              const trimmedLine = line.trim();
              if (trimmedLine) {
                contentLines.push(trimmedLine);
                console.log(`📝 WRAPPED CONTENT: ${trimmedLine}`);
              }
            }
          }
          
          console.log(`📄 FINAL CONTENT: ${contentLines.join(' ')}`);
        }
        
        foundFirstMessage = true;
        break;
      }
      
      // Start new message
      isProcessingMessage = true;
      currentRecord = [line];
      console.log(`🆕 NEW MESSAGE: ${line.substring(0, 100)}...`);
    } else if (isProcessingMessage) {
      // This is a continuation line
      currentRecord.push(line);
      console.log(`📝 CONTINUATION: ${line.substring(0, 100)}...`);
    }
  }

  console.log(`\n🎉 First message parse completed!`);
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const logFilePath = args[0];
  
  if (!logFilePath) {
    console.error('❌ Please provide log file path');
    console.error('Usage: npm run first-message-parse <path-to-log.txt>');
    process.exit(1);
  }

  if (!fs.existsSync(logFilePath)) {
    console.error(`❌ File not found: ${logFilePath}`);
    process.exit(1);
  }

  try {
    await parseFirstMessage(logFilePath);
  } catch (error) {
    console.error('❌ First message parse failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

