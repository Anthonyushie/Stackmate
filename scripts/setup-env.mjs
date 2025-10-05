#!/usr/bin/env node

/**
 * Interactive Environment Setup
 * Helps configure the .env file for Stackmate
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import * as readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

function validateContractAddress(address, network) {
  if (!address || typeof address !== 'string') return false;
  
  const prefix = network === 'testnet' ? 'ST' : 'SP';
  if (!address.toUpperCase().startsWith(prefix)) {
    console.log(`❌ ${network} addresses should start with ${prefix}`);
    return false;
  }
  
  if (!address.includes('.')) {
    console.log('❌ Contract address should include contract name (e.g., ST123....puzzle-pool)');
    return false;
  }
  
  const parts = address.split('.');
  if (parts.length !== 2) {
    console.log('❌ Contract address format: ADDRESS.CONTRACT_NAME');
    return false;
  }
  
  return true;
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║      STACKMATE ENVIRONMENT CONFIGURATION             ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');
  
  const envPath = resolve(process.cwd(), '.env');
  
  // Check if .env already exists
  if (existsSync(envPath)) {
    console.log('⚠️  .env file already exists!\n');
    const existing = readFileSync(envPath, 'utf-8');
    console.log('Current contents:');
    console.log('─'.repeat(60));
    console.log(existing);
    console.log('─'.repeat(60));
    
    const overwrite = await question('\nDo you want to overwrite it? (yes/no): ');
    if (overwrite.toLowerCase() !== 'yes' && overwrite.toLowerCase() !== 'y') {
      console.log('\n✅ Keeping existing .env file');
      rl.close();
      return;
    }
  }
  
  console.log('\n📝 Let\'s configure your contract addresses\n');
  console.log('You need the deployed contract address from your Stacks transaction.');
  console.log('Format: ST1234567890ABCDEF.puzzle-pool (testnet)');
  console.log('    or: SP1234567890ABCDEF.puzzle-pool (mainnet)\n');
  
  // Get testnet contract
  let testnetContract = '';
  while (true) {
    testnetContract = await question('Enter TESTNET contract address (or "skip"): ');
    
    if (testnetContract.toLowerCase() === 'skip') {
      testnetContract = 'ST2QK4128H22NH4H8MD2AVP72M0Q72TKS48VB5469.puzzle-pool';
      console.log(`   Using example: ${testnetContract}`);
      break;
    }
    
    testnetContract = testnetContract.trim();
    if (validateContractAddress(testnetContract, 'testnet')) {
      console.log('   ✅ Valid testnet address\n');
      break;
    }
    console.log('   ❌ Invalid format, try again\n');
  }
  
  // Get mainnet contract
  let mainnetContract = '';
  while (true) {
    mainnetContract = await question('Enter MAINNET contract address (or "skip"): ');
    
    if (mainnetContract.toLowerCase() === 'skip') {
      mainnetContract = 'SP000000000000000000002Q6VF78.puzzle-pool';
      console.log(`   Using placeholder: ${mainnetContract}`);
      break;
    }
    
    mainnetContract = mainnetContract.trim();
    if (validateContractAddress(mainnetContract, 'mainnet')) {
      console.log('   ✅ Valid mainnet address\n');
      break;
    }
    console.log('   ❌ Invalid format, try again\n');
  }
  
  // Create .env content
  const envContent = `# Stackmate Contract Configuration
# Generated: ${new Date().toISOString()}

# Testnet contract address
VITE_CONTRACT_TESTNET=${testnetContract}

# Mainnet contract address  
VITE_CONTRACT_MAINNET=${mainnetContract}
`;
  
  // Write to .env
  try {
    writeFileSync(envPath, envContent);
    console.log('\n✅ .env file created successfully!\n');
    console.log('File location:', envPath);
    console.log('\nContents:');
    console.log('─'.repeat(60));
    console.log(envContent);
    console.log('─'.repeat(60));
    
    console.log('\n🎯 Next Steps:\n');
    console.log('1. Verify difficulty stakes are initialized in your contract:');
    console.log('   (contract-call? .puzzle-pool set-difficulty-stake "beginner" u500000)');
    console.log('   (contract-call? .puzzle-pool set-difficulty-stake "intermediate" u2000000)');
    console.log('   (contract-call? .puzzle-pool set-difficulty-stake "expert" u5000000)\n');
    
    console.log('2. Test the connection:');
    console.log('   node scripts/test-contract.mjs\n');
    
    console.log('3. Restart your dev server:');
    console.log('   npm run dev (or bun run dev)\n');
    
    console.log('4. Open http://localhost:5173 and check for puzzles!\n');
    
    console.log('📚 Need help? Check TROUBLESHOOTING.md and SETUP_INSTRUCTIONS.md\n');
    
  } catch (error) {
    console.error('❌ Error writing .env file:', error.message);
  }
  
  rl.close();
}

main().catch(error => {
  console.error('❌ Error:', error.message);
  rl.close();
  process.exit(1);
});
