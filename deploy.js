#!/usr/bin/env node

/**
 * Simple Deployment Orchestrator
 * Based on DEPLOYMENT_AGENTS.md architecture
 */

const { execSync } = require('child_process');
const fs = require('fs');

class DeploymentOrchestrator {
  constructor() {
    this.agents = {
      git: new GitAgent(),
      build: new BuildAgent(), 
      vercel: new VercelAgent()
    };
  }

  async deploy(options = {}) {
    console.log('🚀 Starting deployment orchestration...\n');
    
    try {
      // 1. Check and fix build issues
      await this.agents.build.check();
      
      // 2. Git operations
      if (options.commit) {
        await this.agents.git.commitAndPush(options.message);
      }
      
      // 3. Deploy to Vercel
      const url = await this.agents.vercel.deploy();
      
      console.log(`\n✅ Deployment successful!`);
      console.log(`🌐 Live at: ${url}`);
      
    } catch (error) {
      console.error(`\n❌ Deployment failed: ${error.message}`);
      process.exit(1);
    }
  }
}

class GitAgent {
  async commitAndPush(message = 'Auto deployment update') {
    console.log('📝 Git Agent: Committing changes...');
    
    try {
      execSync('git add .', { stdio: 'pipe' });
      execSync(`git commit -m "${message}

🤖 Generated with [Claude Code](https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"`, { stdio: 'pipe' });
      execSync('git push origin main', { stdio: 'inherit' });
      console.log('✅ Git operations completed');
    } catch (error) {
      if (error.message.includes('nothing to commit')) {
        console.log('ℹ️  No changes to commit');
      } else {
        throw error;
      }
    }
  }
}

class BuildAgent {
  async check() {
    console.log('🔧 Build Agent: Checking for issues...');
    
    try {
      // Check if build passes
      execSync('npm run build', { stdio: 'pipe' });
      console.log('✅ Build check passed');
    } catch (error) {
      console.log('⚠️  Build issues detected, attempting fixes...');
      // Could add automatic fixes here
      throw new Error('Build failed - manual intervention required');
    }
  }
}

class VercelAgent {
  async deploy() {
    console.log('🌐 Vercel Agent: Deploying to production...');
    
    try {
      const output = execSync('npx vercel --prod --yes', { 
        encoding: 'utf8',
        stdio: 'pipe' 
      });
      
      // Extract URL from output
      const urlMatch = output.match(/https:\/\/[^\s]+\.vercel\.app/);
      const url = urlMatch ? urlMatch[0] : 'Deployment completed';
      
      console.log('✅ Vercel deployment completed');
      return url;
    } catch (error) {
      throw new Error(`Vercel deployment failed: ${error.message}`);
    }
  }
}

// CLI Interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const orchestrator = new DeploymentOrchestrator();
  
  const options = {
    commit: args.includes('--commit'),
    message: args.includes('--message') ? args[args.indexOf('--message') + 1] : undefined
  };
  
  orchestrator.deploy(options);
}

module.exports = { DeploymentOrchestrator };