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
    console.log('Launching YOUR Chrome...\n');
    
    // Launch YOUR Chrome (not Playwright's)
    this.browser = await chromium.launch({
      headless: false,
      executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    });

    console.log('✅ Chrome launched!');
    console.log('👉 Please login to X manually in the Chrome window');
    console.log('👉 Then I can post, follow, and interact automatically\n');
    
    this.startCommandLoop();
  }

  async xPost(content) {
    console.log('📝 Posting to X...');
    const page = await this.browser.newPage();
    
    try {
      await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(3000);
      
      // Click compose
      await page.click('[data-testid="SideNav_NewTweet_Button"]').catch(() => {
        // Try alternate selector
        return page.click('a[href="/compose/tweet"]');
      });
      await page.waitForTimeout(2000);
      
      // Type content
      await page.fill('[data-testid="tweetTextarea_0"]', content);
      await page.waitForTimeout(1000);
      
      // Post
      await page.click('[data-testid="tweetButton"]');
      await page.waitForTimeout(3000);
      
      console.log('✅ Posted successfully!\n');
      await page.close();
      return { success: true };
    } catch (error) {
      console.error('❌ Failed:', error.message);
      await page.close();
      return { success: false, error: error.message };
    }
  }

  async xFollow(username) {
    console.log(`➕ Following @${username}...`);
    const page = await this.browser.newPage();
    
    try {
      await page.goto(`https://x.com/${username}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(3000);
      
      const followBtn = await page.$('[data-testid="follow"]');
      if (followBtn) {
        await followBtn.click();
        await page.waitForTimeout(2000);
        console.log(`✅ Followed @${username}\n`);
      } else {
        console.log('ℹ️ Already following or button not found\n');
      }
      
      await page.close();
      return { success: true };
    } catch (error) {
      console.error('❌ Failed:', error.message);
      await page.close();
      return { success: false, error: error.message };
    }
  }

  async startCommandLoop() {
    console.log('🔄 Waiting for commands...\n');
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
