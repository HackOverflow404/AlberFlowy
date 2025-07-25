import http from 'http';
import { URL } from 'url';
import { authenticator } from "otplib";
import { ImapFlow } from "imapflow";
import puppeteer from "puppeteer";
import dotenv from "dotenv";
import open from 'open';
import fs from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { google } from 'googleapis'; 

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env'), quiet: true });

const login_url = "https://workflowy.com/login/";
const CONFIG_PATH = join(__dirname, ".wfconfig.json");

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function initClient() {
  const PORT = 3000;
  const redirectUri = `http://localhost:${PORT}/oauth2callback`;

  const oAuth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  );

  // 1) load existing config
  const config = loadConfig();

  // 2) if no refresh_token, run the OAuth flow once
  if (!config.refresh_token) {
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: ['https://mail.google.com/']
    });

    const codePromise = new Promise((resolve, reject) => {
      // start local server to receive the OAuth callback
      const server = http.createServer((req, res) => {
        if (req.url.startsWith('/oauth2callback')) {
          const qs = new URL(req.url, redirectUri).searchParams;
          const code = qs.get('code');
          res.writeHead(200, {'Content-Type':'text/html'});
          res.end('<h1>Auth successful!</h1>You may now close this tab.');
          server.close();
          return resolve(code);
        }
      }).listen(PORT, async () => {
        // open user’s browser once the server is listening
        console.log('Opening the following link in your browser to authorize…\n', authUrl, "\n");
        await open(authUrl);
      });
    });

    const code = await codePromise;
    if (!code) throw new Error('No code received in callback.');

    const { tokens } = await oAuth2Client.getToken(code);
    if (!tokens.refresh_token) throw new Error('No refresh_token returned.');

    config.refresh_token = tokens.refresh_token;
    saveConfig(config);
    console.log('Stored refresh token in', CONFIG_PATH);
  }

  // 3) set up client with the stored refresh token
  oAuth2Client.setCredentials({ refresh_token: config.refresh_token });
  const { token: accessToken } = await oAuth2Client.getAccessToken();

  // 4) return your IMAP client
  return new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: {
      user: process.env.CLIENT_EMAIL,
      accessToken,
    },
    logger: { debug:()=>{}, info:()=>{}, warn:()=>{}, error:()=>{} }
  });
}

async function fetchLoginCode(client) {
  console.log("Waiting 5 seconds before checking email...");
  await sleep(5000);
  
  const ONE_MINUTE = 60 * 1000;
  const searchStartTime = Date.now();
  console.log("Starting email search...");
  try {
    await client.connect();
    const mailbox = await client.mailboxOpen("INBOX");
    const totalMessages = mailbox.exists;
    const startSeq = Math.max(1, totalMessages - 9);
    for await (let msg of client.fetch(`${startSeq}:*`, { envelope: true, source: true, internalDate: true })) {
      const receivedTime = new Date(msg.internalDate).getTime();
      if (searchStartTime - receivedTime > ONE_MINUTE) continue;
      const subject = msg.envelope?.subject;
      console.log("Email subject:", subject);
      if (subject && subject.includes("Login code for Workflowy")) {
        const raw = msg.source.toString('utf-8');
        const codeMatch = raw.match(/\b\d{4}-\d{4}-\d{4}\b/);
        if (codeMatch) {
          console.log("Code found:", codeMatch[0]);
          return codeMatch[0];
        } else {
          console.log("Login code not found in message:", raw.slice(0, 1000));
        }
        if (codeMatch) {
          console.log("Code found:", codeMatch[0]);
          return codeMatch[0];
        } else {
          console.log("No code found in body:", bodyText);
        }
      }
    }
    throw new Error("Code not found in emails from the last 1 minute.");
    
  } catch (error) {
    console.error("Email search error:", error);
    throw error;
  } finally {
    try {
      console.log("Closing email connection...");
      if (client && client.state !== 'LOGOUT') {
        await Promise.race([
          client.close(),
          new Promise((_, reject) => setTimeout(() => reject(new Error("Close timed out")), 3000))
        ]);
      }
    } catch (err) {
      console.warn("Failed to close connection gracefully:", err.message);
    }
  }
}

export async function loginWorkFlowy() {
  const client = await initClient();
  const email = process.env.CLIENT_EMAIL;
  
  // Add validation to ensure email is loaded
  if (!email) {
    throw new Error("CLIENT_EMAIL not found in environment variables. Make sure .env file exists in the project directory.");
  }
  
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const context = browser.defaultBrowserContext();
  const page = await context.newPage();
  await page.goto(login_url, { waitUntil: "networkidle2" });
  await page.type('input[name="email"]', email);
  await page.click("button[type='submit']");
  await page.waitForSelector('input[name="code"]', { visible: true });
  console.log("Login code request sent...");
  const loginCode = await fetchLoginCode(client);
  await page.type('input[name="code"]', loginCode, { delay: 100 });
  await page.click("button[type='submit']");
  let mfaAppeared = false;
  try {
    await page.waitForFunction(() => {
      const inputs = Array.from(document.querySelectorAll('input[name="code"]'));
      return inputs.length === 1 && document.activeElement === inputs[0];
    }, { timeout: 7000 });
    mfaAppeared = true;
  } catch {
    console.log("No MFA step detected — continuing.");
  }
  
  if (mfaAppeared) {
    let attempts = 0;
    while (true) {
      const mfaCode = authenticator.generate(process.env.WORKFLOWY_TOTP_SECRET);
      console.log(`Attempt ${attempts+1}: trying MFA code ${mfaCode}`);

      // Clear & type the new code
      await page.$eval('input[name="code"]', el => el.value = '');
      const codeStr = String(mfaCode);
      await page.type('input[name="code"]', codeStr, { delay: 100 });
      await page.click("input[type='submit']");

      // Give the UI a moment to either show an error or navigate
      await sleep(1000);

      // Check for the specific error text in any <li>
      const wrong = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('li'))
          .some(el => el.textContent.includes('Wrong code.'));
      });

      if (wrong) {
        console.log("Wrong code detected, retrying...\n");
        attempts++;
        if (attempts >= 5) {
          throw new Error("Too many wrong‐code attempts; aborting.");
        }
        continue;   // back to top of the loop
      }

      // No “Wrong code.” message => assume success
      break;
    }
  }
  
  const cookies = await context.cookies("https://workflowy.com");
  const sessionid = cookies.find(c => c.name === "sessionid")?.value;
  console.log(`Found sessionid: ${sessionid}`);
  await browser.close();
  if (!sessionid) throw new Error("Failed to retrieve sessionid.");
  
  await updateWfConfig(sessionid);
}

function loadConfig() {
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
    } catch {}
  }
  return {};
}

function saveConfig(config) {
  fs.writeFileSync(
    CONFIG_PATH,
    JSON.stringify(config, null, 2),
    { mode: 0o600 }
  );
}

export async function updateWfConfig(sessionid) {
  const config = loadConfig();
  config.sessionid = sessionid;
  saveConfig(config);
  console.log(`Session ID updated successfully in ${CONFIG_PATH}`);
}

// loginWorkFlowy().then(updateWfConfig).catch(err => {
//     console.error("Login failed:", err);
//     process.exit(1);
//   }
// );