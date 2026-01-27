#!/bin/bash

# Check if Cloud SQL proxy is already running on port 5432
if ! ss -tlnp | grep -q ':5432 '; then
    echo '🔄 Starting Cloud SQL proxy...'
    
    # Start the proxy in background
    nohup ~/cloud_sql_proxy -instances=linea-door-quoter:us-central1:door-app-staging=tcp:5432 > proxy.log 2>&1 &
    
    # Wait a moment for it to start
    sleep 3
    
    # Verify it started
    if ss -tlnp | grep -q ':5432 '; then
        echo '✅ Cloud SQL proxy started successfully on port 5432'
    else
        echo '❌ Failed to start Cloud SQL proxy'
        echo 'Check proxy.log for details:'
        tail -5 proxy.log
        exit 1
    fi
else
    echo '✅ Cloud SQL proxy already running on port 5432'
fi
