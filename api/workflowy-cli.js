#!/usr/bin/env node

import { WorkFlowyClient } from './workflowy.js';
import { loginWorkFlowy, updateWfConfig } from './workflowy-auth.js';
import process from 'process';

const client = new WorkFlowyClient();

function usage() {
  console.error(`
Usage:
  workflowy-cli.js <command> [...args]

Commands:
  getTree
  createNode <title>
  createNodeCustom <title> <parentId>
  editNode <newTitle> <projectId>
  deleteNode <projectId>
  completeNode <projectId>
  uncompleteNode <projectId>

Examples:
  workflowy-cli.js getTree
  workflowy-cli.js createNode "Hello World"
  workflowy-cli.js createNodeCustom "Child" 123abc456def
  workflowy-cli.js editNode "New Title" abcd1234
  workflowy-cli.js deleteNode abcd1234
  workflowy-cli.js completeNode abcd1234
  workflowy-cli.js uncompleteNode abcd1234
`);
  process.exit(1);
}

async function main() {
  const [,, command, ...args] = process.argv;

  if (!command) usage();

  try {
    switch (command) {
      case 'getTree': {
        const result = await client.getTree();
        console.log(JSON.stringify(result, null, 2));
        break;
      }

      case 'createNode': {
        if (args.length < 1) {
          console.error("Missing <title> argument.");
          usage();
        }
        const [title] = args;
        const result = await client.createNode(title);
        console.log(JSON.stringify(result, null, 2));
        break;
      }

      case 'createNodeCustom': {
        if (args.length < 2) {
          console.error("Missing <title> and/or <parentId> argument.");
          usage();
        }
        const [title, parentId] = args;
        const result = await client.createNodeCustom(title, parentId);
        console.log(JSON.stringify(result, null, 2));
        break;
      }

      case 'editNode': {
        if (args.length < 2) {
          console.error("Missing <newTitle> and/or <projectId> argument.");
          usage();
        }
        const [newTitle, projectId] = args;
        const result = await client.editNode(newTitle, projectId);
        console.log(JSON.stringify(result, null, 2));
        break;
      }
      
      case 'deleteNode': {
        if (args.length < 1) {
          console.error("Missing <projectId> argument.");
          usage();
        }
        const [projectId] = args;
        const result = await client.deleteNode(projectId);
        console.log(JSON.stringify(result, null, 2));
        break;
      }
      
      case 'completeNode': {
        if (args.length < 1) {
          console.error("Missing <projectId> argument.");
          usage();
        }
        const [projectId] = args;
        const result = await client.completeNode(projectId);
        console.log(JSON.stringify(result, null, 2));
        break;
      }
      
      case 'uncompleteNode': {
        if (args.length < 1) {
          console.error("Missing <projectId> argument.");
          usage();
        }
        const [projectId] = args;
        const result = await client.uncompleteNode(projectId);
        console.log(JSON.stringify(result, null, 2));
        break;
      }
      
      case 'auth': {
        loginWorkFlowy().then(updateWfConfig).catch(err => {
            console.error("Login failed:", err);
            process.exit(1);
          }
        );
        break;
      }

      default:
        console.error(`Unknown command: ${command}`);
        usage();
    }
  } catch (err) {
    console.error("[ERROR]", err?.message ?? err);
    process.exit(1);
  }
}

main();