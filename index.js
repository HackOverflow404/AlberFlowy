/*
 * Feature List:
 * 1. ✅ Workflowy Authentication
 * 2. ✅ Create Workflowy Node
 * 3. Read Workflowy Node
 * 4. Update Workflowy Node
 * 5. Delete Workflowy Node
 * 6. Complete Workflowy Node
 */


import fs from 'fs';
import https from 'https';
import dotenv from 'dotenv';
dotenv.config();

const CONFIG_PATH = './.wfconfig.json';
const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));

const createNode = (title) => {
  const apiKey = process.env.WORKFLOWY_API_KEY;
  const node = "";

  const data = JSON.stringify({
    "new_bullet_title": title,

  });

  const options = {
    hostname: 'workflowy.com',
    port: 443,
    path: '/api/bullets/create/',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Content-Length': data.length
    }
  };

  const req = https.request(options, (res) => {
    let responseData = '';
    
    res.on('data', (chunk) => {
      responseData += chunk;
    });
    
    res.on('end', () => {
      if (res.statusCode === 200 || res.statusCode === 201) {
        console.log("Workflowy bullet created");
        console.log(responseData);
      } else {
        console.log(`Workflowy Error: ${res.statusCode}`);
        console.log(responseData);
      }
    });
  });

  req.on('error', (error) => {
    console.error('Request error:', error);
  });

  req.write(data);
  req.end();
};




// createNode("Test without node header");