import { simpleParser } from "mailparser";
import { authenticator } from "otplib";
import { ImapFlow } from "imapflow";
import puppeteer from "puppeteer";
import readline from "readline";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const login_url = "https://workflowy.com/login/";
const CONFIG_PATH = "./.wfconfig.json";

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
  console.log("Waiting 10 seconds before checking email...");
  await sleep(10000);
  
  const ONE_MINUTE = 60 * 1000;
  const searchStartTime = Date.now();

  console.log("Starting email search...");

  try {
    await client.connect();
    await client.mailboxOpen("INBOX");

    // Get the last 10 emails only (most recent first)
    const mailbox = await client.mailboxOpen("INBOX");
    const totalMessages = mailbox.exists;
    const startSeq = Math.max(1, totalMessages - 9); // Get last 10 messages

    for await (let msg of client.fetch(`${startSeq}:*`, { envelope: true, source: true, internalDate: true })) {
      const receivedTime = new Date(msg.internalDate).getTime();

      // Only check emails received within the last 1 minute from when we started searching
      if (searchStartTime - receivedTime > ONE_MINUTE) {
        continue; // Skip messages older than 1 minute
      }
      
      const parsed = simpleParser(msg.source);
      
      if (parsed.subject?.includes("Login code for Workflowy") && parsed.text) {
        const match = parsed.text.match(/\b\d{4}-\d{4}-\d{4}\b/);
        if (match) {
          console.log("Code found:", match[0]);
          return match[0];
        }
      }
    }

    throw new Error("Code not found in emails from the last 1 minute.");
    
  } catch (error) {
    console.error("Email search error:", error);
    throw error;
  } finally {
    // Always try to close the connection
    try {
      console.log("Closing email connection...");
      
      // Force close instead of logout (more reliable)
      client.close();
      
    } catch (closeError) {
      console.warn("Warning: Could not properly close email connection:", closeError.message);
      // Force terminate if close fails
      try {
        client.destroy();
      } catch (destroyError) {
        console.warn("Could not destroy connection:", destroyError.message);
      }
    }
  }
}

async function loginWorkFlowy() {
  const email = process.env.CLIENT_EMAIL;
  
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const context = browser.defaultBrowserContext();
  const page = await context.newPage();

  await page.goto(login_url, { waitUntil: "networkidle2" });

  await page.type('input[name="email"]', email);
  await page.click("button[type='submit']");
  await page.waitForSelector("input[name='code']", { visible: true });

  console.log("Login code request sent!");

  const code = await fetchLoginCode();

  await page.type('input[name="code"]', code);
  await page.click("button[type='submit']");

  try {
    await page.waitForSelector("input[name='code']", { visible: true, timeout: 5000 });

    const mfaCode = authenticator.generate(process.env.WORKFLOWY_TOTP_SECRET);
    console.log("Auto-generated MFA code:", mfaCode);

    await page.type('input[name="code"]', mfaCode);
    await page.click("input[type='submit']");
  } catch (_) {
    // No 2FA needed
  }
  
  await page.waitForNavigation({ waitUntil: "networkidle2" });
  const cookies = await context.cookies("https://workflowy.com");
  const sessionid = cookies.find((c) => c.name === "sessionid")?.value;

  await browser.close();
  rl.close();

  if (!sessionid) {
    throw new Error("Failed to get sessionid. Login might have failed.");
  }

  return sessionid;
}

async function updateWfConfig(sessionid) {
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

loginWorkFlowy()
  .then(updateWfConfig)
  .catch(err => {
    console.error("Login failed:", err);
    process.exit(1);
  });