#!/usr/bin/env node

import { FastMCP } from "fastmcp";
import { z } from "zod";
import { readFile, writeFile, mkdir, readdir } from "fs/promises";
import { join } from "path";

// Define the TODO data structure
interface Todo {
  id: string;
  title: string;
  description?: string;
  status: "pending" | "in-progress" | "completed" | "blocked";
  priority: "low" | "medium" | "high" | "urgent";
  createdAt: string;
  updatedAt: string;
  dueDate?: string;
  tags: string[];
  dependencies: string[]; // IDs of other todos this depends on
  progress: number; // 0-100
  metadata: Record<string, any>; // For storing additional context
}

// Data storage path with project isolation
async function getProjectId(): Promise<string> {
  return currentProjectId || "default-workspace";
}

async function getProjectDataDir(): Promise<string> {
  const projectId = await getProjectId();
  const baseDir = join(process.env.HOME || process.cwd(), ".agent-todos");
  return join(baseDir, projectId);
}

async function getProjectTodosFile(): Promise<string> {
  const dataDir = await getProjectDataDir();
  return join(dataDir, "todos.json");
}

// In-memory storage with file persistence
let todos: Todo[] = [];
let currentProjectId: string = "default-workspace";

// Utility functions
async function ensureDataDir(): Promise<void> {
  const dataDir = await getProjectDataDir();
  await mkdir(dataDir, { recursive: true });
}

async function loadTodos(): Promise<void> {
  try {
    const todosFile = await getProjectTodosFile();
    const data = await readFile(todosFile, "utf-8");
    todos = JSON.parse(data);
  } catch (error) {
    // File doesn't exist or is empty, start with empty array
    todos = [];
  }
}

async function saveTodos(): Promise<void> {
  await ensureDataDir();
  const todosFile = await getProjectTodosFile();
  await writeFile(todosFile, JSON.stringify(todos, null, 2));
}

