#!/bin/bash

# Setup script for SHOPGEN Drawing Service
echo "Setting up SHOPGEN Drawing Service..."

# Check if Python 3 is installed
if ! command -v python3 &> /dev/null; then
    echo "Error: Python 3 is not installed. Please install Python 3 first."
    exit 1
fi

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Install requirements
echo "Installing Python dependencies..."
pip install -r requirements.txt

echo "Setup complete!"
echo ""
echo "To activate the virtual environment manually, run:"
echo "source shop-drawings/venv/bin/activate"
echo ""
echo "To test the drawing service, run:"
echo "cd shop-drawings && python drawing_generator.py"