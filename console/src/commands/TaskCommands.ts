import chalk from 'chalk';
import ora from 'ora';
import { ConsoleContext } from '../types/index.js';
import { ClientManager } from '../utils/ClientManager.js';
import { UIHelpers } from '../core/UIHelpers.js';

export class TaskCommands {
  constructor(
    private context: ConsoleContext,
    private clientManager: ClientManager,
    private uiHelpers: UIHelpers
  ) {}

  public async listTasks(): Promise<void> {
    console.log(chalk.blue.bold('\n📋 Task List'));
    this.uiHelpers.displaySeparator();
    
    const client = this.clientManager.getClient();
    if (!client) {
      this.uiHelpers.displayError('Not connected to any device');
      await this.uiHelpers.pressAnyKey();
      return;
    }
    
    const spinner = ora('Loading tasks...').start();
    
    try {
      const taskList = await client.tasks.listTasks();
      spinner.succeed(`Found ${taskList.tasks.length} task(s)`);
      
      if (taskList.tasks.length === 0) {
        console.log(chalk.yellow('\n⚠️  No tasks found'));
        console.log(chalk.gray('Create a new task to get started'));
        await this.uiHelpers.pressAnyKey();
        return;
      }
      
      console.log(chalk.green(`\n📚 Tasks (${taskList.tasks.length}):`);
      const table = this.uiHelpers.createTable(['ID', 'Name', 'Type', 'Status', 'Priority', 'Created']);
      
      taskList.tasks.forEach(task => {
        const typeIcon = this.getTaskTypeIcon(task.type);
        const statusIcon = this.getTaskStatusIcon(task.status);
        const priorityIcon = this.getTaskPriorityIcon(task.priority);
        
        table.push([
          task.id.substring(0, 8) + '...',
          task.name,
          `${typeIcon} ${task.type}`,
          `${statusIcon} ${task.status}`,
          `${priorityIcon} ${task.priority}`,
          new Date(task.createdAt).toLocaleDateString()
        ]);
      });
      
      console.log(table.toString());
      
      const action = await this.uiHelpers.selectFromList(
        'What would you like to do?',
        [
          { name: '🔍 View task details', value: 'details' },
          { name: '▶️ Execute a task', value: 'execute' },
          { name: '📋 Filter tasks', value: 'filter' },
          { name: '🔙 Back', value: 'back' }
        ]
      );
      
      switch (action) {
        case 'details':
          await this.viewTaskDetails(client, taskList.tasks);
          break;
        case 'execute':
          await this.selectAndExecuteTask(client, taskList.tasks);
          break;
        case 'filter':
          await this.filterAndListTasks(client);
          break;
        case 'back':
          return;
      }
      
    } catch (error) {
      spinner.fail('Failed to load tasks');
      this.uiHelpers.displayError('Could not retrieve task list', error);
    }
    
    await this.uiHelpers.pressAnyKey();
  }

  public async createTask(): Promise<void> {
    console.log(chalk.blue.bold('\n📝 Create New Task'));
    this.uiHelpers.displaySeparator();
    
    const client = this.clientManager.getClient();
    if (!client) {
      this.uiHelpers.displayError('Not connected to any device');
      await this.uiHelpers.pressAnyKey();
      return;
    }
    
    const taskType = await this.uiHelpers.selectFromList(
      'Select task type:',
      [
        { name: '🚁 Mowing Task', value: 'mowing' },
        { name: '📍 Survey Task', value: 'survey' },
        { name: '🛣️ Waypoint Mission', value: 'waypoint' },
        { name: '🔍 Perimeter Inspection', value: 'perimeter' },
        { name: '🏠 Return to Home', value: 'rth' },
        { name: '🔙 Back', value: 'back' }
      ]
    );
    
    if (taskType === 'back') return;
    
    try {
      switch (taskType) {
        case 'mowing':
          await this.createMowingTask(client);
          break;
        case 'survey':
          await this.createSurveyTask(client);
          break;
        case 'waypoint':
          await this.createWaypointTask(client);
          break;
        case 'perimeter':
          await this.createPerimeterTask(client);
          break;
        case 'rth':
          await this.createReturnToHomeTask(client);
          break;
      }
    } catch (error) {
      this.uiHelpers.displayError('Failed to create task', error);
    }
    
    await this.uiHelpers.pressAnyKey();
  }

  public async executeTask(): Promise<void> {
    console.log(chalk.blue.bold('\n🚀 Execute Task'));
    this.uiHelpers.displaySeparator();
    
    const client = this.clientManager.getClient();
    if (!client) {
      this.uiHelpers.displayError('Not connected to any device');
      await this.uiHelpers.pressAnyKey();
      return;
    }
    
    const spinner = ora('Loading available tasks...').start();
    
    try {
      const taskList = await client.tasks.listTasks({ status: 'created' });
      
      if (taskList.tasks.length === 0) {
        spinner.warn('No tasks available for execution');
        console.log(chalk.yellow('\n⚠️  No tasks ready for execution'));
        console.log(chalk.gray('Create a task first, then return here to execute it'));
        await this.uiHelpers.pressAnyKey();
        return;
      }
      
      spinner.succeed(`Found ${taskList.tasks.length} executable task(s)`);
      
      await this.selectAndExecuteTask(client, taskList.tasks);
      
    } catch (error) {
      spinner.fail('Failed to load tasks');
      this.uiHelpers.displayError('Could not load executable tasks', error);
    }
    
    await this.uiHelpers.pressAnyKey();
  }

  public async showTaskStatus(): Promise<void> {
    console.log(chalk.blue.bold('\n📊 Task Status'));
    this.uiHelpers.displaySeparator();
    
    const client = this.clientManager.getClient();
    if (!client) {
      this.uiHelpers.displayError('Not connected to any device');
      await this.uiHelpers.pressAnyKey();
      return;
    }
    
    const spinner = ora('Checking task status...').start();
    
    try {
      // Get running and paused tasks
      const runningTasks = await client.tasks.listTasks({ status: 'executing' });
      const pausedTasks = await client.tasks.listTasks({ status: 'paused' });
      
      spinner.succeed('Task status retrieved');
      
      const activeTasks = [...runningTasks.tasks, ...pausedTasks.tasks];
      
      if (activeTasks.length === 0) {
        console.log(chalk.yellow('\n⚠️  No active tasks'));
        console.log(chalk.gray('All tasks are either completed or not started'));
        await this.uiHelpers.pressAnyKey();
        return;
      }
      
      console.log(chalk.green(`\n🏃 Active Tasks (${activeTasks.length}):`);
      
      for (const task of activeTasks) {
        try {
          const status = await client.tasks.getTaskExecutionStatus(task.id);
          
          console.log(chalk.blue(`\n📍 ${task.name} (${task.id.substring(0, 8)}...):`));
          this.uiHelpers.displayKeyValuePairs({
            'Status': status.status,
            'Progress': `${Math.round(status.progress || 0)}%`,
            'Current Waypoint': `${status.currentWaypoint || 0} of ${status.totalWaypoints || 0}`,
            'Elapsed Time': this.uiHelpers.formatDuration(status.elapsedTime || 0),
            'Estimated Remaining': status.estimatedTimeRemaining ?
              this.uiHelpers.formatDuration(status.estimatedTimeRemaining) : 'Unknown'
          });
          
          if (status.errors && status.errors.length > 0) {
            console.log(chalk.red('\n⚠️  Errors:'));
            status.errors.forEach(error => {
              console.log(chalk.red(`  • ${error}`));
            });
          }
          
        } catch (error) {
          this.uiHelpers.displayError(`Failed to get status for task ${task.name}`, error);
        }
      }
      
      const action = await this.uiHelpers.selectFromList(
        'Task control options:',
        [
          { name: '⏸️  Pause active task', value: 'pause' },
          { name: '▶️  Resume paused task', value: 'resume' },
          { name: '🛑 Cancel active task', value: 'cancel' },
          { name: '🔄 Refresh status', value: 'refresh' },
          { name: '🔙 Back', value: 'back' }
        ]
      );
      
      switch (action) {
        case 'pause':
          await this.pauseActiveTask(client, activeTasks.filter(t => t.status === 'executing'));
          break;
        case 'resume':
          await this.resumePausedTask(client, activeTasks.filter(t => t.status === 'paused'));
          break;
        case 'cancel':
          await this.cancelActiveTask(client, activeTasks);
          break;
        case 'refresh':
          await this.showTaskStatus(); // Recursive call to refresh
          return;
        case 'back':
          return;
      }
      
    } catch (error) {
      spinner.fail('Failed to get task status');
      this.uiHelpers.displayError('Could not retrieve task status', error);
    }
    
    await this.uiHelpers.pressAnyKey();
  }

  public async manageTemplates(): Promise<void> {
    console.log(chalk.blue.bold('\n📋 Task Templates'));
    this.uiHelpers.displaySeparator();
    
    const client = this.clientManager.getClient();
    if (!client) {
      this.uiHelpers.displayError('Not connected to any device');
      await this.uiHelpers.pressAnyKey();
      return;
    }
    
    const spinner = ora('Loading templates...').start();
    
    try {
      const templates = await client.tasks.getTaskTemplates();
      spinner.succeed(`Found ${templates.templates.length} template(s)`);
      
      if (templates.templates.length === 0) {
        console.log(chalk.yellow('\n⚠️  No templates found'));
        console.log(chalk.gray('Templates will be created when you save task configurations'));
        await this.uiHelpers.pressAnyKey();
        return;
      }
      
      console.log(chalk.green(`\n📋 Templates (${templates.templates.length}):`);
      const table = this.uiHelpers.createTable(['Name', 'Type', 'Description', 'Created']);
      
      templates.templates.forEach(template => {
        table.push([
          template.name,
          template.type,
          template.description?.substring(0, 50) + (template.description && template.description.length > 50 ? '...' : '') || 'No description',
          new Date(template.createdAt).toLocaleDateString()
        ]);
      });
      
      console.log(table.toString());
      
      const action = await this.uiHelpers.selectFromList(
        'Template management:',
        [
          { name: '📝 Create task from template', value: 'create' },
          { name: '🔍 View template details', value: 'details' },
          { name: '💾 Export templates', value: 'export' },
          { name: '🔙 Back', value: 'back' }
        ]
      );
      
      switch (action) {
        case 'create':
          await this.createTaskFromTemplate(client, templates.templates);
          break;
        case 'details':
          await this.viewTemplateDetails(templates.templates);
          break;
        case 'export':
          await this.exportTemplates(templates.templates);
          break;
        case 'back':
          return;
      }
      
    } catch (error) {
      spinner.fail('Failed to load templates');
      this.uiHelpers.displayError('Could not retrieve templates', error);
    }
    
    await this.uiHelpers.pressAnyKey();
  }

  public async viewHistory(): Promise<void> {
    console.log(chalk.blue.bold('\n📚 Task History'));
    this.uiHelpers.displaySeparator();
    
    const client = this.clientManager.getClient();
    if (!client) {
      this.uiHelpers.displayError('Not connected to any device');
      await this.uiHelpers.pressAnyKey();
      return;
    }
    
    const spinner = ora('Loading task history...').start();
    
    try {
      // Get completed and failed tasks
      const completedTasks = await client.tasks.listTasks({ status: 'completed' });
      const failedTasks = await client.tasks.listTasks({ status: 'failed' });
      
      const historyTasks = [...completedTasks.tasks, ...failedTasks.tasks]
        .sort((a, b) => new Date(b.completedAt || b.updatedAt).getTime() - new Date(a.completedAt || a.updatedAt).getTime());
      
      spinner.succeed(`Found ${historyTasks.length} completed task(s)`);
      
      if (historyTasks.length === 0) {
        console.log(chalk.yellow('\n⚠️  No task history found'));
        console.log(chalk.gray('Execute some tasks to see their history here'));
        await this.uiHelpers.pressAnyKey();
        return;
      }
      
      console.log(chalk.green(`\n📊 Task History (${historyTasks.length}):`);
      const table = this.uiHelpers.createTable(['Date', 'Task', 'Type', 'Duration', 'Result', 'Progress']);
      
      historyTasks.forEach(task => {
        const completedDate = task.completedAt ? new Date(task.completedAt).toLocaleDateString() :
          new Date(task.updatedAt).toLocaleDateString();
        const duration = this.calculateTaskDuration(task);
        const resultIcon = task.status === 'completed' ? '✅' : '❌';
        const progressText = task.status === 'completed' ? '100%' : 'Incomplete';
        
        table.push([
          completedDate,
          task.name,
          task.type,
          duration,
          `${resultIcon} ${task.status}`,
          progressText
        ]);
      });
      
      console.log(table.toString());
      
      const action = await this.uiHelpers.selectFromList(
        'History options:',
        [
          { name: '🔍 View task details', value: 'details' },
          { name: '💾 Export history', value: 'export' },
          { name: '📋 Show statistics', value: 'stats' },
          { name: '🔙 Back', value: 'back' }
        ]
      );
      
      switch (action) {
        case 'details':
          await this.viewTaskDetails(client, historyTasks);
          break;
        case 'export':
          await this.exportTaskHistory(historyTasks);
          break;
        case 'stats':
          await this.showTaskStatistics(historyTasks);
          break;
        case 'back':
          return;
      }
      
    } catch (error) {
      spinner.fail('Failed to load task history');
      this.uiHelpers.displayError('Could not retrieve task history', error);
    }
    
    await this.uiHelpers.pressAnyKey();
  }

  private getTaskTypeIcon(type: string): string {
    switch (type.toLowerCase()) {
      case 'mowing': return '🚁';
      case 'survey':
      case 'surveying': return '📍';
      case 'waypoint':
      case 'waypoint_mission': return '🛣️';
      case 'perimeter': return '🔲';
      case 'return_home':
      case 'rth': return '🏠';
      default: return '📋';
    }
  }

  private getTaskStatusIcon(status: string): string {
    switch (status.toLowerCase()) {
      case 'created': return '📝';
      case 'executing': return '▶️';
      case 'paused': return '⏸️';
      case 'completed': return '✅';
      case 'failed': return '❌';
      case 'cancelled': return '🛑';
      default: return '❓';
    }
  }

  private getTaskPriorityIcon(priority: string): string {
    switch (priority.toLowerCase()) {
      case 'high': return '🔴';
      case 'medium':
      case 'normal': return '🟡';
      case 'low': return '🟢';
      default: return '⚪';
    }
  }

  private async viewTaskDetails(client: any, tasks: any[]): Promise<void> {
    const taskChoices = tasks.map((task, index) => ({
      name: `${task.name} (${task.type})`,
      value: index
    }));
    
    taskChoices.push({ name: '🔙 Back', value: -1 });
    
    const selectedIndex = await this.uiHelpers.selectFromList(
      'Select task to view details:',
      taskChoices
    );
    
    if (selectedIndex === -1) return;
    
    const task = tasks[selectedIndex];
    
    console.log(chalk.blue.bold(`\n📋 Task Details: ${task.name}`));
    this.uiHelpers.displaySeparator();
    
    this.uiHelpers.displayKeyValuePairs({
      'ID': task.id,
      'Type': task.type,
      'Status': task.status,
      'Priority': task.priority,
      'Created': new Date(task.createdAt).toLocaleString(),
      'Updated': new Date(task.updatedAt).toLocaleString(),
      'Description': task.description || 'No description'
    });
    
    if (task.waypoints && task.waypoints.length > 0) {
      console.log(chalk.blue(`\n📍 Waypoints (${task.waypoints.length}):`));
      const waypointTable = this.uiHelpers.createTable(['#', 'Latitude', 'Longitude', 'Altitude', 'Command']);
      
      task.waypoints.slice(0, 10).forEach((wp: any, index: number) => {
        waypointTable.push([
          (index + 1).toString(),
          wp.latitude.toFixed(6),
          wp.longitude.toFixed(6),
          `${wp.altitude}m`,
          wp.command?.toString() || 'Nav'
        ]);
      });
      
      console.log(waypointTable.toString());
      
      if (task.waypoints.length > 10) {
        console.log(chalk.gray(`... and ${task.waypoints.length - 10} more waypoints`));
      }
    }
    
    if (task.parameters) {
      console.log(chalk.blue('\n⚙️ Parameters:'));
      this.uiHelpers.displayKeyValuePairs({
        'Speed': task.parameters.speed ? `${task.parameters.speed} m/s` : 'Default',
        'Altitude': task.parameters.altitude ? `${task.parameters.altitude} m` : 'Default',
        'Pattern': task.parameters.pattern || 'None'
      });
    }
  }

  private async selectAndExecuteTask(client: any, tasks: any[]): Promise<void> {
    const executableTasks = tasks.filter(t => t.status === 'created' || t.status === 'paused');
    
    if (executableTasks.length === 0) {
      this.uiHelpers.displayWarning('No tasks available for execution');
      return;
    }
    
    const taskChoices = executableTasks.map((task, index) => ({
      name: `${task.name} (${task.type}) - ${task.status}`,
      value: index
    }));
    
    taskChoices.push({ name: '🔙 Back', value: -1 });
    
    const selectedIndex = await this.uiHelpers.selectFromList(
      'Select task to execute:',
      taskChoices
    );
    
    if (selectedIndex === -1) return;
    
    const task = executableTasks[selectedIndex];
    
    console.log(chalk.blue(`\n🚀 Preparing to execute: ${task.name}`));
    
    // Show task summary
    this.uiHelpers.displayKeyValuePairs({
      'Type': task.type,
      'Priority': task.priority,
      'Waypoints': task.waypoints?.length || 0,
      'Estimated Duration': this.estimateTaskDuration(task)
    });
    
    const confirmed = await this.uiHelpers.confirmAction(
      'Execute this task?',
      false
    );
    
    if (!confirmed) {
      this.uiHelpers.displayInfo('Execution cancelled');
      return;
    }
    
    const spinner = ora(`Executing ${task.name}...`).start();
    
    try {
      const response = await client.tasks.executeTask(task.id);
      
      if (response.success) {
        spinner.succeed('Task execution started');
        this.uiHelpers.displaySuccess(`Task ${task.name} is now executing`);
        
        const monitor = await this.uiHelpers.confirmAction(
          'Monitor task progress?',
          true
        );
        
        if (monitor) {
          await this.monitorTaskProgress(client, task.id);
        }
      } else {
        spinner.fail('Failed to start task');
        this.uiHelpers.displayError('Execution failed', response.message);
      }
    } catch (error) {
      spinner.fail('Task execution failed');
      this.uiHelpers.displayError('Could not execute task', error);
    }
  }

  private async filterAndListTasks(client: any): Promise<void> {
    const filterType = await this.uiHelpers.selectFromList(
      'Filter tasks by:',
      [
        { name: '📊 Status', value: 'status' },
        { name: '🏷️ Type', value: 'type' },
        { name: '🎯 Priority', value: 'priority' },
        { name: '🔙 Back', value: 'back' }
      ]
    );
    
    if (filterType === 'back') return;
    
    let filterValue;
    
    switch (filterType) {
      case 'status':
        filterValue = await this.uiHelpers.selectFromList(
          'Select status:',
          [
            { name: '📝 Created', value: 'created' },
            { name: '▶️ Executing', value: 'executing' },
            { name: '⏸️ Paused', value: 'paused' },
            { name: '✅ Completed', value: 'completed' },
            { name: '❌ Failed', value: 'failed' }
          ]
        );
        break;
      case 'type':
        filterValue = await this.uiHelpers.selectFromList(
          'Select type:',
          [
            { name: '🚁 Mowing', value: 'mowing' },
            { name: '📍 Survey', value: 'survey' },
            { name: '🛣️ Waypoint', value: 'waypoint' },
            { name: '🔲 Perimeter', value: 'perimeter' }
          ]
        );
        break;
      case 'priority':
        filterValue = await this.uiHelpers.selectFromList(
          'Select priority:',
          [
            { name: '🔴 High', value: 'high' },
            { name: '🟡 Medium', value: 'medium' },
            { name: '🟢 Low', value: 'low' }
          ]
        );
        break;
    }
    
    const spinner = ora('Filtering tasks...').start();
    
    try {
      const options: any = {};
      options[filterType] = filterValue;
      
      const filteredTasks = await client.tasks.listTasks(options);
      spinner.succeed(`Found ${filteredTasks.tasks.length} matching task(s)`);
      
      if (filteredTasks.tasks.length > 0) {
        console.log(chalk.green(`\n📋 Filtered Tasks (${filteredTasks.tasks.length}):`));
        const table = this.uiHelpers.createTable(['Name', 'Type', 'Status', 'Priority']);
        
        filteredTasks.tasks.forEach((task: any) => {
          table.push([
            task.name,
            task.type,
            task.status,
            task.priority
          ]);
        });
        
        console.log(table.toString());
      } else {
        console.log(chalk.yellow('\n⚠️ No tasks match the selected filter'));
      }
    } catch (error) {
      spinner.fail('Filter failed');
      this.uiHelpers.displayError('Could not filter tasks', error);
    }
  }

  private async createMowingTask(client: any): Promise<void> {
    console.log(chalk.blue.bold('\n🚁 Create Mowing Task'));
    
    const name = await this.uiHelpers.getTextInput(
      'Task name:',
      'Mowing Task',
      (input) => {
        if (!input.trim()) return { valid: false, error: 'Name cannot be empty' };
        return { valid: true };
      }
    );
    
    const description = await this.uiHelpers.getTextInput(
      'Description (optional):',
      ''
    );
    
    console.log(chalk.blue('\n📐 Define mowing area:'));
    
    const centerLat = await this.uiHelpers.getNumberInput(
      'Center latitude:',
      37.7749,
      -90,
      90
    );
    
    const centerLng = await this.uiHelpers.getNumberInput(
      'Center longitude:',
      -122.4194,
      -180,
      180
    );
    
    const width = await this.uiHelpers.getNumberInput(
      'Area width (meters):',
      50,
      1,
      1000
    );
    
    const height = await this.uiHelpers.getNumberInput(
      'Area height (meters):',
      50,
      1,
      1000
    );
    
    const spacing = await this.uiHelpers.getNumberInput(
      'Line spacing (meters):',
      2,
      0.5,
      10
    );
    
    const altitude = await this.uiHelpers.getNumberInput(
      'Operating altitude (meters):',
      10,
      1,
      100
    );
    
    const speed = await this.uiHelpers.getNumberInput(
      'Mowing speed (m/s):',
      2,
      0.5,
      10
    );
    
    const pattern = {
      centerLat,
      centerLng,
      width,
      height,
      spacing,
      altitude,
      speed
    };
    
    const spinner = ora('Creating mowing task...').start();
    
    try {
      const taskRequest = client.tasks.createMowingTask(name, pattern, description);
      const task = await client.tasks.createTask(taskRequest);
      
      spinner.succeed('Mowing task created');
      this.uiHelpers.displaySuccess(`Task "${name}" created successfully`);
      
      console.log(chalk.blue('\n📊 Task Summary:'));
      this.uiHelpers.displayKeyValuePairs({
        'ID': task.id.substring(0, 8) + '...',
        'Waypoints': task.waypoints?.length || 0,
        'Total Distance': this.calculateTotalDistance(task.waypoints),
        'Estimated Duration': this.estimateTaskDuration(task)
      });
      
    } catch (error) {
      spinner.fail('Failed to create task');
      this.uiHelpers.displayError('Could not create mowing task', error);
    }
  }

  private async createSurveyTask(client: any): Promise<void> {
    console.log(chalk.blue.bold('\n📍 Create Survey Task'));
    
    const name = await this.uiHelpers.getTextInput(
      'Task name:',
      'Survey Task'
    );
    
    const description = await this.uiHelpers.getTextInput(
      'Description (optional):',
      ''
    );
    
    console.log(chalk.blue('\n📐 Define survey area:'));
    
    const centerLat = await this.uiHelpers.getNumberInput(
      'Center latitude:',
      37.7749,
      -90,
      90
    );
    
    const centerLng = await this.uiHelpers.getNumberInput(
      'Center longitude:',
      -122.4194,
      -180,
      180
    );
    
    const width = await this.uiHelpers.getNumberInput(
      'Area width (meters):',
      100,
      1,
      1000
    );
    
    const height = await this.uiHelpers.getNumberInput(
      'Area height (meters):',
      100,
      1,
      1000
    );
    
    const spacing = await this.uiHelpers.getNumberInput(
      'Grid spacing (meters):',
      10,
      1,
      50
    );
    
    const altitude = await this.uiHelpers.getNumberInput(
      'Survey altitude (meters):',
      30,
      10,
      120
    );
    
    const backAndForth = await this.uiHelpers.confirmAction(
      'Use back-and-forth pattern? (vs. one-way)',
      true
    );
    
    const pattern = {
      centerLat,
      centerLng,
      width,
      height,
      spacing,
      altitude,
      backAndForth
    };
    
    const spinner = ora('Creating survey task...').start();
    
    try {
      const taskRequest = client.tasks.createSurveyTask(name, pattern, description);
      const task = await client.tasks.createTask(taskRequest);
      
      spinner.succeed('Survey task created');
      this.uiHelpers.displaySuccess(`Task "${name}" created successfully`);
      
    } catch (error) {
      spinner.fail('Failed to create task');
      this.uiHelpers.displayError('Could not create survey task', error);
    }
  }

  private async createWaypointTask(client: any): Promise<void> {
    console.log(chalk.blue.bold('\n🛣️ Create Waypoint Mission'));
    
    const name = await this.uiHelpers.getTextInput(
      'Task name:',
      'Waypoint Mission'
    );
    
    const description = await this.uiHelpers.getTextInput(
      'Description (optional):',
      ''
    );
    
    const waypoints = [];
    let addMore = true;
    let waypointNum = 1;
    
    console.log(chalk.blue('\n📍 Add waypoints:'));
    
    while (addMore) {
      console.log(chalk.gray(`\nWaypoint #${waypointNum}:`));
      
      const lat = await this.uiHelpers.getNumberInput(
        'Latitude:',
        37.7749 + (waypointNum - 1) * 0.001,
        -90,
        90
      );
      
      const lng = await this.uiHelpers.getNumberInput(
        'Longitude:',
        -122.4194 + (waypointNum - 1) * 0.001,
        -180,
        180
      );
      
      const alt = await this.uiHelpers.getNumberInput(
        'Altitude (meters):',
        20,
        1,
        120
      );
      
      waypoints.push({ lat, lng, alt });
      waypointNum++;
      
      addMore = await this.uiHelpers.confirmAction(
        'Add another waypoint?',
        waypoints.length < 3
      );
    }
    
    const spinner = ora('Creating waypoint mission...').start();
    
    try {
      const waypointObjects = client.tasks.createSimpleWaypointMission(waypoints);
      const taskRequest = client.tasks.createWaypointTask(name, waypointObjects, description);
      const task = await client.tasks.createTask(taskRequest);
      
      spinner.succeed('Waypoint mission created');
      this.uiHelpers.displaySuccess(`Task "${name}" created with ${waypoints.length} waypoints`);
      
    } catch (error) {
      spinner.fail('Failed to create task');
      this.uiHelpers.displayError('Could not create waypoint mission', error);
    }
  }

  private async createPerimeterTask(client: any): Promise<void> {
    console.log(chalk.blue.bold('\n🔲 Create Perimeter Inspection'));
    
    const name = await this.uiHelpers.getTextInput(
      'Task name:',
      'Perimeter Inspection'
    );
    
    const centerLat = await this.uiHelpers.getNumberInput(
      'Center latitude:',
      37.7749,
      -90,
      90
    );
    
    const centerLng = await this.uiHelpers.getNumberInput(
      'Center longitude:',
      -122.4194,
      -180,
      180
    );
    
    const width = await this.uiHelpers.getNumberInput(
      'Perimeter width (meters):',
      100,
      10,
      1000
    );
    
    const height = await this.uiHelpers.getNumberInput(
      'Perimeter height (meters):',
      100,
      10,
      1000
    );
    
    const altitude = await this.uiHelpers.getNumberInput(
      'Inspection altitude (meters):',
      15,
      5,
      50
    );
    
    const buffer = await this.uiHelpers.getNumberInput(
      'Safety buffer (meters):',
      2,
      0,
      10
    );
    
    const spinner = ora('Creating perimeter task...').start();
    
    try {
      const pattern = {
        centerLat,
        centerLng,
        width,
        height,
        altitude,
        buffer
      };
      
      const waypoints = client.tasks.generatePerimeterPattern(pattern);
      const taskRequest = client.tasks.createWaypointTask(name, waypoints, `Perimeter inspection of ${width}x${height}m area`);
      const task = await client.tasks.createTask(taskRequest);
      
      spinner.succeed('Perimeter task created');
      this.uiHelpers.displaySuccess(`Task "${name}" created successfully`);
      
    } catch (error) {
      spinner.fail('Failed to create task');
      this.uiHelpers.displayError('Could not create perimeter task', error);
    }
  }

  private async createReturnToHomeTask(client: any): Promise<void> {
    console.log(chalk.blue.bold('\n🏠 Create Return to Home Task'));
    
    const name = await this.uiHelpers.getTextInput(
      'Task name:',
      'Return to Home'
    );
    
    const altitude = await this.uiHelpers.getNumberInput(
      'RTH altitude (meters):',
      30,
      10,
      120
    );
    
    const spinner = ora('Creating RTH task...').start();
    
    try {
      // Simple RTH task with single waypoint
      const homeWaypoint = client.tasks.createReturnToLaunchWaypoint(0, 0, altitude);
      const taskRequest = client.tasks.createWaypointTask(name, [homeWaypoint], 'Return to home position');
      const task = await client.tasks.createTask(taskRequest);
      
      spinner.succeed('RTH task created');
      this.uiHelpers.displaySuccess(`Task "${name}" created successfully`);
      
    } catch (error) {
      spinner.fail('Failed to create task');
      this.uiHelpers.displayError('Could not create RTH task', error);
    }
  }

  private async monitorTaskProgress(client: any, taskId: string): Promise<void> {
    console.log(chalk.blue.bold('\n📊 Monitoring Task Progress'));
    console.log(chalk.gray('Press Ctrl+C to stop monitoring\n'));
    
    let monitoring = true;
    
    const originalHandler = process.on('SIGINT', () => {
      monitoring = false;
      console.log(chalk.yellow('\n\nMonitoring stopped'));
    });
    
    try {
      while (monitoring) {
        const status = await client.tasks.getTaskExecutionStatus(taskId);
        
        console.clear();
        console.log(chalk.cyan.bold('📊 Task Progress Monitor'));
        console.log(chalk.gray(`Task ID: ${taskId}\n`));
        
        const progressBar = this.createProgressBar(status.progress || 0);
        console.log(`Progress: ${progressBar} ${Math.round(status.progress || 0)}%`);
        
        this.uiHelpers.displayKeyValuePairs({
          'Status': status.status,
          'Current Waypoint': `${status.currentWaypoint || 0} of ${status.totalWaypoints || 0}`,
          'Elapsed Time': this.uiHelpers.formatDuration(status.elapsedTime || 0),
          'Est. Remaining': status.estimatedTimeRemaining ? 
            this.uiHelpers.formatDuration(status.estimatedTimeRemaining) : 'Unknown',
          'Speed': status.currentSpeed ? `${status.currentSpeed.toFixed(1)} m/s` : 'N/A',
          'Altitude': status.currentAltitude ? `${status.currentAltitude.toFixed(1)} m` : 'N/A'
        });
        
        if (status.errors && status.errors.length > 0) {
          console.log(chalk.red('\n⚠️ Errors:'));
          status.errors.forEach(error => {
            console.log(chalk.red(`  • ${error}`));
          });
        }
        
        console.log(chalk.gray('\nPress Ctrl+C to stop monitoring...'));
        
        if (status.status === 'completed' || status.status === 'failed' || status.status === 'cancelled') {
          monitoring = false;
          console.log(chalk.green(`\n✅ Task ${status.status}`));
          break;
        }
        
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      this.uiHelpers.displayError('Monitoring error', error);
    } finally {
      process.removeListener('SIGINT', originalHandler as any);
    }
  }

  private createProgressBar(progress: number): string {
    const barLength = 30;
    const filledLength = Math.round((progress / 100) * barLength);
    const emptyLength = barLength - filledLength;
    return chalk.green('█'.repeat(filledLength)) + chalk.gray('░'.repeat(emptyLength));
  }

  private async pauseActiveTask(client: any, executingTasks: any[]): Promise<void> {
    if (executingTasks.length === 0) {
      this.uiHelpers.displayWarning('No executing tasks to pause');
      return;
    }
    
    const task = executingTasks[0]; // For now, just handle the first one
    
    const confirmed = await this.uiHelpers.confirmAction(
      `Pause task "${task.name}"?`,
      true
    );
    
    if (!confirmed) return;
    
    const spinner = ora('Pausing task...').start();
    
    try {
      const response = await client.tasks.pauseTask(task.id);
      
      if (response.success) {
        spinner.succeed('Task paused');
        this.uiHelpers.displaySuccess(`Task "${task.name}" has been paused`);
      } else {
        spinner.fail('Failed to pause task');
        this.uiHelpers.displayError('Pause failed', response.message);
      }
    } catch (error) {
      spinner.fail('Pause failed');
      this.uiHelpers.displayError('Could not pause task', error);
    }
  }

  private async resumePausedTask(client: any, pausedTasks: any[]): Promise<void> {
    if (pausedTasks.length === 0) {
      this.uiHelpers.displayWarning('No paused tasks to resume');
      return;
    }
    
    const task = pausedTasks[0]; // For now, just handle the first one
    
    const confirmed = await this.uiHelpers.confirmAction(
      `Resume task "${task.name}"?`,
      true
    );
    
    if (!confirmed) return;
    
    const spinner = ora('Resuming task...').start();
    
    try {
      const response = await client.tasks.resumeTask(task.id);
      
      if (response.success) {
        spinner.succeed('Task resumed');
        this.uiHelpers.displaySuccess(`Task "${task.name}" has been resumed`);
      } else {
        spinner.fail('Failed to resume task');
        this.uiHelpers.displayError('Resume failed', response.message);
      }
    } catch (error) {
      spinner.fail('Resume failed');
      this.uiHelpers.displayError('Could not resume task', error);
    }
  }

  private async cancelActiveTask(client: any, activeTasks: any[]): Promise<void> {
    if (activeTasks.length === 0) {
      this.uiHelpers.displayWarning('No active tasks to cancel');
      return;
    }
    
    const task = activeTasks[0]; // For now, just handle the first one
    
    console.log(chalk.red.bold('\n⚠️ WARNING: Cancelling a task cannot be undone!'));
    
    const confirmed = await this.uiHelpers.confirmAction(
      `Cancel task "${task.name}"?`,
      false
    );
    
    if (!confirmed) return;
    
    const spinner = ora('Cancelling task...').start();
    
    try {
      const response = await client.tasks.cancelTask(task.id);
      
      if (response.success) {
        spinner.succeed('Task cancelled');
        this.uiHelpers.displaySuccess(`Task "${task.name}" has been cancelled`);
      } else {
        spinner.fail('Failed to cancel task');
        this.uiHelpers.displayError('Cancel failed', response.message);
      }
    } catch (error) {
      spinner.fail('Cancel failed');
      this.uiHelpers.displayError('Could not cancel task', error);
    }
  }

  private async createTaskFromTemplate(client: any, templates: any[]): Promise<void> {
    const templateChoices = templates.map((template, index) => ({
      name: `${template.name} (${template.type})`,
      value: index
    }));
    
    templateChoices.push({ name: '🔙 Back', value: -1 });
    
    const selectedIndex = await this.uiHelpers.selectFromList(
      'Select template:',
      templateChoices
    );
    
    if (selectedIndex === -1) return;
    
    const template = templates[selectedIndex];
    
    const name = await this.uiHelpers.getTextInput(
      'Task name:',
      `${template.name} Copy`
    );
    
    const spinner = ora('Creating task from template...').start();
    
    try {
      const request = {
        templateId: template.id,
        name,
        executeImmediately: false
      };
      
      const task = await client.tasks.createTaskFromTemplate(request);
      
      spinner.succeed('Task created from template');
      this.uiHelpers.displaySuccess(`Task "${name}" created successfully`);
      
    } catch (error) {
      spinner.fail('Failed to create task');
      this.uiHelpers.displayError('Could not create task from template', error);
    }
  }

  private async viewTemplateDetails(templates: any[]): Promise<void> {
    const templateChoices = templates.map((template, index) => ({
      name: template.name,
      value: index
    }));
    
    templateChoices.push({ name: '🔙 Back', value: -1 });
    
    const selectedIndex = await this.uiHelpers.selectFromList(
      'Select template to view:',
      templateChoices
    );
    
    if (selectedIndex === -1) return;
    
    const template = templates[selectedIndex];
    
    console.log(chalk.blue.bold(`\n📋 Template: ${template.name}`));
    this.uiHelpers.displaySeparator();
    
    this.uiHelpers.displayKeyValuePairs({
      'ID': template.id,
      'Type': template.type,
      'Description': template.description || 'No description',
      'Created': new Date(template.createdAt).toLocaleString(),
      'Parameters': JSON.stringify(template.parameters || {})
    });
  }

  private async exportTemplates(templates: any[]): Promise<void> {
    const format = await this.uiHelpers.selectFromList(
      'Export format:',
      [
        { name: 'JSON', value: 'json' },
        { name: 'CSV', value: 'csv' }
      ]
    );
    
    console.log(chalk.blue('\n📤 Template Export:'));
    console.log(chalk.gray(JSON.stringify(templates, null, 2)));
    console.log(chalk.yellow('\n💡 Copy the data above to save your templates'));
  }

  private async exportTaskHistory(tasks: any[]): Promise<void> {
    const format = await this.uiHelpers.selectFromList(
      'Export format:',
      [
        { name: 'JSON', value: 'json' },
        { name: 'CSV', value: 'csv' }
      ]
    );
    
    const spinner = ora('Preparing export...').start();
    
    try {
      const exportData = tasks.map(task => ({
        name: task.name,
        type: task.type,
        status: task.status,
        created: task.createdAt,
        completed: task.completedAt,
        duration: this.calculateTaskDuration(task),
        waypoints: task.waypoints?.length || 0
      }));
      
      spinner.succeed('Export ready');
      
      console.log(chalk.blue('\n📤 Task History Export:'));
      
      if (format === 'json') {
        console.log(chalk.gray(JSON.stringify(exportData, null, 2)));
      } else {
        // Simple CSV format
        console.log('Name,Type,Status,Created,Completed,Duration,Waypoints');
        exportData.forEach(row => {
          console.log(`${row.name},${row.type},${row.status},${row.created},${row.completed || ''},${row.duration},${row.waypoints}`);
        });
      }
      
      console.log(chalk.yellow('\n💡 Copy the data above to save your task history'));
      
    } catch (error) {
      spinner.fail('Export failed');
      this.uiHelpers.displayError('Could not export history', error);
    }
  }

  private async showTaskStatistics(tasks: any[]): Promise<void> {
    console.log(chalk.blue.bold('\n📊 Task Statistics'));
    this.uiHelpers.displaySeparator();
    
    const completedTasks = tasks.filter(t => t.status === 'completed');
    const failedTasks = tasks.filter(t => t.status === 'failed');
    
    const totalDuration = tasks.reduce((sum, task) => {
      const duration = this.calculateTaskDurationMs(task);
      return sum + (duration || 0);
    }, 0);
    
    const avgDuration = tasks.length > 0 ? totalDuration / tasks.length : 0;
    
    const tasksByType: Record<string, number> = {};
    tasks.forEach(task => {
      tasksByType[task.type] = (tasksByType[task.type] || 0) + 1;
    });
    
    this.uiHelpers.displayKeyValuePairs({
      'Total Tasks': tasks.length,
      'Completed': completedTasks.length,
      'Failed': failedTasks.length,
      'Success Rate': `${Math.round((completedTasks.length / tasks.length) * 100)}%`,
      'Total Time': this.uiHelpers.formatDuration(totalDuration),
      'Average Duration': this.uiHelpers.formatDuration(avgDuration)
    });
    
    console.log(chalk.blue('\n📈 Tasks by Type:'));
    Object.entries(tasksByType).forEach(([type, count]) => {
      console.log(`  ${this.getTaskTypeIcon(type)} ${type}: ${count}`);
    });
  }

  private calculateTaskDuration(task: any): string {
    if (!task.createdAt) return 'N/A';
    
    const start = new Date(task.createdAt).getTime();
    const end = task.completedAt ? new Date(task.completedAt).getTime() : Date.now();
    const duration = end - start;
    
    return this.uiHelpers.formatDuration(duration);
  }

  private calculateTaskDurationMs(task: any): number {
    if (!task.createdAt) return 0;
    
    const start = new Date(task.createdAt).getTime();
    const end = task.completedAt ? new Date(task.completedAt).getTime() : Date.now();
    
    return end - start;
  }

  private estimateTaskDuration(task: any): string {
    if (!task.waypoints || task.waypoints.length < 2) return 'Unknown';
    
    const distance = this.calculateTotalDistance(task.waypoints);
    const avgSpeed = task.parameters?.speed || 2.0; // Default 2 m/s
    const estimatedSeconds = distance / avgSpeed;
    
    return this.uiHelpers.formatDuration(estimatedSeconds * 1000);
  }

  private calculateTotalDistance(waypoints: any[]): string {
    if (!waypoints || waypoints.length < 2) return '0 m';
    
    let totalDistance = 0;
    
    for (let i = 1; i < waypoints.length; i++) {
      const prev = waypoints[i - 1];
      const curr = waypoints[i];
      
      if (prev && curr) {
        const distance = this.calculateDistance(
          prev.latitude || prev.lat,
          prev.longitude || prev.lng,
          curr.latitude || curr.lat,
          curr.longitude || curr.lng
        );
        
        totalDistance += distance;
      }
    }
    
    return totalDistance > 1000 ? 
      `${(totalDistance / 1000).toFixed(2)} km` : 
      `${Math.round(totalDistance)} m`;
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }
}