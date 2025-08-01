import { authenticate } from "@google-cloud/local-auth";
import { authenticator } from "otplib";
import { join, dirname } from "path";
import { fileURLToPath } from 'url';
import { google } from "googleapis"; 
import puppeteer from "puppeteer";
import process  from "process";
import dotenv from "dotenv";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env'), quiet: true });
const CONFIG_PATH = join(__dirname, ".wfconfig.json");

const login_url = "https://workflowy.com/login/";
const auth_success_page = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0"/><title>Authorization Successful</title><style>body {margin: 0;padding: 0;background: #f0f4f8;font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;color: #333;display: flex;align-items: center;justify-content: center;height: 100vh;}.card {background: #fff;padding: 2rem 3rem;border-radius: 8px;box-shadow: 0 4px 12px rgba(0,0,0,0.1);text-align: center;max-width: 400px;}.card h1 {margin: 0 0 1rem;font-size: 1.75rem;color: #2e7d32;}.card p {margin: 0;font-size: 1rem;line-height: 1.5;}.emoji {font-size: 2.5rem;margin-bottom: 0.5rem;}</style></head><body><div class="card"><h1>Authorization Successful</h1><p>You may now close this tab and return to the application.</p></div></body></html>`;

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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

async function getGoogleCredentials() {
  const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];
  let client;
  
  const CREDENTIALS_PATH = join(__dirname, 'google_credentials.json');
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    throw new Error(`Google credentials file not found at ${CREDENTIALS_PATH}. Please ensure it exists.`);
  }

  try {
    const content = loadConfig().google_creds;
    const credentials = JSON.parse(content);
    client = google.auth.fromJSON(credentials);
  } catch (err) {
    client = await authenticate({
      scopes: SCOPES,
      keyfilePath: CREDENTIALS_PATH,
    });
    
    if (client.credentials) {
      const creds = fs.readFileSync(CREDENTIALS_PATH, 'utf8');
      const keys = JSON.parse(creds);
      const key = keys.installed || keys.web;
      const payload = JSON.stringify({
        type: 'authorized_user',
        client_id: key.client_id,
        client_secret: key.client_secret,
        refresh_token: client.credentials.refresh_token,
      });
      
      const config = loadConfig();
      config.google_creds = payload;
      saveConfig(config);
      console.log(`Google credentials saved to ${CONFIG_PATH}`);
    }
  }

  return client;
}

async function fetchLoginCode(auth) {
  const gmail = google.gmail({version: 'v1', auth});

  try {
    const query = 'from:help@email.workflowy.com subject:"Login code for Workflowy"';
    const listRes = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: 1,
    });
    
    const messages = listRes.data.messages;
    if (!messages || messages.length === 0) {
      throw new Error('No Workflowy login email found.');
    }

    console.log(`Found ${messages.length} message(s)`);

    const msgRes = await gmail.users.messages.get({
      userId: 'me',
      id: messages[0].id,
      format: 'full',
    });
    
    const msg = msgRes.data;
    console.log(`Retrieved email with subject: ${msg.payload.headers.find(h => h.name === 'Subject')?.value}`);

    let bodyText = '';
    
    function extractTextFromParts(parts) {
      if (!parts) return '';
      
      for (const part of parts) {
        if (part.mimeType === 'text/plain' && part.body && part.body.data) {
          return Buffer.from(part.body.data, 'base64').toString('utf8');
        } else if (part.mimeType === 'text/html' && part.body && part.body.data && !bodyText) {
          return Buffer.from(part.body.data, 'base64').toString('utf8');
        } else if (part.parts) {
          const nestedText = extractTextFromParts(part.parts);
          if (nestedText) return nestedText;
        }
      }
      return '';
    }

    if (msg.payload.parts) {
      bodyText = extractTextFromParts(msg.payload.parts);
    }
    
    if (!bodyText && msg.payload.body && msg.payload.body.data) {
      bodyText = Buffer.from(msg.payload.body.data, 'base64').toString('utf8');
    }
    
    if (!bodyText && msg.snippet) {
      bodyText = msg.snippet;
    }

    if (!bodyText) {
      throw new Error('Could not read message body.');
    }

    console.log('Email body extracted successfully');

    const match = bodyText.match(/\b(\d{4}-\d{4}-\d{4})\b/);
    if (!match) {
      throw new Error('Login code not found in email body. Body preview: ' + bodyText.substring(0, 200));
    }

    console.log(`Found login code: ${match[1]}`);
    return match[1];
    
  } catch (error) {
    console.error('Error fetching login code:', error.message);
    throw error;
  }
}

export async function loginWorkFlowy() {
  const googleAuth = await getGoogleCredentials();
  const email = process.env.CLIENT_EMAIL;
  
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
  await sleep(5000);
  const loginCode = await fetchLoginCode(googleAuth);
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

      await page.$eval('input[name="code"]', el => el.value = '');
      const codeStr = String(mfaCode);
      await page.type('input[name="code"]', codeStr, { delay: 100 });
      await page.click("input[type='submit']");

      await sleep(1000);

      const wrong = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('li'))
          .some(el => el.textContent.includes('Wrong code.'));
      });

      if (wrong) {
        console.log("Wrong code detected, retrying...\n");
        attempts++;
        if (attempts >= 5) {
          throw new Error("Too many wrong-code attempts; aborting.");
        }
        continue;
      }
      break;
    }
  }
  
  const cookies = await context.cookies("https://workflowy.com");
  const sessionid = cookies.find(c => c.name === "sessionid")?.value;
  console.log(`Found sessionid: ${sessionid}`);
  await browser.close();
  if (!sessionid) throw new Error("Failed to retrieve sessionid.");
  
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