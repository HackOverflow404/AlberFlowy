#!/usr/bin/env node

import { WorkFlowyClient } from './workflowy.js';
import { loginWorkFlowy, updateWfConfig } from './workflowy-auth.js';
import process from 'process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ESM doesn’t supply __dirname by default:
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configPath = path.join(__dirname, '.wfconfig.json');

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
  auth

Examples:
  workflowy-cli.js getTree
  workflowy-cli.js createNode "Hello World"
  workflowy-cli.js auth
`);
  process.exit(1);
}

async function main() {
  const [,, command, ...args] = process.argv;
  if (!command) usage();

  // Auto‑authenticate if needed
  if (command !== 'auth' && !fs.existsSync(configPath)) {
    console.log(`🛡  No config file (${configPath}) found; running authentication...`);
    try {
      const sessionID = await loginWorkFlowy();
      await updateWfConfig(sessionID);
      console.log('Authentication successful.');
    } catch (err) {
      console.error('Login failed:', err);
      process.exit(1);
    }
  }
  
  const client = new WorkFlowyClient();

  try {
    switch (command) {
      case 'getTree': {
        const result = await client.getTree();
        console.log(JSON.stringify(result, null, 2));
        break;
      }
      case 'createNode': {
        if (args.length < 1) { console.error("Missing <title>."); usage(); }
        const [title] = args;
        console.log(JSON.stringify(await client.createNode(title), null, 2));
        break;
      }
      case 'createNodeCustom': {
        if (args.length < 2) { console.error("Missing <title> or <parentId>."); usage(); }
        const [title, parentId] = args;
        console.log(JSON.stringify(await client.createNodeCustom(title, parentId), null, 2));
        break;
      }
      case 'editNode': {
        if (args.length < 2) { console.error("Missing <newTitle> or <projectId>."); usage(); }
        const [newTitle, projectId] = args;
        console.log(JSON.stringify(await client.editNode(newTitle, projectId), null, 2));
        break;
      }
      case 'deleteNode': {
        if (args.length < 1) { console.error("Missing <projectId>."); usage(); }
        const [projectId] = args;
        console.log(JSON.stringify(await client.deleteNode(projectId), null, 2));
        break;
      }
      case 'completeNode': {
        if (args.length < 1) { console.error("Missing <projectId>."); usage(); }
        const [projectId] = args;
        console.log(JSON.stringify(await client.completeNode(projectId), null, 2));
        break;
      }
      case 'uncompleteNode': {
        if (args.length < 1) { console.error("Missing <projectId>."); usage(); }
        const [projectId] = args;
        console.log(JSON.stringify(await client.uncompleteNode(projectId), null, 2));
        break;
      }
      case 'auth': {
        try {
          const sessionID = await loginWorkFlowy();
          console.log('Authentication successful.');
        } catch (err) {
          console.error("Login failed:", err);
          process.exit(1);
        }
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