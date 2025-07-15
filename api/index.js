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

import { WorkFlowyClient } from './workflowy.js';

(async () => {
  const client = new WorkFlowyClient();

  // Create a node
  // const response = await client.createNode("Hello World Node");
  // console.log(response);

  // Get tree
  // const tree = await client.getTree();
  // console.dir(tree, { depth: null });
  // await fs.writeFile('tree_data.json', JSON.stringify(tree, null, 2));

  // Create a custom node
  const newNode = await client.createNodeCustom("New Node!");
  console.log(newNode);
  
  // Edit a node
  // const updated = await client.editNode("be0325bb-a014-94af-45ad-00365e23757c", "Updated Name!");

  // Delete a node
  // const deleteNode = await client.deleteNode("5db3223f-db0c-3060-aace-0beb0d99579b");
  // console.log(deleteNode);
})();
