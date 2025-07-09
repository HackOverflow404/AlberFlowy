import { fileURLToPath } from 'url';
import dotenv from "dotenv";
import crypto from "crypto";
import https from "https";
import path from 'path';
import fs from "fs";

dotenv.config();


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const configPath = path.join(__dirname, '.wfconfig.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const API_BASE = "https://workflowy.com";

export class WorkFlowyClient {
  constructor(sessionId = config.sessionid, apiKey = process.env.WORKFLOWY_API_KEY) {
    this.sessionId = sessionId;
    this.apiKey = apiKey;
  }

  createClientId = () => {
    const date = new Date();

    const pad = (n, width = 2) => String(n).padStart(width, '0');

    const id = `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}.${pad(date.getUTCMilliseconds(), 3)}`;
    return id;
  };
  
  getTree = async () => {
    const res = await fetch(`${API_BASE}/get_tree_data/`, {
      headers: { cookie: `sessionid=${this.sessionId}` },
    });

    const data = await res.json();
    const itemMap = new Map();

    for (const item of data.items) {
      item.children = [];
      itemMap.set(item.id, item);
    }

    const rootItems = data.items.filter(item => {
      const parent = itemMap.get(item.prnt);
      if (parent) {
        parent.children.push(item);
        return false;
      }
      return true;
    });

    return rootItems;
  }

  getUserData = async (treeID = "Root") => {
    const res = await fetch(`${API_BASE}/get_initialization_data?client_version=21&client_version_v2=28&no_root_children=1`, {
      headers: { cookie: `sessionid=${this.sessionId}` },
    });

    const userData = (await res.json()).projectTreeData;
    const lastTransactionIds = {
      Root: userData.mainProjectTreeInfo.initialMostRecentOperationTransactionId
    };

    for (const tree of userData.auxiliaryProjectTreeInfos) {
      lastTransactionIds[tree.shareId] = tree.initialMostRecentOperationTransactionId;
    }

    return {
      userID: userData.mainProjectTreeInfo.ownerId.toString(),
      timestamp: Math.floor(Date.now() / 1000) - userData.mainProjectTreeInfo.dateJoinedTimestampInSeconds,
      recentID: lastTransactionIds[treeID],
    };
  }

  createNode = async (title) => {
    const data = JSON.stringify({ new_bullet_title: title });

    const options = {
      hostname: 'workflowy.com',
      port: 443,
      path: '/api/bullets/create/',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    };

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let response = '';
        res.on('data', chunk => response += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(JSON.parse(response));
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${response}`));
          }
        });
      });

      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }

  pushAndPoll = async (operation) => {
    const userData = await this.getUserData();
    const payload = [{
      most_recent_operation_transaction_id: userData.recentID,
      operations: [operation],
    }];

    const clientId = this.createClientId();
    const pushPollId = crypto.randomUUID().substring(0, 8);
    const formData = new FormData();
    formData.append("client_id", clientId);
    formData.append("client_version", "21");
    formData.append("push_poll_id", pushPollId);
    formData.append("push_poll_data", JSON.stringify(payload));
    formData.append("crosscheck_user_id", userData.userID);

    const res = await fetch(`${API_BASE}/push_and_poll`, {
      method: "POST",
      body: formData,
      headers: { cookie: `sessionid=${this.sessionId}` },
    });

    return res.json();
  }

  editNode = async (newName, projectId) => {
    const userData = await this.getUserData();
    const operation = {
      type: "edit",
      data: {
        projectid: projectId,
        metadataPatches: [],
        metadataInversePatches: [],
        name: newName
      },
      undo_data: {
        previous_last_modified: 0,
        previous_last_modified_by: null,
        previous_name: "",
        metadataPatches: []
      },
      client_timestamp: userData.timestamp
    };

    return this.pushAndPoll(operation);
  }
  
  createNodeCustom = async (name, parentId = "None") => {
    const userData = await this.getUserData();
    const operation = {
      type: "bulk_create",
      data: {
        parentid: parentId,
        starting_priority: 0,
        isForSearch: false,
        project_trees: JSON.stringify(
          [
            {
              "nm": name,
              "metadata": {},
              "id": crypto.randomUUID().toString(),
              "ct": userData.timestamp,
              "cb": userData.userID
            }
          ]
        ),
      },
      client_timestamp: userData.timestamp
    }

    return this.pushAndPoll(operation);
  }

  deleteNode = async (projectId) => {
    const userData = await this.getUserData();
    const operation = {
      type: "delete",
      data: {
        projectid: projectId,
      },
      undo_data: {
        previous_last_modified: 0,
        previous_last_modified_by: null,
        previous_name: "",
      },
      client_timestamp: userData.timestamp
    };

    return this.pushAndPoll(operation);
  }
  
  completeNode = async (projectId) => {
    const userData = await this.getUserData();
    const operation = {
      type: "complete",
      data: {
        projectid: projectId,
      },
      undo_data: {
        previous_last_modified: 0,
        previous_last_modified_by: null,
        previous_name: "",
      },
      client_timestamp: userData.timestamp
    };

    return this.pushAndPoll(operation);
  }
  
  uncompleteNode = async (projectId) => {
    const userData = await this.getUserData();
    const operation = {
      type: "uncomplete",
      data: {
        projectid: projectId,
      },
      undo_data: {
        previous_last_modified: 0,
        previous_last_modified_by: null,
        previous_name: "",
      },
      client_timestamp: userData.timestamp
    };

    return this.pushAndPoll(operation);
  }

  // TODO: add deleteNode, completeNode, etc.
}