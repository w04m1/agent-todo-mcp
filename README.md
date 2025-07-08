# Agent TODO MCP Server

A Model Context Protocol server for AI agents to manage tasks and track progress across projects.

## Features

- Create, update, and manage TODOs with detailed metadata
- Track progress, status, priority, and dependencies
- Project isolation to prevent data mixup
- Search, filter, and generate reports
- Persistent JSON storage

## Installation

### Via npm (Recommended)

```bash
npm install -g agent-todo-mcp
```

### From Source

```bash
git clone https://github.com/agent-dev/agent-todo-mcp.git
cd agent-todo-mcp
npm install
npm run build
```

## Configuration

Add to your Claude Desktop config:

```json
{
  "mcpServers": {
    "agent-todo": {
      "command": "agent-todo-mcp"
    }
  }
}
```

No environment variables needed! The server automatically detects your project.

### Project Auto-Detection

The server automatically isolates TODOs by project using this priority:

1. **Environment variable**: `TODO_PROJECT_ID` (if set)
2. **Package.json name**: Uses `name` field from package.json in current directory
3. **Directory name**: Uses current directory name as project ID
4. **Default**: Falls back to "default"

### Manual Override (Optional)

```json
{
  "mcpServers": {
    "agent-todo": {
      "command": "agent-todo-mcp",
      "env": {
        "TODO_PROJECT_ID": "specific-project-name"
      }
    }
  }
}
```

```

## Project Isolation

Each project gets isolated storage automatically. TODOs are stored in:

```

.agent-todos/
├── my-react-app/todos.json # From package.json name
├── backend-api/todos.json # From directory name  
└── default/todos.json # Fallback

````

**Zero configuration required** - just run Claude in different project directories!

## Available Tools

### Core Management

- `create_todo` - Create new tasks
- `update_todo` - Update existing tasks
- `delete_todo` - Remove tasks
- `list_todos` - List and filter tasks
- `get_todo` - Get detailed task info

### Search & Analytics

- `search_todos` - Search across all tasks
- `generate_report` - Create progress reports
- `get_stats` - Quick statistics

### Project Management

- `get_project_info` - Show current project details
- `switch_project` - Switch between projects
- `list_projects` - List available projects

## TODO Structure

```typescript
interface Todo {
  id: string;
  title: string;
  description?: string;
  status: "pending" | "in-progress" | "completed" | "blocked";
  priority: "low" | "medium" | "high" | "urgent";
  progress: number; // 0-100
  tags: string[];
  dependencies: string[]; // Other TODO IDs
  dueDate?: string;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}
````

## Development

```bash
npm run dev    # Development mode
npm run build  # Build project
npm start      # Run built server
```

## License

ISC
