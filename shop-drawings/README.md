# SHOPGEN Shop Drawings Integration

This directory contains the shop drawing generation service that integrates the SHOPGEN drawing functionality into the quoting tool.

## Features

- **Elevation Drawings**: Technical front-view drawings with precise dimensions
- **Plan Views**: Top-down architectural views with door swing patterns
- **Door Schedules**: Detailed component tables with specifications
- **100% SHOPGEN Compatibility**: Maintains exact proportions and visual accuracy

## Setup

1. Run the setup script to install Python dependencies:
   ```bash
   cd shop-drawings
   ./setup.sh
   ```

2. Test the drawing service:
   ```bash
   python test_drawing.py
   ```

## Usage

The drawing service is automatically called by the Next.js API endpoints:

- **Elevation**: `GET /api/drawings/elevation/[openingId]`
- **Plan View**: `GET /api/drawings/plan/[openingId]`

### From the UI

1. Navigate to any project in the quoting tool
2. Click the "Shop Drawings" button next to any opening
3. View elevation, plan, and schedule tabs
4. Download individual drawings as high-resolution PNGs

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │───▶│   Next.js API    │───▶│   Python        │
│   React/Next.js │    │   /api/drawings  │    │   drawing_gen   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### Data Flow

1. User clicks "Shop Drawings" button
2. Frontend calls Next.js API with opening ID
3. API fetches opening data from database (panels, products, directions)
4. API spawns Python process with opening data
5. Python generates drawings using matplotlib
6. Images returned as base64 strings
7. Frontend displays drawings in modal viewer

## Configuration

### Panel Types
- **Fixed Panel**: Standard glazing with frame details
- **Swing Door**: Shows handle placement and swing direction
- **Sliding Door**: Displays track, stiles, and slide direction

### Directions (matching SHOPGEN exactly)
- **Swing Directions**: "Left In", "Right In", "Left Out", "Right Out"  
- **Sliding Directions**: "Left", "Right"

### Dimensions
All measurements in inches, matching architectural standards:
- Frame thickness: 0.75"
- Glass stop: 0.5" 
- Handle length: 6"
- Dimension line offset: 12"

## File Structure

```
shop-drawings/
├── drawing_generator.py    # Main drawing service (SHOPGEN functions)
├── requirements.txt        # Python dependencies
├── setup.sh               # Setup script
├── test_drawing.py        # Test suite
└── README.md              # This file
```

## API Response Format

### Elevation Response
```json
{
  "success": true,
  "elevation_image": "base64_image_data",
  "door_schedule": {
    "headers": ["Panel #", "Type", "Width (in)", "Direction", "Glass"],
    "rows": [["1", "Fixed", "36", "-", "Clear"], ...]
  },
  "total_width": 102,
  "height": 96
}
```

### Plan Response
```json
{
  "success": true,
  "plan_image": "base64_image_data"
}
```

## Error Handling

- Invalid opening data returns structured error response
- Plan views require at least one swing door
- Missing dependencies handled gracefully
- 30-second timeout for drawing generation

## Dependencies

- **matplotlib**: Drawing and plotting library
- **numpy**: Mathematical operations
- **Python 3.8+**: Required runtime

## Troubleshooting

### Common Issues

1. **Python not found**: Ensure Python 3 is installed and accessible
2. **Dependencies missing**: Run `./setup.sh` to install requirements
3. **Permission denied**: Make sure `setup.sh` is executable (`chmod +x setup.sh`)
4. **Drawing timeout**: Large or complex openings may take longer to render

### Testing

Run the test suite to verify functionality:
```bash
python test_drawing.py
```

Expected output:
- ✓ Elevation drawing: PASS
- ✓ Plan drawing: PASS  
- ✓ Fixed panel only: PASS

## Future Enhancements

- 3D isometric views
- Custom color schemes
- Batch drawing generation
- DXF/CAD export formats
- Integration with BOM pricing