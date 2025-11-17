#!/bin/bash

# Local development - no proxy needed!
# PostgreSQL is running in the Docker container on port 5432

echo '✅ Using local PostgreSQL database (no proxy needed)'
echo 'Database URL: postgresql://postgres:postgres@localhost:5432/door_quoter_dev'
