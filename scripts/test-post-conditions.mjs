#!/usr/bin/env node

/**
 * Test script to verify post condition creation works with @stacks/transactions v7
 * This tests the fix for the makeStandardSTXPostCondition export error
 */

import { Pc, uintCV, cvToHex } from '@stacks/transactions';

console.log('🧪 Testing Post Condition Creation\n');

try {
  // Test data
  const senderAddress = 'ST2QK4128H22NH4H8MD2AVP72M0Q72TKS48VB5469';
  const entryAmount = 1000000n; // 1 STX in micro-STX
  const puzzleId = 1n;

  console.log('📝 Test Parameters:');
  console.log(`  Sender: ${senderAddress}`);
  console.log(`  Entry Amount: ${entryAmount} micro-STX (${Number(entryAmount) / 1000000} STX)`);
  console.log(`  Puzzle ID: ${puzzleId}\n`);

  // Test 1: Create post condition with new Pc API
  console.log('✓ Test 1: Creating post condition with Pc.principal()...');
  const pc = Pc.principal(senderAddress).willSendEq(entryAmount).ustx();
  console.log('  ✅ Post condition created successfully!');
  console.log(`  Type: ${pc.type}`);
  console.log(`  Structure:`, JSON.stringify(pc, null, 2));
  console.log();

  // Test 2: Create function arguments
  console.log('✓ Test 2: Creating function arguments...');
  const arg = uintCV(puzzleId);
  const argHex = cvToHex(arg);
  console.log('  ✅ Arguments created successfully!');
  console.log(`  Puzzle ID CV: ${arg.type}`);
  console.log(`  Hex encoded: ${argHex}`);
  console.log();

  // Test 3: Verify post condition structure
  console.log('✓ Test 3: Verifying post condition structure...');
  
  // The Pc object should be a valid post condition object
  if (!pc || pc.type !== 'stx-postcondition') {
    throw new Error('Post condition is invalid or not an STX post condition');
  }
  
  if (pc.address !== senderAddress) {
    throw new Error('Post condition address does not match sender');
  }
  
  if (pc.condition !== 'eq') {
    throw new Error('Post condition code is not "eq"');
  }
  
  if (pc.amount !== String(entryAmount)) {
    throw new Error('Post condition amount does not match entry fee');
  }
  
  console.log('  ✅ Post condition structure is valid!');
  console.log('  ✅ Address matches sender');
  console.log('  ✅ Condition is "eq" (equal)');
  console.log('  ✅ Amount matches entry fee');
  console.log();

  // Test 4: Test different amounts
  console.log('✓ Test 4: Testing different STX amounts...');
  const amounts = [
    { stx: 0.1, micro: 100000n },
    { stx: 1, micro: 1000000n },
    { stx: 10, micro: 10000000n },
    { stx: 100, micro: 100000000n },
  ];

  for (const { stx, micro } of amounts) {
    const testPc = Pc.principal(senderAddress).willSendEq(micro).ustx();
    if (!testPc || testPc.type !== 'stx-postcondition') {
      throw new Error(`Failed to create post condition for ${stx} STX`);
    }
    console.log(`  ✅ ${stx} STX (${micro} micro-STX) - OK`);
  }
  console.log();

  // Test 5: Test with different addresses
  console.log('✓ Test 5: Testing with different address formats...');
  const addresses = [
    'ST2QK4128H22NH4H8MD2AVP72M0Q72TKS48VB5469', // Testnet
    'ST000000000000000000002AMW42H', // Testnet
    'SP000000000000000000002Q6VF78', // Mainnet
  ];

  for (const addr of addresses) {
    const testPc = Pc.principal(addr).willSendEq(1000000n).ustx();
    if (!testPc || testPc.type !== 'stx-postcondition') {
      throw new Error(`Failed to create post condition for address ${addr}`);
    }
    console.log(`  ✅ ${addr.substring(0, 8)}...${addr.substring(addr.length - 6)} - OK`);
  }
  console.log();

  // Test 6: Test origin() alternative
  console.log('✓ Test 6: Testing Pc.origin() alternative...');
  const originPc = Pc.origin().willSendEq(entryAmount).ustx();
  console.log('  ✅ Origin post condition created successfully!');
  console.log(`  Structure:`, JSON.stringify(originPc, null, 2));
  console.log();

  // Summary
  console.log('═══════════════════════════════════════════════════');
  console.log('✅ ALL TESTS PASSED!');
  console.log('═══════════════════════════════════════════════════');
  console.log();
  console.log('The fix for makeStandardSTXPostCondition is working correctly.');
  console.log('The new Pc API from @stacks/transactions v7 is functioning as expected.');
  console.log();
  console.log('You can now safely use puzzle entry in the app! 🎉');
  console.log();

  process.exit(0);

} catch (error) {
  console.error('❌ TEST FAILED!');
  console.error('Error:', error.message);
  console.error();
  console.error('Stack trace:');
  console.error(error.stack);
  console.error();
  process.exit(1);
}