function generateId(): string {
  return `todo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function formatTodoForDisplay(todo: Todo): string {
  const statusEmoji = {
    pending: "⏳",
    "in-progress": "🔄",
    completed: "✅",
    blocked: "🚫",
  };

  const priorityEmoji = {
    low: "🟢",
    medium: "🟡",
    high: "🟠",
    urgent: "🔴",
  };

  const progressBar =
    "█".repeat(Math.floor(todo.progress / 10)) +
    "░".repeat(10 - Math.floor(todo.progress / 10));

  let result = `${statusEmoji[todo.status]} ${priorityEmoji[todo.priority]} **${
    todo.title
  }** (${todo.id})\n`;
  result += `   Status: ${todo.status} | Priority: ${todo.priority} | Progress: ${todo.progress}% [${progressBar}]\n`;

  if (todo.description) {
    result += `   Description: ${todo.description}\n`;
  }

  if (todo.dueDate) {
    result += `   Due: ${todo.dueDate}\n`;
  }

  if (todo.tags.length > 0) {
    result += `   Tags: ${todo.tags.join(", ")}\n`;
  }

  if (todo.dependencies.length > 0) {
    result += `   Dependencies: ${todo.dependencies.join(", ")}\n`;
  }

  result += `   Created: ${todo.createdAt} | Updated: ${todo.updatedAt}\n`;

  return result;
}

// Initialize the FastMCP server
const server = new FastMCP({
  name: "Agent TODO Manager",
  version: "1.0.0",
  instructions: `
Agent TODO Management System for efficient task tracking and management.

🚀 GETTING STARTED:
1. FIRST: Call list_projects to see existing project workspaces
2. THEN: Call switch_project with a descriptive project name (e.g., 'my-app', 'research-project')
   - This either switches to an existing project or creates a new isolated workspace
3. Finally: Create and manage TODOs within that project

Core capabilities:
- Create and manage TODOs with detailed metadata
- Track progress and status updates
- Handle task dependencies and relationships
- Organize with tags and priorities
- Generate comprehensive progress reports
- Search and filter across all tasks
- Complete project isolation (each project has separate TODO storage)

🔒 PROJECT ISOLATION & MANAGEMENT:
- Each project workspace is completely isolated with its own TODO storage
- Individual TODOs can be deleted using delete_todo
- ⚠️ PROJECT DELETION: Projects cannot be deleted through this API
- All data persists in ~/.agent-todos/{projectId}/

Best practices:
- Check list_projects before creating new projects to avoid duplicates
- Always start with switch_project to set up your workspace
- Use descriptive project names that reflect the actual work
- Use descriptive titles and detailed descriptions for TODOs
- Set realistic due dates and appropriate priorities
- Update progress regularly for accurate tracking
- Utilize tags for effective categorization
- Define dependencies to manage workflow relationships
- Keep status current as work progresses

The system maintains complete project isolation to prevent data contamination between different workspaces.
  `.trim(),
});

// Load existing todos on startup
loadTodos();

// Tool: Create a new TODO
server.addTool({
  name: "create_todo",
  description:
    "Create a new TODO item with optional metadata. IMPORTANT: Before creating your first TODO, call list_projects to check existing workspaces, then call switch_project to set up your project workspace.",
  parameters: z.object({
    title: z.string().describe("The title/summary of the TODO"),
    description: z
      .string()
      .optional()
      .describe("Detailed description of the task"),
    priority: z
      .enum(["low", "medium", "high", "urgent"])
      .default("medium")
      .describe("Priority level"),
    dueDate: z
      .string()
      .optional()
      .describe("Due date in ISO format (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss)"),
    tags: z.array(z.string()).default([]).describe("Tags for categorization"),
    dependencies: z
      .array(z.string())
      .default([])
      .describe("IDs of other TODOs this depends on"),
    metadata: z
      .record(z.any())
      .default({})
      .describe("Additional metadata as key-value pairs"),
  }),
  execute: async (args) => {
    const now = new Date().toISOString();
    const todo: Todo = {
      id: generateId(),
      title: args.title,
      description: args.description,
      status: "pending",
      priority: args.priority,
      createdAt: now,
      updatedAt: now,
      dueDate: args.dueDate,
      tags: args.tags,
      dependencies: args.dependencies,
      progress: 0,
      metadata: args.metadata,
    };

    todos.push(todo);
    await saveTodos();

    return `✅ Created TODO: ${todo.title} (ID: ${
      todo.id
    })\n\n${formatTodoForDisplay(todo)}`;
  },
});

// Tool: List TODOs with filtering
server.addTool({
  name: "list_todos",
  description: "List TODOs with optional filtering and sorting",
  parameters: z.object({
    status: z
      .enum(["pending", "in-progress", "completed", "blocked"])
      .optional()
      .describe("Filter by status"),
    priority: z
      .enum(["low", "medium", "high", "urgent"])
      .optional()
      .describe("Filter by priority"),
    tag: z.string().optional().describe("Filter by tag"),
    sortBy: z
      .enum(["created", "updated", "priority", "dueDate", "progress"])
      .default("updated")
      .describe("Sort by field"),
    sortOrder: z.enum(["asc", "desc"]).default("desc").describe("Sort order"),
    limit: z.number().optional().describe("Maximum number of TODOs to return"),
  }),
  execute: async (args) => {
    let filteredTodos = [...todos];

    // Apply filters
    if (args.status) {
      filteredTodos = filteredTodos.filter(
        (todo) => todo.status === args.status
      );
    }
    if (args.priority) {
      filteredTodos = filteredTodos.filter(
        (todo) => todo.priority === args.priority
      );
    }
    if (args.tag) {
      filteredTodos = filteredTodos.filter((todo) =>
        todo.tags.includes(args.tag!)
      );
    }

    // Sort
    filteredTodos.sort((a, b) => {
      let aVal: any, bVal: any;

      switch (args.sortBy) {
        case "created":
          aVal = new Date(a.createdAt);
          bVal = new Date(b.createdAt);
          break;
        case "updated":
          aVal = new Date(a.updatedAt);
          bVal = new Date(b.updatedAt);
          break;
        case "priority":
          const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
          aVal = priorityOrder[a.priority];
          bVal = priorityOrder[b.priority];
          break;
        case "dueDate":
          aVal = a.dueDate ? new Date(a.dueDate) : new Date("9999-12-31");
          bVal = b.dueDate ? new Date(b.dueDate) : new Date("9999-12-31");
          break;
        case "progress":
          aVal = a.progress;
          bVal = b.progress;
          break;
        default:
          aVal = a.updatedAt;
          bVal = b.updatedAt;
      }

      if (args.sortOrder === "asc") {
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      } else {
        return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
      }
    });

    // Apply limit
    if (args.limit) {
      filteredTodos = filteredTodos.slice(0, args.limit);
    }

    if (filteredTodos.length === 0) {
      return "No TODOs found matching the specified criteria.";
    }

    const summary = `📋 Found ${filteredTodos.length} TODO(s) ${
      args.limit ? `(showing first ${args.limit})` : ""
    }\n\n`;
    return summary + filteredTodos.map(formatTodoForDisplay).join("\n");
  },
});

// Tool: Update a TODO
server.addTool({
  name: "update_todo",
  description: "Update an existing TODO item",
  parameters: z.object({
    id: z.string().describe("The ID of the TODO to update"),
    title: z.string().optional().describe("New title"),
    description: z.string().optional().describe("New description"),
    status: z
      .enum(["pending", "in-progress", "completed", "blocked"])
      .optional()
      .describe("New status"),
    priority: z
      .enum(["low", "medium", "high", "urgent"])
      .optional()
      .describe("New priority"),
    progress: z
      .number()
      .min(0)
      .max(100)
      .optional()
      .describe("Progress percentage (0-100)"),
    dueDate: z.string().optional().describe("New due date in ISO format"),
    tags: z
      .array(z.string())
      .optional()
      .describe("New tags (replaces existing)"),
    addTags: z
      .array(z.string())
      .optional()
      .describe("Tags to add (preserves existing)"),
    removeTags: z.array(z.string()).optional().describe("Tags to remove"),
    dependencies: z
      .array(z.string())
      .optional()
      .describe("New dependencies (replaces existing)"),
    addDependencies: z
      .array(z.string())
      .optional()
      .describe("Dependencies to add"),
    removeDependencies: z
      .array(z.string())
      .optional()
      .describe("Dependencies to remove"),
    metadata: z
      .record(z.any())
      .optional()
      .describe("Additional metadata to merge"),
  }),
  execute: async (args) => {
    const todoIndex = todos.findIndex((todo) => todo.id === args.id);
    if (todoIndex === -1) {
      return `❌ TODO with ID ${args.id} not found.`;
    }

    const todo = todos[todoIndex];
    const originalStatus = todo.status;

    // Update fields
    if (args.title !== undefined) todo.title = args.title;
    if (args.description !== undefined) todo.description = args.description;
    if (args.status !== undefined) todo.status = args.status;
    if (args.priority !== undefined) todo.priority = args.priority;
    if (args.progress !== undefined) todo.progress = args.progress;
    if (args.dueDate !== undefined) todo.dueDate = args.dueDate;

    // Handle tags
    if (args.tags !== undefined) {
      todo.tags = args.tags;
    } else {
      if (args.addTags) {
        todo.tags = [...new Set([...todo.tags, ...args.addTags])];
      }
      if (args.removeTags) {
        todo.tags = todo.tags.filter((tag) => !args.removeTags!.includes(tag));
      }
    }

    // Handle dependencies
    if (args.dependencies !== undefined) {
      todo.dependencies = args.dependencies;
    } else {
      if (args.addDependencies) {
        todo.dependencies = [
          ...new Set([...todo.dependencies, ...args.addDependencies]),
        ];
      }
      if (args.removeDependencies) {
        todo.dependencies = todo.dependencies.filter(
          (dep) => !args.removeDependencies!.includes(dep)
        );
      }
    }

    // Handle metadata
    if (args.metadata) {
      todo.metadata = { ...todo.metadata, ...args.metadata };
    }

    // Auto-update progress based on status
    if (args.status === "completed" && args.progress === undefined) {
      todo.progress = 100;
    } else if (
      args.status === "pending" &&
      args.progress === undefined &&
      originalStatus !== "pending"
    ) {
      todo.progress = 0;
    }

    todo.updatedAt = new Date().toISOString();

    await saveTodos();

    return `✅ Updated TODO: ${todo.title}\n\n${formatTodoForDisplay(todo)}`;
  },
});

// Tool: Delete a TODO
server.addTool({
  name: "delete_todo",
  description: "Delete a TODO item",
  parameters: z.object({
    id: z.string().describe("The ID of the TODO to delete"),
    force: z
      .boolean()
      .default(false)
      .describe("Force delete even if other TODOs depend on this one"),
  }),
  execute: async (args) => {
    const todoIndex = todos.findIndex((todo) => todo.id === args.id);
    if (todoIndex === -1) {
      return `❌ TODO with ID ${args.id} not found.`;
    }

    const todo = todos[todoIndex];

    // Check for dependencies unless forced
    if (!args.force) {
      const dependents = todos.filter((t) => t.dependencies.includes(args.id));
      if (dependents.length > 0) {
        const dependentTitles = dependents
          .map((t) => `${t.title} (${t.id})`)
          .join(", ");
        return `❌ Cannot delete TODO "${todo.title}" because other TODOs depend on it: ${dependentTitles}\nUse force=true to delete anyway.`;
      }
    }

    // Remove from dependencies of other TODOs if forced
    if (args.force) {
      todos.forEach((t) => {
        t.dependencies = t.dependencies.filter((dep) => dep !== args.id);
      });
    }

    todos.splice(todoIndex, 1);
    await saveTodos();

    return `✅ Deleted TODO: ${todo.title} (${args.id})`;
  },
});

// Tool: Get TODO details
server.addTool({
  name: "get_todo",
  description: "Get detailed information about a specific TODO",
  parameters: z.object({
    id: z.string().describe("The ID of the TODO to retrieve"),
  }),
  execute: async (args) => {
    const todo = todos.find((t) => t.id === args.id);
    if (!todo) {
      return `❌ TODO with ID ${args.id} not found.`;
    }

    let result = formatTodoForDisplay(todo);

    // Add dependency details
    if (todo.dependencies.length > 0) {
      result += "\n**Dependencies:**\n";
      for (const depId of todo.dependencies) {
        const depTodo = todos.find((t) => t.id === depId);
        if (depTodo) {
          result += `  - ${depTodo.status === "completed" ? "✅" : "⏳"} ${
            depTodo.title
          } (${depId})\n`;
        } else {
          result += `  - ❓ Unknown dependency (${depId})\n`;
        }
      }
    }

    // Add dependents
    const dependents = todos.filter((t) => t.dependencies.includes(args.id));
    if (dependents.length > 0) {
      result += "\n**TODOs that depend on this:**\n";
      dependents.forEach((dep) => {
        result += `  - ${dep.title} (${dep.id})\n`;
      });
    }

    // Add metadata if present
    if (Object.keys(todo.metadata).length > 0) {
      result += "\n**Metadata:**\n";
      Object.entries(todo.metadata).forEach(([key, value]) => {
        result += `  - ${key}: ${JSON.stringify(value)}\n`;
      });
    }

    return result;
  },
});

// Tool: Search TODOs
server.addTool({
  name: "search_todos",
  description: "Search TODOs by title, description, or metadata",
  parameters: z.object({
    query: z
      .string()
      .describe("Search query (searches in title, description, and metadata)"),
    caseSensitive: z
      .boolean()
      .default(false)
      .describe("Whether search should be case sensitive"),
  }),
  execute: async (args) => {
    const query = args.caseSensitive ? args.query : args.query.toLowerCase();

    const matchingTodos = todos.filter((todo) => {
      const title = args.caseSensitive ? todo.title : todo.title.toLowerCase();
      const description = args.caseSensitive
        ? todo.description || ""
        : (todo.description || "").toLowerCase();
      const metadataStr = args.caseSensitive
        ? JSON.stringify(todo.metadata)
        : JSON.stringify(todo.metadata).toLowerCase();

      return (
        title.includes(query) ||
        description.includes(query) ||
        metadataStr.includes(query) ||
        todo.tags.some((tag) =>
          (args.caseSensitive ? tag : tag.toLowerCase()).includes(query)
        )
      );
    });

    if (matchingTodos.length === 0) {
      return `🔍 No TODOs found matching "${args.query}"`;
    }

    const summary = `🔍 Found ${matchingTodos.length} TODO(s) matching "${args.query}"\n\n`;
    return summary + matchingTodos.map(formatTodoForDisplay).join("\n");
  },
});

// Tool: Generate progress report
server.addTool({
  name: "generate_report",
  description: "Generate a comprehensive progress report",
  parameters: z.object({
    includeCompleted: z
      .boolean()
      .default(true)
      .describe("Include completed TODOs in the report"),
    groupBy: z
      .enum(["status", "priority", "tag"])
      .default("status")
      .describe("How to group the report"),
    timeframe: z
      .enum(["all", "today", "week", "month"])
      .default("all")
      .describe("Time frame for the report"),
  }),
  execute: async (args) => {
    let reportTodos = [...todos];

    // Apply timeframe filter
    if (args.timeframe !== "all") {
      const now = new Date();
      const cutoffDate = new Date();

      switch (args.timeframe) {
        case "today":
          cutoffDate.setHours(0, 0, 0, 0);
          break;
        case "week":
          cutoffDate.setDate(now.getDate() - 7);
          break;
        case "month":
          cutoffDate.setMonth(now.getMonth() - 1);
          break;
      }

      reportTodos = reportTodos.filter(
        (todo) =>
          new Date(todo.updatedAt) >= cutoffDate ||
          new Date(todo.createdAt) >= cutoffDate
      );
    }

    if (!args.includeCompleted) {
      reportTodos = reportTodos.filter((todo) => todo.status !== "completed");
    }

    let report = `📊 **Progress Report** (${args.timeframe}, ${reportTodos.length} TODOs)\n\n`;

    // Overall statistics
    const stats = {
      total: reportTodos.length,
      pending: reportTodos.filter((t) => t.status === "pending").length,
      inProgress: reportTodos.filter((t) => t.status === "in-progress").length,
      completed: reportTodos.filter((t) => t.status === "completed").length,
      blocked: reportTodos.filter((t) => t.status === "blocked").length,
      avgProgress:
        reportTodos.length > 0
          ? Math.round(
              reportTodos.reduce((sum, t) => sum + t.progress, 0) /
                reportTodos.length
            )
          : 0,
    };

    report += `**Overall Statistics:**\n`;
    report += `- Total TODOs: ${stats.total}\n`;
    report += `- Pending: ${stats.pending} | In Progress: ${stats.inProgress} | Completed: ${stats.completed} | Blocked: ${stats.blocked}\n`;
    report += `- Average Progress: ${stats.avgProgress}%\n\n`;

    // Group by specified field
    const groups: Record<string, Todo[]> = {};

    reportTodos.forEach((todo) => {
      let groupKey: string;

      switch (args.groupBy) {
        case "status":
          groupKey = todo.status;
          break;
        case "priority":
          groupKey = todo.priority;
          break;
        case "tag":
          if (todo.tags.length === 0) {
            groupKey = "untagged";
          } else {
            // For tags, we'll group by first tag for simplicity
            groupKey = todo.tags[0];
          }
          break;
        default:
          groupKey = todo.status;
      }

      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(todo);
    });

    // Generate grouped report
    Object.entries(groups).forEach(([groupName, groupTodos]) => {
      const groupProgress =
        groupTodos.length > 0
          ? Math.round(
              groupTodos.reduce((sum, t) => sum + t.progress, 0) /
                groupTodos.length
            )
          : 0;

      report += `**${groupName.toUpperCase()} (${
        groupTodos.length
      } TODOs, ${groupProgress}% avg progress):**\n`;
      groupTodos.forEach((todo) => {
        report += `  - ${todo.progress}% ${todo.title} (${todo.id})\n`;
      });
      report += "\n";
    });

    // Overdue items
    const now = new Date();
    const overdueTodos = reportTodos.filter(
      (todo) =>
        todo.dueDate &&
        new Date(todo.dueDate) < now &&
        todo.status !== "completed"
    );

    if (overdueTodos.length > 0) {
      report += `⚠️ **Overdue TODOs (${overdueTodos.length}):**\n`;
      overdueTodos.forEach((todo) => {
        const daysOverdue = Math.floor(
          (now.getTime() - new Date(todo.dueDate!).getTime()) /
            (1000 * 60 * 60 * 24)
        );
        report += `  - ${todo.title} (${daysOverdue} days overdue)\n`;
      });
      report += "\n";
    }

    // Blocked items that might be unblocked
    const blockedTodos = reportTodos.filter(
      (todo) => todo.status === "blocked"
    );
    if (blockedTodos.length > 0) {
      report += `🚫 **Blocked TODOs (${blockedTodos.length}):**\n`;
      blockedTodos.forEach((todo) => {
        const completedDeps = todo.dependencies.filter((depId) => {
          const dep = todos.find((t) => t.id === depId);
          return dep && dep.status === "completed";
        });
        const totalDeps = todo.dependencies.length;

        if (totalDeps === 0) {
          report += `  - ${todo.title} (no dependencies - check if still blocked)\n`;
        } else {
          report += `  - ${todo.title} (${completedDeps.length}/${totalDeps} dependencies completed)\n`;
        }
      });
    }

    return report;
  },
});

// Tool: Get statistics
server.addTool({
  name: "get_stats",
  description: "Get quick statistics about TODOs",
  execute: async () => {
    const total = todos.length;
    if (total === 0) {
      return "📊 No TODOs found.";
    }

    const byStatus = {
      pending: todos.filter((t) => t.status === "pending").length,
      inProgress: todos.filter((t) => t.status === "in-progress").length,
      completed: todos.filter((t) => t.status === "completed").length,
      blocked: todos.filter((t) => t.status === "blocked").length,
    };

    const byPriority = {
      urgent: todos.filter((t) => t.priority === "urgent").length,
      high: todos.filter((t) => t.priority === "high").length,
      medium: todos.filter((t) => t.priority === "medium").length,
      low: todos.filter((t) => t.priority === "low").length,
    };

    const avgProgress = Math.round(
      todos.reduce((sum, t) => sum + t.progress, 0) / total
    );

    const now = new Date();
    const overdue = todos.filter(
      (t) => t.dueDate && new Date(t.dueDate) < now && t.status !== "completed"
    ).length;

    let stats = `📊 **TODO Statistics**\n\n`;
    stats += `**Total TODOs:** ${total}\n\n`;
    stats += `**By Status:**\n`;
    stats += `- ⏳ Pending: ${byStatus.pending}\n`;
    stats += `- 🔄 In Progress: ${byStatus.inProgress}\n`;
    stats += `- ✅ Completed: ${byStatus.completed}\n`;
    stats += `- 🚫 Blocked: ${byStatus.blocked}\n\n`;
    stats += `**By Priority:**\n`;
    stats += `- 🔴 Urgent: ${byPriority.urgent}\n`;
    stats += `- 🟠 High: ${byPriority.high}\n`;
    stats += `- 🟡 Medium: ${byPriority.medium}\n`;
    stats += `- 🟢 Low: ${byPriority.low}\n\n`;
    stats += `**Progress:** ${avgProgress}% average\n`;
    if (overdue > 0) {
      stats += `**⚠️ Overdue:** ${overdue} TODOs\n`;
    }

    return stats;
  },
});

// Tool: Get current project info
server.addTool({
  name: "get_project_info",
  description: "Get current project workspace information",
  execute: async () => {
    const dataDir = await getProjectDataDir();
    const todosFile = await getProjectTodosFile();
    const projectId = await getProjectId();
    const totalTodos = todos.length;

    return (
      `📁 **Current Project Workspace**\n\n` +
      `- Project ID: ${projectId}\n` +
      `- Data Directory: ${dataDir}\n` +
      `- TODOs File: ${todosFile}\n` +
      `- Total TODOs: ${totalTodos}\n\n` +
      `💡 **Project Management:**\n` +
      `Each project has its own isolated TODO storage to prevent data mixup.\n` +
      `• Use list_projects to see all existing project workspaces\n` +
      `• Use switch_project to create a new project or switch between existing ones\n` +
      `• Project names should be descriptive (e.g., 'my-app', 'research', 'personal')\n` +
      `• All TODO operations work within the current active project only\n` +
      `• ⚠️ Projects cannot be deleted through this API - only individual TODOs can be deleted`
    );
  },
});

// Tool: Switch project workspace
server.addTool({
  name: "switch_project",
  description:
    "Switch to a different project workspace or create a new one. IMPORTANT: You must call this tool to set up a project before creating any TODOs. Recommendation: Call list_projects first to see existing workspaces and avoid creating duplicates. Each project isolates its TODO data completely.",
  parameters: z.object({
    projectId: z
      .string()
      .describe(
        "The project ID to switch to or create. Use descriptive names like 'my-app', 'research-project', 'personal-tasks', etc. Check list_projects first to see existing options."
      ),
  }),
  execute: async (args) => {
    // Save current project data first
    await saveTodos();

    // Switch to new project
    currentProjectId = args.projectId;

    // Load TODOs for the new project
    await loadTodos();

    const dataDir = await getProjectDataDir();
    const totalTodos = todos.length;

    return (
      `✅ **Switched to Project: ${currentProjectId}**\n\n` +
      `- Data Directory: ${dataDir}\n` +
      `- TODOs in this project: ${totalTodos}\n\n` +
      `🔄 All TODO operations will now affect this project workspace.`
    );
  },
});

// Tool: List available projects
server.addTool({
  name: "list_projects",
  description: "List all available project workspaces. RECOMMENDED: Call this first to see existing projects before creating new ones with switch_project.",
  execute: async () => {
    try {
      const baseDataDir = join(
        process.env.HOME || process.cwd(),
        ".agent-todos"
      );

      let projects: string[] = [];
      try {
        const projectDirs = await readdir(baseDataDir, { withFileTypes: true });
        projects = projectDirs
          .filter((dirent) => dirent.isDirectory())
          .map((dirent) => dirent.name);
      } catch {
        // Base directory doesn't exist yet
      }

      if (projects.length === 0) {
        return (
          `📁 **No project workspaces found**\n\n` +
          `🚀 **Getting Started:**\n` +
          `1. Call switch_project with a descriptive project name (e.g., 'my-app', 'research')\n` +
          `2. This will create a new isolated project workspace\n` +
          `3. Then you can create TODOs that belong to that project\n\n` +
          `Current default project: "${currentProjectId}" (will be created when first TODO is added)\n\n` +
          `💡 **Why use projects?** Each project keeps its TODOs completely separate!\n` +
          `⚠️ **Note:** Projects cannot be deleted through this API - only individual TODOs can be deleted.`
        );
      }

      let result = `📁 **Available Project Workspaces**\n\n`;

      for (const projectId of projects) {
        const isActive = projectId === currentProjectId ? " (ACTIVE)" : "";
        const projectFile = join(baseDataDir, projectId, "todos.json");

        try {
          const data = await readFile(projectFile, "utf-8");
          const projectTodos = JSON.parse(data);
          result += `- ${projectId}${isActive} (${projectTodos.length} TODOs)\n`;
        } catch {
          result += `- ${projectId}${isActive} (0 TODOs)\n`;
        }
      }

      result += `\n💡 **Tips:**\n`;
      result += `• Use switch_project to create new projects or switch between existing ones\n`;
      result += `• Choose descriptive project names that reflect your actual work\n`;
      result += `• ⚠️ Projects cannot be deleted through this API - plan accordingly!`;
      return result;
    } catch (error) {
      return `❌ Error listing projects: ${error}`;
    }
  },
});

// Start the server
server.start({
  transportType: "stdio",
});

console.error("Agent TODO Manager MCP Server started");
