#!/usr/bin/env node

/**
 * Test Contract Connection
 * This script helps diagnose frontend-contract connection issues
 */

import { fetchCallReadOnlyFunction, uintCV, ClarityType } from '@stacks/transactions';
import { StacksTestnet, StacksMainnet } from '@stacks/network';

const TESTNET_CONTRACT = process.env.VITE_CONTRACT_TESTNET || 'ST2QK4128H22NH4H8MD2AVP72M0Q72TKS48VB5469.puzzle-pool';
const MAINNET_CONTRACT = process.env.VITE_CONTRACT_MAINNET || '';

async function testContract(contractId, network) {
  console.log(`\n🔍 Testing ${network.toUpperCase()} Contract: ${contractId}`);
  console.log('─'.repeat(60));
  
  if (!contractId || !contractId.includes('.')) {
    console.log('❌ Invalid contract ID format');
    return false;
  }

  const [address, name] = contractId.split('.');
  const stxNetwork = network === 'testnet' ? new StacksTestnet() : new StacksMainnet();
  
  try {
    // Test 1: Get puzzle count
    console.log('\n📊 Test 1: Fetching puzzle count...');
    const countCv = await fetchCallReadOnlyFunction({
      contractAddress: address,
      contractName: name,
      functionName: 'get-puzzle-count',
      functionArgs: [],
      senderAddress: address,
      network: stxNetwork,
    });
    
    const ok = countCv.type === ClarityType.ResponseOk ? countCv.value : null;
    const total = ok ? Number(ok.value) : 0;
    console.log(`✅ Total puzzles created: ${total}`);
    
    if (total === 0) {
      console.log('⚠️  No puzzles have been created yet!');
      console.log('   Use the contract to call: (create-puzzle ...)');
      return true;
    }
    
    // Test 2: Check active puzzles
    console.log('\n🎯 Test 2: Checking active puzzles...');
    const activePuzzles = [];
    for (let i = 1; i <= total; i++) {
      const activeCv = await fetchCallReadOnlyFunction({
        contractAddress: address,
        contractName: name,
        functionName: 'is-puzzle-active',
        functionArgs: [uintCV(i)],
        senderAddress: address,
        network: stxNetwork,
      });
      
      const activeOk = activeCv.type === ClarityType.ResponseOk ? activeCv.value : null;
      const isActive = activeOk ? Boolean(activeOk.value) : false;
      
      if (isActive) {
        activePuzzles.push(i);
        console.log(`✅ Puzzle ${i} is ACTIVE`);
      } else {
        console.log(`⚪ Puzzle ${i} is inactive`);
      }
    }
    
    if (activePuzzles.length === 0) {
      console.log('\n⚠️  No active puzzles found!');
      console.log('   All created puzzles have been deactivated.');
    } else {
      console.log(`\n✅ Found ${activePuzzles.length} active puzzle(s): ${activePuzzles.join(', ')}`);
    }
    
    // Test 3: Get puzzle info for active puzzles
    if (activePuzzles.length > 0) {
      console.log('\n📋 Test 3: Fetching puzzle details...');
      for (const puzzleId of activePuzzles) {
        const infoCv = await fetchCallReadOnlyFunction({
          contractAddress: address,
          contractName: name,
          functionName: 'get-puzzle-info',
          functionArgs: [uintCV(puzzleId)],
          senderAddress: address,
          network: stxNetwork,
        });
        
        if (infoCv.type === ClarityType.ResponseOk) {
          console.log(`\n  Puzzle #${puzzleId}:`);
          console.log(`    Difficulty: ${infoCv.value.data.difficulty.data}`);
          console.log(`    Prize Pool: ${infoCv.value.data['prize-pool'].value} microSTX`);
          console.log(`    Entry Count: ${infoCv.value.data['entry-count'].value}`);
          console.log(`    Stake Amount: ${infoCv.value.data['stake-amount'].value} microSTX`);
          console.log(`    Deadline (block): ${infoCv.value.data.deadline.value}`);
          console.log(`    Active: ${infoCv.value.data['is-active'].value}`);
        }
      }
    }
    
    console.log('\n✅ Contract connection successful!\n');
    return true;
    
  } catch (error) {
    console.log(`\n❌ Error testing contract: ${error.message}`);
    console.log('\nPossible issues:');
    console.log('  1. Contract not deployed at this address');
    console.log('  2. Network mismatch (testnet vs mainnet)');
    console.log('  3. Contract name mismatch');
    console.log('  4. Network connectivity issues\n');
    return false;
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║     STACKMATE CONTRACT CONNECTION TEST                 ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  
  // Check if .env is configured
  const hasEnv = process.env.VITE_CONTRACT_TESTNET || process.env.VITE_CONTRACT_MAINNET;
  if (!hasEnv) {
    console.log('\n⚠️  No environment variables found!');
    console.log('   Create a .env file with:');
    console.log('   VITE_CONTRACT_TESTNET=ST....puzzle-pool');
    console.log('   VITE_CONTRACT_MAINNET=SP....puzzle-pool\n');
  }
  
  // Test testnet contract
  if (TESTNET_CONTRACT && TESTNET_CONTRACT.includes('.')) {
    await testContract(TESTNET_CONTRACT, 'testnet');
  }
  
  // Test mainnet contract if configured
  if (MAINNET_CONTRACT && MAINNET_CONTRACT.includes('.') && !MAINNET_CONTRACT.includes('XXX')) {
    await testContract(MAINNET_CONTRACT, 'mainnet');
  }
  
  console.log('\n💡 Next Steps:');
  console.log('   1. Create a .env file in the project root');
  console.log('   2. Add: VITE_CONTRACT_TESTNET=<your-contract-address>.puzzle-pool');
  console.log('   3. Before using contract, initialize difficulty stakes:');
  console.log('      - (set-difficulty-stake "beginner" u500000)');
  console.log('      - (set-difficulty-stake "intermediate" u2000000)');
  console.log('      - (set-difficulty-stake "expert" u5000000)');
  console.log('   4. Restart your dev server');
  console.log('   5. The frontend should now display your puzzles!\n');
}

main().catch(console.error);
