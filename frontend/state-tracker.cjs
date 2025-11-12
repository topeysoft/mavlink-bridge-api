#!/usr/bin/env node

/**
 * YardRover State Tracker Utility
 * Manages project development state across multiple AI sessions
 */

const fs = require('fs').promises
const path = require('path')

const STATE_FILE = path.join(__dirname, '.yardrover-state.json')

class StateTracker {
  constructor() {
    this.state = null
  }

  async loadState() {
    try {
      const data = await fs.readFile(STATE_FILE, 'utf-8')
      this.state = JSON.parse(data)
    } catch (error) {
      console.error('Error loading state:', error.message)
      process.exit(1)
    }
  }

  async saveState() {
    try {
      await fs.writeFile(STATE_FILE, JSON.stringify(this.state, null, 2))
      console.log('✅ State saved successfully')
    } catch (error) {
      console.error('Error saving state:', error.message)
      process.exit(1)
    }
  }

  showStatus() {
    console.log('\n🌿 YardRover Frontend Development Status\n')
    console.log(`📅 Last Updated: ${this.state.project.lastUpdated}`)
    console.log(`🚀 Current Stage: ${this.state.development.currentStage}/${this.state.development.totalStages}`)
    console.log(`💻 Node.js Version: ${this.state.project.nodeVersion}`)
    console.log(`📊 Session Count: ${this.state.development.sessionCount}`)

    console.log('\n📋 Stage Progress:')
    Object.entries(this.state.stages).forEach(([, stage]) => {
      const statusIcon = stage.status === 'completed' ? '✅' : 
                        stage.status === 'in-progress' ? '🔄' : '⏳'
      console.log(`  ${statusIcon} ${stage.name} (${stage.completionPercentage}%)`)
    })

    console.log('\n🎯 Next Actions:')
    this.state.nextActions.forEach((action, index) => {
      const priorityIcon = action.priority === 'high' ? '🔥' : 
                          action.priority === 'medium' ? '📋' : '💡'
      console.log(`  ${index + 1}. ${priorityIcon} ${action.action}`)
      console.log(`     ${action.description}`)
      console.log(`     ⏱️  ${action.estimatedTime}`)
    })

    if (this.state.stages.stage1.issues.length > 0) {
      console.log('\n⚠️  Open Issues:')
      this.state.stages.stage1.issues.forEach((issue, index) => {
        console.log(`  ${index + 1}. ${issue.description} (${issue.severity})`)
      })
    }

    console.log('\n📝 Recent Notes:')
    this.state.notes.slice(-3).forEach((note) => {
      console.log(`  • ${note}`)
    })
  }

  updateStage(stageNumber, updates) {
    const stageKey = `stage${stageNumber}`
    if (!this.state.stages[stageKey]) {
      console.error(`Stage ${stageNumber} not found`)
      return
    }

    Object.assign(this.state.stages[stageKey], updates)
    this.state.project.lastUpdated = new Date().toISOString()
    console.log(`✅ Stage ${stageNumber} updated:`, updates)
  }

  addNote(note) {
    this.state.notes.push(`${new Date().toISOString().split('T')[0]}: ${note}`)
    this.state.project.lastUpdated = new Date().toISOString()
    console.log('✅ Note added:', note)
  }

  startNewSession() {
    this.state.development.sessionCount += 1
    this.state.development.lastSession = {
      id: `session-${String(this.state.development.sessionCount).padStart(3, '0')}`,
      date: new Date().toISOString().split('T')[0],
      aiModel: 'claude-3.5-sonnet',
      status: 'active'
    }
    this.state.project.lastUpdated = new Date().toISOString()
    console.log(`✅ New session started: ${this.state.development.lastSession.id}`)
  }

  completeStage(stageNumber) {
    const stageKey = `stage${stageNumber}`
    if (!this.state.stages[stageKey]) {
      console.error(`Stage ${stageNumber} not found`)
      return
    }

    this.state.stages[stageKey].status = 'completed'
    this.state.stages[stageKey].completionPercentage = 100
    this.state.stages[stageKey].completionDate = new Date().toISOString().split('T')[0]
    this.state.development.currentStage = Math.min(stageNumber + 1, this.state.development.totalStages)
    this.state.project.lastUpdated = new Date().toISOString()
    
    console.log(`🎉 Stage ${stageNumber} completed!`)
    
    // Auto-advance to next stage
    const nextStageKey = `stage${stageNumber + 1}`
    if (this.state.stages[nextStageKey] && this.state.stages[nextStageKey].status === 'not-started') {
      this.state.stages[nextStageKey].status = 'in-progress'
      this.state.stages[nextStageKey].completionPercentage = 0
      console.log(`🚀 Advanced to Stage ${stageNumber + 1}`)
    }
  }
}

// CLI Interface
async function main() {
  const tracker = new StateTracker()
  await tracker.loadState()

  const args = process.argv.slice(2)
  const command = args[0]

  switch (command) {
    case 'status':
    case undefined:
      tracker.showStatus()
      break

    case 'update-stage':
      if (args.length < 3) {
        console.error('Usage: node state-tracker.js update-stage <stage-number> <key>=<value>')
        process.exit(1)
      }
      const stageNum = parseInt(args[1])
      const updates = {}
      args.slice(2).forEach(arg => {
        const [key, value] = arg.split('=')
        updates[key] = value === 'true' ? true : value === 'false' ? false : 
                     !isNaN(value) ? parseInt(value) : value
      })
      tracker.updateStage(stageNum, updates)
      await tracker.saveState()
      break

    case 'complete-stage':
      if (args.length < 2) {
        console.error('Usage: node state-tracker.js complete-stage <stage-number>')
        process.exit(1)
      }
      tracker.completeStage(parseInt(args[1]))
      await tracker.saveState()
      break

    case 'add-note':
      if (args.length < 2) {
        console.error('Usage: node state-tracker.js add-note "<note-text>"')
        process.exit(1)
      }
      tracker.addNote(args.slice(1).join(' '))
      await tracker.saveState()
      break

    case 'new-session':
      tracker.startNewSession()
      await tracker.saveState()
      break

    default:
      console.log('YardRover State Tracker')
      console.log('Commands:')
      console.log('  status                     - Show current project status')
      console.log('  update-stage <n> <k>=<v>   - Update stage properties')
      console.log('  complete-stage <n>         - Mark stage as completed')
      console.log('  add-note "<text>"          - Add a note')
      console.log('  new-session                - Start new development session')
  }
}

if (require.main === module) {
  main().catch(console.error)
}

module.exports = StateTracker
