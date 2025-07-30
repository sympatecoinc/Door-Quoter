#!/bin/bash

# Monitor script for Next.js server
SERVER_PID=18769
LOG_FILE="server.log"

echo "Starting server monitoring..."
echo "Server PID: $SERVER_PID"
echo "Log file: $LOG_FILE"
echo "URL: http://localhost:3000"
echo "----------------------------------------"

# Function to check if server is running
check_server() {
    if ps -p $SERVER_PID > /dev/null 2>&1; then
        echo "✓ Server process is running (PID: $SERVER_PID)"
        return 0
    else
        echo "✗ Server process is not running"
        return 1
    fi
}

# Function to test API endpoint
test_api() {
    response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/dashboard)
    if [ "$response" = "200" ]; then
        echo "✓ API endpoint responding (HTTP $response)"
        return 0
    else
        echo "✗ API endpoint not responding (HTTP $response)"
        return 1
    fi
}

# Main monitoring loop
while true; do
    echo "$(date '+%Y-%m-%d %H:%M:%S') - Checking server status..."
    
    if check_server; then
        if test_api; then
            echo "✓ Server is healthy"
        else
            echo "⚠ Server running but API not responding"
        fi
    else
        echo "✗ SERVER CRASHED - Check logs for details"
        echo "Last 10 lines of log:"
        tail -10 $LOG_FILE
        break
    fi
    
    echo "----------------------------------------"
    sleep 30
done