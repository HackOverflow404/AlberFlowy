/*
 * Feature List:
 * - ✅ WorkFlowy Authentication
 * - ✅ Create WorkFlowy Node
 * - ✅ Read WorkFlowy Nodes
 * - ✅ Control Node Creation Location
 * - Update WorkFlowy Node
 * - Delete WorkFlowy Node
 * - Complete WorkFlowy Node
 * - Upgrade to Sign in with Google instead of App Password
 * - Add caching
 */

import { WorkFlowyClient } from './api/workflowy.js';
import fs from 'fs/promises';

(async () => {
  const client = new WorkFlowyClient();

  // Create a node
  // const response = await client.createNode("Hello World Node");
  // console.log(response);

  // Get tree
  const tree = await client.getTree();
  console.dir(tree, { depth: null });
  await fs.writeFile('tree_data.json', JSON.stringify(tree, null, 2));

  // Create a custom node
  // const newNode = await client.createNodeCustom("New Node!");
  // console.log(newNode);
  
  // Edit a node
  // const updated = await client.editNode("be0325bb-a014-94af-45ad-00365e23757c", "Updated Name!");
})();
