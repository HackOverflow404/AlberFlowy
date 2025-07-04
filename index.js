import https from 'https';
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

var wf = new Workflowy({sessionid: config.sessionid, includeSharedProjects: config.includeSharedProjects});

depth =  2
return wf.outline.then(function (outline) {
  var rootnode = {
    nm: 'root',
    ch: outline,
    id: ''
  }
  recursivePrint(rootnode, null, '', depth)
}, handleErr).fin(() => process.exit())

function recursivePrint (node, prefix, spaces, maxDepth) {
  if (hiddencompleted && node.cp) {return}
  if (!prefix) {prefix = '\u21b3 '}
  if (!spaces) {spaces = ''}
  var println = ''
  println = spaces + prefix + node.nm
  if (withnote && node.no) {
    println += '\n'+spaces+'    '+ node.no
  }

  if (withid) {println += '\n[' + node.id + ']'}

  console.log(println)

  if (maxDepth < 1) {return}

  var children = node.ch
  for (var i in children) {
    recursivePrint(children[i], prefix, spaces+' ', maxDepth-1)
  }
}

// createNode("Test without node header");
// workflowyPackageTest().catch(console.error);