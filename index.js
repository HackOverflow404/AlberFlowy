import fs from 'fs';
import https from 'https';
import Workflowy from './Workflowy.js';
import dotenv from 'dotenv';
dotenv.config();

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

// let wf = new Workflowy({});
// let email = "medhansh2005@gmail.com";
// let schema = {
//   properties: {
//     email: {
//       required: true
//     }
//   }
// }

// wf.getAuthType(email).then(authType => {
  //   // if (authType == 'password') {
//   //   schema = {properties: {
//   //     password: {
//   //       required: true,
//   //       hidden: true
//   //     }
//   //   }}
//   // } else if (authType == 'code') {
  //   //   console.log(`An email has been sent to ${email} with a login code. Enter that code here:`)
//   //   schema = {properties: {code: {required: true}}}
//   // }

//   // console.log(`Auth type for ${email} is ${authType}`);

//   prompt.get(schema, function (err, result2) {
  //     if (err) {console.log('\nCANCELLED\n'); process.exit(1)}
//     wf = new Workflowy({username: email, password: result2.password, code: result2.code})
//     wf.login().then(function () {
  //       if (wf.sessionid) {
    //         deferred.resolve("Successfully wrote sessionid to " + config_path)
//       } else {
//         deferred.reject(new Error("Failed to get sessionid"))
//       }
//     }).catch(err => {
  //       console.log("err", err)
  //     })
  //   })
  // }).catch(err => { console.log("err", err) });


const CONFIG_PATH = './.wfconfig.json';
function getSessionId() {
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error(`⚠️ Config file not found at ${CONFIG_PATH}`);
  }

  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));

  if (!config.sessionid) {
    throw new Error('❌ sessionid not found in config');
  }

  return config.sessionid;
}

let wf = new Workflowy({sessionid: getSessionId()});
let depth = 2;
await wf.refresh();

const test = wf.outline.then(function (outline) {
  let rootnode = {
    nm: 'root',
    ch: outline,
    id: ''
  }
  recursivePrint(rootnode, null, '', depth)
}, err => { console.log("err", err) }).fin(() => process.exit())

function recursivePrint (node, prefix, spaces, maxDepth) {
  if (hiddencompleted && node.cp) {return}
  if (!prefix) {prefix = '\u21b3 '}
  if (!spaces) {spaces = ''}
  let println = ''
  println = spaces + prefix + node.nm
  if (withnote && node.no) {
    println += '\n'+spaces+'    '+ node.no
  }

  if (withid) {println += '\n[' + node.id + ']'}

  console.log(println)

  if (maxDepth < 1) {return}

  let children = node.ch
  for (let i in children) {
    recursivePrint(children[i], prefix, spaces+' ', maxDepth-1)
  }
}

// createNode("Test without node header");
// workflowyPackageTest().catch(console.error);