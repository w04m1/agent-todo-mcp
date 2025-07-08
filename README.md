# Agent TODO MCP Server

A Model Context Protocol server for AI agents to manage tasks and track progress across projects.

## Features

- Create, update, and manage TODOs with detailed metadata
- Track progress, status, priority, and dependencies
- **Explicit project isolation** to prevent data mixup between workspaces
- Search, filter, and generate comprehensive reports
- Persistent JSON storage with complete project separation

## Installation

### Via npm (Recommended)

```bash
npm install -g agent-todo-mcp
```

### From Source

```bash
git clone https://github.com/w04m1/agent-todo-mcp.git
cd agent-todo-mcp
npm install
npm run build
npm install -g .
```

## Configuration

Add to your Claude Desktop/Cursor/VSCode/etc. config:

```json
{
  "mcpServers": {
    "agent-todo": {
      "command": "agent-todo-mcp"
    }
  }
}
```

## How AI Models Use This Server

When AI models interact with this MCP server, they follow this workflow:

1. **Check existing projects** with `list_projects`
2. **Create or switch to a project** with `switch_project`
3. **Create and manage TODOs** within that project workspace

## Project Management

### Project Naming Best Practices

When creating projects, use descriptive names that clearly identify the workspace:

- ✅ `"my-react-app"` - Good descriptive name
- ✅ `"backend-api-v2"` - Clear project identifier
- ✅ `"research-ml-models"` - Descriptive and specific
- ❌ `"project1"` - Too generic
- ❌ `"temp"` - Not descriptive

### Project Isolation & Storage

Each project workspace is completely isolated. TODOs are stored in:

```
~/.agent-todos/
├── my-react-app/todos.json      # Project: "my-react-app"
├── backend-api-v2/todos.json    # Project: "backend-api-v2"
├── research-ml-models/todos.json # Project: "research-ml-models"
└── default-workspace/todos.json # Default fallback project
```

### Architecture

- **Complete Isolation**: Each project has its own TODO storage
- **Explicit Management**: Projects are created explicitly via `switch_project` tool
- **Persistent Storage**: All data persists in `~/.agent-todos/{projectId}/`
- **⚠️ No Deletion**: Projects cannot be deleted through the API (only individual TODOs can be deleted)

## Available Tools

### Project Management

- `list_projects` - List all available project workspaces
- `switch_project` - Create new project or switch between existing ones
- `get_project_info` - Show current project details

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
```

## Development

```bash
npm run dev    # Development mode
npm run build  # Build project
npm start      # Run built server
```

## License

MIT

---

###### Built with AI for AI 🤡
