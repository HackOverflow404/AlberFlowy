import { authenticator } from "otplib";
import { ImapFlow } from "imapflow";
import puppeteer from "puppeteer";
import dotenv from "dotenv";
import fs from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Get the directory where this script is located
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configure dotenv to look for .env in the script's directory
dotenv.config({ path: join(__dirname, '.env'), quiet: true });

const login_url = "https://workflowy.com/login/";
// Use absolute path for config file
const CONFIG_PATH = join(__dirname, ".wfconfig.json");

const client = new ImapFlow({
  host: "imap.gmail.com",
  port: 993,
  secure: true,
  auth: {
    user: process.env.CLIENT_EMAIL,
    pass: process.env.GMAIL_APP_PASSWORD
  },
  logger: {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {}
  },
});

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchLoginCode() {
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
  const loginCode = await fetchLoginCode();
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
    const mfaCode = authenticator.generate(process.env.WORKFLOWY_TOTP_SECRET);
    console.log("MFA code generated:", mfaCode);
    await sleep(1000);
    await page.focus('input[name="code"]');
    await page.$eval('input[name="code"]', el => el.value = '');
    await page.type('input[name="code"]', mfaCode, { delay: 100 });
    await Promise.all([
      page.click("input[type='submit']"),
      page.waitForFunction(
        () => location.origin === "https://workflowy.com" && location.pathname === "/",
        { timeout: 15_000 }
      )
    ]);
  }
  
  const cookies = await context.cookies("https://workflowy.com");
  const sessionid = cookies.find(c => c.name === "sessionid")?.value;
  console.log(`Found sessionid: ${sessionid}`);
  await browser.close();
  if (!sessionid) throw new Error("Failed to retrieve sessionid.");
  return sessionid;
}

export async function updateWfConfig(sessionid) {
  let config = {};
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
    }
  } catch (err) {
    console.error("Error reading existing config:", err);
  }
  config.sessionid = sessionid;
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  console.log(`Session ID updated successfully in ${CONFIG_PATH}`);
}

// loginWorkFlowy().then(updateWfConfig).catch(err => {
//     console.error("Login failed:", err);
//     process.exit(1);
//   }
// );