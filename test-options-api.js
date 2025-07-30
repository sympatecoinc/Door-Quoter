#!/usr/bin/env node

// Simple test script to verify the options API endpoint works
const fetch = require('node-fetch');

async function testOptionsAPI() {
  try {
    console.log('Testing master parts API with optionsOnly parameter...');
    
    // Test the API endpoint (assuming server is running on port 3000)
    const response = await fetch('http://localhost:3000/api/master-parts?optionsOnly=true');
    
    if (response.ok) {
      const data = await response.json();
      console.log(`✓ API endpoint works! Found ${data.length} hardware parts marked as options.`);
      
      if (data.length > 0) {
        console.log('Sample data:');
        console.log(JSON.stringify(data.slice(0, 2), null, 2));
      } else {
        console.log('ℹ No hardware parts are currently marked as "Available as Category Option"');
        console.log('Create some master parts with partType="Hardware" and isOption=true to test the full functionality.');
      }
    } else {
      console.error('✗ API endpoint failed:', response.status, response.statusText);
    }
  } catch (error) {
    console.error('✗ Error testing API:', error.message);
    console.log('Make sure the development server is running with: npm run dev');
  }
}

testOptionsAPI();