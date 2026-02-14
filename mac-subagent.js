const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const CONFIG = {
  screenshotDir: path.join(__dirname, 'screenshots'),
  dataDir: path.join(__dirname, 'data'),
  checkInterval: 30000,
};

if (!fs.existsSync(CONFIG.screenshotDir)) fs.mkdirSync(CONFIG.screenshotDir, { recursive: true });
if (!fs.existsSync(CONFIG.dataDir)) fs.mkdirSync(CONFIG.dataDir, { recursive: true });

class MacSubagent {
  constructor() {
    this.browser = null;
    this.isRunning = false;
  }

  async init() {
    console.log('🚀 Starting Mac Mini Subagent...');
    console.log('Connecting to YOUR Chrome...\n');
    
    // IMPORTANT: First, manually launch Chrome with debugging port
    console.log('👉 Step 1: Open Terminal and run:');
    console.log('/Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=9222');
    console.log('');
    console.log('👉 Step 2: Login to X in that Chrome window');
    console.log('👉 Step 3: Then press Enter here to continue...\n');
    
    // Wait for user to press Enter
    process.stdin.once('data', async () => {
      await this.connectToChrome();
    });
  }

  async connectToChrome() {
    try {
      // Connect to your running Chrome
      this.browser = await chromium.connectOverCDP('http://localhost:9222');
      console.log('✅ Connected to YOUR Chrome!');
      console.log('✅ Using your logged-in sessions\n');
      
      this.startCommandLoop();
    } catch (error) {
      console.error('❌ Could not connect. Make sure Chrome is running with --remote-debugging-port=9222');
      console.error('Error:', error.message);
      process.exit(1);
    }
  }

  async xPost(content) {
    console.log('📝 Posting to X...');
    
    // Use existing context from your Chrome
    const context = this.browser.contexts()[0];
    const page = await context.newPage();
    
    try {
      await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(3000);
      
      await page.click('[data-testid="SideNav_NewTweet_Button"]').catch(() => {
        return page.click('a[href="/compose/tweet"]');
      });
      await page.waitForTimeout(2000);
      
      await page.fill('[data-testid="tweetTextarea_0"]', content);
      await page.waitForTimeout(1000);
      
      await page.click('[data-testid="tweetButton"]');
      await page.waitForTimeout(3000);
      
      console.log('✅ Posted!\n');
      await page.close();
      return { success: true };
    } catch (error) {
      console.error('❌ Failed:', error.message);
      await page.close();
      return { success: false, error: error.message };
    }
  }

  async startCommandLoop() {
    console.log('🔄 Starting command loop...\n');
    this.isRunning = true;
    
    const commandFile = path.join(CONFIG.dataDir, 'commands.json');
    
    while (this.isRunning) {
      try {
        if (fs.existsSync(commandFile)) {
          const data = JSON.parse(fs.readFileSync(commandFile, 'utf8'));
          const commands = data.commands || [];
          let updated = false;
          
          for (const cmd of commands) {
            if (!cmd.executed && !cmd.failed) {
              console.log(`📥 Executing: ${cmd.type}`);
              
              let result;
              if (cmd.type === 'x_post') {
                result = await this.xPost(cmd.content);
              } else if (cmd.type === 'x_follow') {
                result = await this.xFollow(cmd.username);
              } else {
                result = { success: false, error: 'Unknown command' };
              }
              
              if (result.success) {
                cmd.executed = true;
                cmd.executedAt = new Date().toISOString();
              } else {
                cmd.failed = true;
                cmd.error = result.error;
                cmd.failedAt = new Date().toISOString();
              }
              
              updated = true;
            }
          }
          
          if (updated) {
            fs.writeFileSync(commandFile, JSON.stringify(data, null, 2));
          }
        }
      } catch (error) {
        console.error('Error:', error.message);
      }
      
      await new Promise(resolve => setTimeout(resolve, CONFIG.checkInterval));
    }
  }

  async stop() {
    this.isRunning = false;
    if (this.browser) await this.browser.close();
    console.log('\n👋 Stopped');
  }
}

if (require.main === module) {
  const subagent = new MacSubagent();
  process.on('SIGINT', async () => {
    await subagent.stop();
    process.exit(0);
  });
  subagent.init().catch(console.error);
}
