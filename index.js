/*
 * Feature List:
 * 1. ✅ WorkFlowy Authentication
 * 2. ✅ Create WorkFlowy Node
 * 3. ✅ Read WorkFlowy Nodes
 * 4. Update WorkFlowy Node
 * 5. Delete WorkFlowy Node
 * 6. Complete WorkFlowy Node
 * 7. Upgrade to Sign in with Google instead of App Password
 */
import dotenv from 'dotenv';
import https from 'https';
import fs from 'fs';

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
        console.log("WorkFlowy bullet created");
        console.log(responseData);
      } else {
        console.log(`WorkFlowy Error: ${res.statusCode}`);
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

const getNodes = async () => {
  const response = await fetch("https://workflowy.com/get_tree_data/", {
    headers: {
      cookie: `sessionid=${config.sessionid}`
    },
  });

  const data = await response.json();

  // Convert flat array to map for easy lookup
  const itemMap = new Map();
  for (const item of data.items) {
    item.children = [];
    itemMap.set(item.id, item);
  }

  // Now build the tree
  let rootItems = [];
  for (const item of data.items) {
    if (item.prnt && itemMap.has(item.prnt)) {
      itemMap.get(item.prnt).children.push(item);
    } else {
      rootItems.push(item); // Root-level node (e.g., no parent found)
    }
  }

  return rootItems;
};

getNodes().then(tree => {
  console.log(JSON.stringify(tree, null, 2));
});