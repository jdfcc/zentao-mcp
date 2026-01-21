# Zentao MCP Server

MCP server for integrating with Zentao project management system. Provides tools to query projects and bugs.

## Features

- Query project lists with filtering
- Query bug lists with multi-dimensional filtering
- Get detailed bug information
- Automatic authentication with token caching
- Support for both Markdown and JSON response formats

## Prerequisites

- Node.js 18 or higher
- Zentao instance with API access

## Installation

```bash
# Install dependencies
npm install

# Build the project
npm run build
```

## Configuration

Create a `.env` file in the project root:

```env
ZENTAO_URL=https://your-zentao-domain.com
ZENTAO_USERNAME=your-username
ZENTAO_PASSWORD=your-password
ZENTAO_DEFAULT_PROJECT=1

# Optional
TTL_SECONDS=3600
LOG_LEVEL=info
```

### Environment Variables

- `ZENTAO_URL`: Full URL of your Zentao instance
- `ZENTAO_USERNAME`: Username for authentication
- `ZENTAO_PASSWORD`: Password for authentication
- `ZENTAO_DEFAULT_PROJECT`: Default project ID for queries (optional)
- `TTL_SECONDS`: Token cache time-to-live in seconds (default: 3600)
- `LOG_LEVEL`: Logging level - info/debug/error (default: info)

## Usage

### Start the Server

```bash
# Production mode
npm start

# Development mode (with auto-reload)
npm run dev
```

### MCP Inspector Testing

```bash
# Build first
npm run build

# Test with MCP Inspector
npx @modelcontextprotocol/inspector node dist/index.js
```

### Configure in Claude Desktop

Add to your Claude Desktop configuration file:

```json
{
  "mcpServers": {
    "zentao": {
      "command": "node",
      "args": ["/absolute/path/to/zentao-mcp-server/dist/index.js"],
      "env": {
        "ZENTAO_URL": "https://your-zentao.com",
        "ZENTAO_USERNAME": "your-username",
        "ZENTAO_PASSWORD": "your-password",
        "ZENTAO_DEFAULT_PROJECT": "1"
      }
    }
  }
}
```

## Available Tools

### `zentao_list_projects`
Query project lists with optional filtering.

Parameters:
- `limit`: Maximum results to return (default: 20)
- `offset`: Pagination offset (default: 0)
- `status`: Filter by project status

### `zentao_list_bugs`
Query bug lists with comprehensive filtering.

Parameters:
- `projectId`: Project ID (uses default if not specified)
- `status`: Filter by bug status (active/resolved/closed)
- `severity`: Filter by severity (1-4)
- `priority`: Filter by priority (1-4)
- `assignedTo`: Filter by assigned user
- `openedBy`: Filter by creator
- `startDate`: Filter by creation date start (YYYY-MM-DD)
- `endDate`: Filter by creation date end (YYYY-MM-DD)
- `limit`: Maximum results (default: 20)
- `offset`: Pagination offset (default: 0)
- `orderBy`: Sort order
- `response_format`: Output format (markdown/json, default: markdown)

### `zentao_get_bug_details`
Get detailed bug information by bug ID.

Parameters:
- `bugId`: Bug ID (required)
- `response_format`: Output format (markdown/json, default: markdown)

## Error Handling

The server provides clear, actionable error messages:

- **Authentication Error**: Check credentials and ZENTAO_URL
- **Network Error**: Check network connection and firewall
- **Parameter Error**: Verify IDs and date formats
- **API Error**: Check permissions and contact administrator

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Clean build artifacts
npm run clean
```

## Troubleshooting

### Connection Issues
- Verify ZENTAO_URL is correct and accessible
- Check network connectivity
- Verify firewall settings

### Authentication Issues
- Confirm username and password are correct
- Check if the account requires password change
- Verify account has sufficient permissions

### API Errors
- Check Zentao server logs
- Verify API version compatibility
- Contact system administrator if issues persist

## License

MIT
