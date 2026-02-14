#!/usr/bin/env node
/**
 * Mac Mini Subagent - Chrome Edition
 * Runs locally on Mac Mini, controls Chrome, automates social media
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  screenshotDir: path.join(__dirname, 'screenshots'),
  dataDir: path.join(__dirname, 'data'),
  checkInterval: 30000, // Check for new commands every 30 seconds
};

// Ensure directories exist
if (!fs.existsSync(CONFIG.screenshotDir)) fs.mkdirSync(CONFIG.screenshotDir, { recursive: true });
if (!fs.existsSync(CONFIG.dataDir)) fs.mkdirSync(CONFIG.dataDir, { recursive: true });

class MacSubagent {
  constructor() {
    this.browser = null;
    this.context = null;
    this.pages = {};
    this.isRunning = false;
  }

  async init() {
    console.log('🚀 Starting Mac Mini Subagent (Chrome Edition)...');
    console.log('Launching Chrome...');
    
    // Launch Chrome (uses Playwright's bundled Chrome)
    this.browser = await chromium.launch({
      headless: false // Visible so you can see what's happening
    });

    // Create persistent context for cookies/sessions
    this.context = await this.browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; Chrome/120.0)  Chrome/120.0'
    });

    console.log('✅ Chrome connected');
    console.log('Subagent ready for commands');
    console.log('Watching commands.json for new tasks...\n');
    
    // Start command loop
    this.startCommandLoop();
  }

  // X (Twitter) Operations
  async xLogin(username, password) {
    console.log(`🔐 Logging into X as ${username}...`);
    const page = await this.context.newPage();
    
    try {
      await page.goto('https://x.com/i/flow/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3000);
      
      // Enter username
      await page.fill('input[autocomplete="username"], input[name="text"]', username);
      await page.click('button:has-text("Next")');
      await page.waitForTimeout(2000);
      
      // Enter password
      await page.fill('input[type="password"]', password);
      await page.click('button:has-text("Log in")');
      
      // Wait for home
      await page.waitForLoadState('networkidle', { timeout: 30000 });
      await page.waitForTimeout(3000);
      
      this.pages.x = page;
      console.log('✅ Logged into X successfully\n');
      return { success: true, url: page.url() };
    } catch (error) {
      console.error('❌ X login failed:', error.message);
      await page.close();
      return { success: false, error: error.message };
    }
  }

  async xPost(content) {
    if (!this.pages.x) {
      console.log('❌ Not logged into X. Please login first.\n');
      return { success: false, error: 'Not logged in' };
    }
    
    console.log('📝 Posting to X:', content.substring(0, 60) + (content.length > 60 ? '...' : ''));
    const page = this.pages.x;
    
    try {
      // Navigate to home
      await page.goto('https://x.com/home', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
      
      // Click compose button
      await page.click('[data-testid="SideNav_NewTweet_Button"]');
      await page.waitForTimeout(1500);
      
      // Type content
      await page.fill('[data-testid="tweetTextarea_0"]', content);
      await page.waitForTimeout(1000);
      
      // Click post
      await page.click('[data-testid="tweetButton"]');
      await page.waitForTimeout(3000);
      
      console.log('✅ Posted to X successfully\n');
      return { success: true };
    } catch (error) {
      console.error('❌ X post failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  async xFollow(username) {
    if (!this.pages.x) {
      console.log('❌ Not logged into X. Please login first.\n');
      return { success: false, error: 'Not logged in' };
    }
    
    console.log(`➕ Following @${username}...`);
    const page = this.pages.x;
    
    try {
      await page.goto(`https://x.com/${username}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(3000);
      
      // Look for follow button
      const followButton = await page.$('[data-testid="follow"], button:has-text("Follow")');
      if (followButton) {
        await followButton.click();
        await page.waitForTimeout(2000);
        console.log(`✅ Followed @${username}\n`);
        return { success: true };
      } else {
        console.log(`ℹ️ Already following @${username} or button not found\n`);
        return { success: false, reason: 'Already following or button not found' };
      }
    } catch (error) {
      console.error('❌ X follow failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  async xComment(tweetUrl, comment) {
    if (!this.pages.x) {
      console.log('❌ Not logged into X. Please login first.\n');
      return { success: false, error: 'Not logged in' };
    }
    
    console.log('💬 Commenting on X:', comment.substring(0, 60) + (comment.length > 60 ? '...' : ''));
    const page = this.pages.x;
    
    try {
      await page.goto(tweetUrl, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(3000);
      
      // Click reply
      await page.click('[data-testid="reply"]');
      await page.waitForTimeout(1500);
      
      // Type comment
      await page.fill('[data-testid="tweetTextarea_0"]', comment);
      await page.waitForTimeout(1000);
      
      // Post reply
      await page.click('[data-testid="tweetButton"]');
      await page.waitForTimeout(3000);
      
      console.log('✅ Commented on X successfully\n');
      return { success: true };
    } catch (error) {
      console.error('❌ X comment failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  async xUpdateProfile(updates) {
    if (!this.pages.x) {
      console.log('❌ Not logged into X. Please login first.\n');
      return { success: false, error: 'Not logged in' };
    }
    
    console.log('✏️ Updating X profile...');
    const page = this.pages.x;
    
    try {
      await page.goto('https://x.com/settings/profile', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(3000);
      
      // Update name
      if (updates.name) {
        await page.fill('input[name="displayName"]', updates.name);
      }
      
      // Update bio
      if (updates.bio) {
        await page.fill('textarea[name="description"]', updates.bio);
      }
      
      // Update location
      if (updates.location) {
        await page.fill('input[name="location"]', updates.location);
      }
      
      // Update website
      if (updates.website) {
        await page.fill('input[name="url"]', updates.website);
      }
      
      // Save changes
      await page.click('button:has-text("Save")');
      await page.waitForTimeout(3000);
      
      console.log('✅ X profile updated successfully\n');
      return { success: true };
    } catch (error) {
      console.error('❌ X profile update failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  async xLikeAndRetweet(tweetUrl) {
    if (!this.pages.x) {
      console.log('❌ Not logged into X. Please login first.\n');
      return { success: false, error: 'Not logged in' };
    }
    
    console.log('❤️🔄 Liking and retweeting:', tweetUrl);
    const page = this.pages.x;
    
    try {
      await page.goto(tweetUrl, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(3000);
      
      // Like
      const likeBtn = await page.$('[data-testid="like"], button:has-text("Like")');
      if (likeBtn) {
        await likeBtn.click();
        await page.waitForTimeout(1000);
      }
      
      // Retweet
      const retweetBtn = await page.$('[data-testid="retweet"], button:has-text("Retweet")');
      if (retweetBtn) {
        await retweetBtn.click();
        await page.waitForTimeout(1000);
        // Confirm retweet
        await page.click('[data-testid="retweetConfirm"]');
        await page.waitForTimeout(1000);
      }
      
      console.log('✅ Liked and retweeted successfully\n');
      return { success: true };
    } catch (error) {
      console.error('❌ Like/retweet failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  // YouTube Operations (Comment/Interact only)
  async youtubeComment(videoUrl, comment) {
    console.log('📺 Commenting on YouTube:', comment.substring(0, 60) + (comment.length > 60 ? '...' : ''));
    
    const page = await this.context.newPage();
    
    try {
      await page.goto(videoUrl, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(5000);
      
      // Scroll to comments
      await page.evaluate(() => window.scrollTo(0, 800));
      await page.waitForTimeout(2000);
      
      // Click comment box
      await page.click('#simplebox-placeholder, #placeholder-area');
      await page.waitForTimeout(2000);
      
      // Type comment
      await page.fill('#contenteditable-root', comment);
      await page.waitForTimeout(1000);
      
      // Post
      await page.click('#submit-button, ytd-button-renderer#submit-button');
      await page.waitForTimeout(3000);
      
      await page.close();
      console.log('✅ Commented on YouTube successfully\n');
      return { success: true };
    } catch (error) {
      console.error('❌ YouTube comment failed:', error.message);
      await page.close();
      return { success: false, error: error.message };
    }
  }

  async youtubeReplyToComment(videoUrl, commentText, reply) {
    console.log('💬 Replying to comment on YouTube...');
    
    const page = await this.context.newPage();
    
    try {
      await page.goto(videoUrl, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(5000);
      
      // Scroll to comments
      await page.evaluate(() => window.scrollTo(0, 800));
      await page.waitForTimeout(2000);
      
      // Find comment and click reply
      const comments = await page.$$('ytd-comment-renderer');
      
      for (const comment of comments) {
        const text = await comment.$eval('#content-text', el => el.textContent).catch(() => '');
        if (text.includes(commentText)) {
          const replyBtn = await comment.$('#reply-button, button:has-text("Reply")');
          if (replyBtn) {
            await replyBtn.click();
            await page.waitForTimeout(2000);
            
            await page.fill('#contenteditable-root', reply);
            await page.waitForTimeout(1000);
            
            await page.click('#submit-button');
            await page.waitForTimeout(3000);
            
            console.log('✅ Replied to comment on YouTube\n');
            await page.close();
            return { success: true };
          }
        }
      }
      
      console.log('⚠️ Could not find comment to reply to\n');
      await page.close();
      return { success: false, reason: 'Comment not found' };
    } catch (error) {
      console.error('❌ YouTube reply failed:', error.message);
      await page.close();
      return { success: false, error: error.message };
    }
  }

  async youtubeGetChannelInfo() {
    console.log('📊 Getting YouTube channel info...');
    
    const page = await this.context.newPage();
    
    try {
      await page.goto('https://www.youtube.com/@Whispersoffaithgod', { 
        waitUntil: 'domcontentloaded',
        timeout: 60000 
      });
      await page.waitForTimeout(5000);
      
      // Take screenshot
      const screenshotPath = path.join(CONFIG.screenshotDir, `youtube-channel-${Date.now()}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      
      // Try to get subscriber count
      let subscribers = 'Unknown';
      try {
        subscribers = await page.$eval('#subscriber-count', el => el.textContent);
      } catch (e) {}
      
      // Try to get video count
      let videoCount = 'Unknown';
      try {
        const tabs = await page.$$eval('yt-tab-shape', tabs => tabs.map(t => t.textContent));
        const videosTab = tabs.find(t => t.includes('video'));
        if (videosTab) {
          const match = videosTab.match(/(\d+)/);
          if (match) videoCount = match[1];
        }
      } catch (e) {}
      
      // Get video titles
      const videoTitles = await page.$$eval('#video-title', 
        titles => titles.slice(0, 10).map(t => t.textContent.trim()).filter(t => t.length > 0)
      );
      
      console.log('Subscribers:', subscribers);
      console.log('Videos:', videoCount);
      console.log('✅ Screenshot saved:', screenshotPath);
      console.log('');
      
      await page.close();
      
      return { 
        success: true, 
        screenshot: screenshotPath,
        subscribers,
        videoCount,
        videoTitles
      };
    } catch (error) {
      console.error('❌ YouTube info failed:', error.message);
      await page.close();
      return { success: false, error: error.message };
    }
  }

  // Screenshot utility
  async takeScreenshot(url, filename) {
    console.log(`📸 Taking screenshot of ${url}...`);
    
    const page = await this.context.newPage();
    
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(5000);
      
      const screenshotPath = path.join(CONFIG.screenshotDir, filename);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      
      await page.close();
      console.log('✅ Screenshot saved:', screenshotPath, '\n');
      return { success: true, path: screenshotPath };
    } catch (error) {
      console.error('❌ Screenshot failed:', error.message);
      await page.close();
      return { success: false, error: error.message };
    }
  }

  // Command loop
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
              await this.executeCommand(cmd);
              updated = true;
              
              // Save after each command
              fs.writeFileSync(commandFile, JSON.stringify(data, null, 2));
            }
          }
        }
      } catch (error) {
        console.error('Command loop error:', error.message);
      }
      
      await new Promise(resolve => setTimeout(resolve, CONFIG.checkInterval));
    }
  }

  async executeCommand(cmd) {
    let result;
    
    try {
      switch (cmd.type) {
        case 'x_login':
          result = await this.xLogin(cmd.username, cmd.password);
          break;
        case 'x_post':
          result = await this.xPost(cmd.content);
          break;
        case 'x_follow':
          result = await this.xFollow(cmd.username);
          break;
        case 'x_comment':
          result = await this.xComment(cmd.url, cmd.comment);
          break;
        case 'x_update_profile':
          result = await this.xUpdateProfile(cmd.updates);
          break;
        case 'x_like_retweet':
          result = await this.xLikeAndRetweet(cmd.url);
          break;
        case 'youtube_comment':
          result = await this.youtubeComment(cmd.videoUrl, cmd.comment);
          break;
        case 'youtube_reply':
          result = await this.youtubeReplyToComment(cmd.videoUrl, cmd.commentText, cmd.reply);
          break;
        case 'youtube_channel_info':
          result = await this.youtubeGetChannelInfo();
          break;
        case 'screenshot':
          result = await this.takeScreenshot(cmd.url, cmd.filename);
          break;
        default:
          result = { success: false, error: 'Unknown command type: ' + cmd.type };
      }
      
      if (result.success) {
        cmd.executed = true;
        cmd.executedAt = new Date().toISOString();
        cmd.result = result;
      } else {
        cmd.failed = true;
        cmd.error = result.error || result.reason;
        cmd.failedAt = new Date().toISOString();
      }
      
    } catch (error) {
      console.error('Command execution error:', error.message);
      cmd.failed = true;
      cmd.error = error.message;
      cmd.failedAt = new Date().toISOString();
    }
  }

  async stop() {
    this.isRunning = false;
    if (this.browser) {
      await this.browser.close();
    }
    console.log('\n👋 Subagent stopped');
  }
}

// Run if called directly
if (require.main === module) {
  const subagent = new MacSubagent();
  
  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n\nShutting down gracefully...');
    await subagent.stop();
    process.exit(0);
  });
  
  subagent.init().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}

module.exports = MacSubagent;
