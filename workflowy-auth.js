import puppeteer from "puppeteer";
import fs from "fs";
import readline from "readline";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const login_url = "https://workflowy.com/login/";
const CONFIG_PATH = "./.wfconfig.json";

async function loginWorkflowy(email) {
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

  const code = await new Promise((resolve) => {
    rl.question("Enter the code sent to your email: ", (inputCode) => {
      resolve(inputCode);
    });
  });

  await page.type('input[name="code"]', code);
  await page.click("button[type='submit']");

  // Wait for optional 2FA prompt
  try {
    await page.waitForSelector("input[name='code']", { visible: true, timeout: 5000 });

    const mfaCode = await new Promise((resolve) => {
      rl.question("Enter the 2FA code: ", (inputCode) => {
        resolve(inputCode);
      });
    });

    await page.type('input[name="code"]', mfaCode);
    await page.click("button[type='submit']");
    await page.waitForNavigation({ waitUntil: "networkidle2" });
  } catch (_) {
    // No 2FA needed
  }

  const cookies = await context.cookies("https://workflowy.com"); // <- updated
  const sessionid = cookies.find((c) => c.name === "sessionid")?.value;

  await browser.close();
  rl.close();

  if (!sessionid) {
    throw new Error("Failed to get sessionid. Login might have failed.");
  }

  return sessionid;
}

async function updateWfConfig(sessionid) {
  let config = { aliases: {} };

  try {
    if (fs.existsSync(CONFIG_PATH)) {
      config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
    }
  } catch (err) {
    console.error("Error reading existing config:", err);
  }

  config.sessionid = sessionid;
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  console.log(`✅ Session ID updated successfully in ${CONFIG_PATH}`);
}

const [,, email] = process.argv;
if (!email) {
  console.error("Usage: node workflowy-auth.js <email>");
  process.exit(1);
}

loginWorkflowy(email)
  .then(updateWfConfig)
  .catch(err => {
    console.error("❌ Login failed:", err);
    process.exit(1);
  });