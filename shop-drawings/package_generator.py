#!/usr/bin/env python3

import sys
import json
import base64
import io
from datetime import datetime, timedelta
import subprocess
import os

# Try to import matplotlib, fall back to simple PDF if not available
try:
    import matplotlib.pyplot as plt
    import matplotlib.patches as patches
    from matplotlib.backends.backend_pdf import PdfPages
    import numpy as np
    MATPLOTLIB_AVAILABLE = True
except ImportError as e:
    print(f"Matplotlib not available: {e}", file=sys.stderr)
    MATPLOTLIB_AVAILABLE = False

def generate_drawing_from_external(drawing_type, opening_data):
    """Call the external drawing generator and return the result"""
    try:
        # Get the path to the drawing generator script
        script_path = os.path.join(os.path.dirname(__file__), 'drawing_generator.py')
        
        # Prepare input data
        input_data = {
            'type': drawing_type,
            'data': opening_data
        }
        
        # Call the drawing generator
        result = subprocess.run(
            ['python3', script_path],
            input=json.dumps(input_data),
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode != 0:
            print(f"Drawing generator error: {result.stderr}", file=sys.stderr)
            return None
            
        # Parse the result
        output_data = json.loads(result.stdout)
        if output_data.get('success'):
            return output_data
        else:
            print(f"Drawing generator failed: {output_data.get('error', 'Unknown error')}", file=sys.stderr)
            return None
            
    except Exception as e:
        print(f"Error calling drawing generator: {e}", file=sys.stderr)
        return None

def create_shop_drawing_page(opening_data, pdf_pages):
    """Create a single page with door schedule (top left), plan view (top right), and elevation (center/bottom)"""
    
    # Generate elevation and plan drawings using the external drawing generator
    elevation_data = generate_drawing_from_external('elevation', opening_data)
    plan_data = generate_drawing_from_external('plan', opening_data)
    
    # Create figure for landscape orientation
    fig = plt.figure(figsize=(11, 8.5))  # Landscape 11x8.5 inches
    
    # Clear any existing plots
    plt.clf()
    
    # Add opening title
    fig.suptitle(f'Shop Drawing - Opening {opening_data["name"]}', fontsize=16, fontweight='bold')
    
    # Create layout: door schedule (top left), plan view (top right), elevation (bottom center)
    gs = fig.add_gridspec(2, 2, height_ratios=[0.4, 1], width_ratios=[1, 1], 
                         hspace=0.3, wspace=0.3, left=0.1, right=0.95, top=0.9, bottom=0.1)
    
    # Door schedule (top left) - smaller
    ax_schedule = fig.add_subplot(gs[0, 0])
    if elevation_data and elevation_data.get('door_schedule'):
        draw_door_schedule_table(ax_schedule, elevation_data['door_schedule'])
    else:
        # Generate a basic door schedule from opening data
        door_schedule = generate_door_schedule_from_opening(opening_data)
        if door_schedule:
            draw_door_schedule_table(ax_schedule, door_schedule)
        else:
            ax_schedule.text(0.5, 0.5, 'Door schedule not available', ha='center', va='center', transform=ax_schedule.transAxes)
            ax_schedule.axis('off')
    ax_schedule.set_title('Opening Schedule', fontsize=10, fontweight='bold')
    
    # Plan view (top right)
    ax_plan = fig.add_subplot(gs[0, 1])
    if plan_data and plan_data.get('plan_image'):
        # Decode and display plan image
        img_data = base64.b64decode(plan_data['plan_image'])
        img = plt.imread(io.BytesIO(img_data), format='png')
        ax_plan.imshow(img)
        ax_plan.axis('off')
    else:
        ax_plan.text(0.5, 0.5, 'Plan view not available', ha='center', va='center', transform=ax_plan.transAxes)
        ax_plan.axis('off')
    ax_plan.set_title('Plan View (Top-Down)', fontsize=10, fontweight='bold')
    
    # Elevation view (bottom center, spanning both columns)
    ax_elevation = fig.add_subplot(gs[1, :])
    if elevation_data and elevation_data.get('elevation_image'):
        # Decode and display elevation image
        img_data = base64.b64decode(elevation_data['elevation_image'])
        img = plt.imread(io.BytesIO(img_data), format='png')
        ax_elevation.imshow(img)
        ax_elevation.axis('off')
    else:
        ax_elevation.text(0.5, 0.5, 'Elevation view not available', ha='center', va='center', transform=ax_elevation.transAxes)
        ax_elevation.axis('off')
    ax_elevation.set_title('Elevation View', fontsize=12, fontweight='bold')
    
    # Save to PDF
    pdf_pages.savefig(fig, bbox_inches='tight')
    plt.close(fig)

def generate_door_schedule_from_opening(opening_data):
    """Generate a basic door schedule from opening data"""
    try:
        panels = opening_data.get('panels', [])
        if not panels:
            return None
        
        # Create headers similar to typical door schedules
        headers = ['Item', 'Type', 'Size', 'Glass', 'Hardware']
        rows = []
        
        for i, panel in enumerate(panels):
            # Get panel info
            panel_type = panel.get('type', 'Panel')
            width = panel.get('width', 0)
            height = panel.get('height', 0)
            glass_type = panel.get('glassType', 'Clear')
            
            # Extract hardware info if available
            hardware = 'Standard'
            if panel.get('componentInstance') and panel['componentInstance'].get('subOptionSelections'):
                try:
                    selections = json.loads(panel['componentInstance']['subOptionSelections'])
                    product = panel['componentInstance'].get('product', {})
                    
                    hardware_items = []
                    for category_id, option_id in selections.items():
                        if option_id:
                            for pso in product.get('productSubOptions', []):
                                if str(pso['category']['id']) == str(category_id):
                                    category_name = pso['category']['name'].lower()
                                    if any(hw_term in category_name for hw_term in ['hardware', 'handle', 'lock', 'hinge']):
                                        for option in pso['category']['individualOptions']:
                                            if option['id'] == option_id:
                                                hardware_items.append(f"{pso['category']['name']}: {option['name']}")
                                                break
                                        break
                                    break
                    
                    if hardware_items:
                        hardware = ', '.join(hardware_items)
                except:
                    pass
            
            # Format the row
            row = [
                str(i + 1),  # Item number
                panel_type,
                f'{width}" x {height}"',
                glass_type,
                hardware
            ]
            rows.append(row)
        
        return {
            'headers': headers,
            'rows': rows
        }
    except Exception as e:
        print(f"Error generating door schedule: {e}", file=sys.stderr)
        return None

def draw_door_schedule_table(ax, door_schedule_data):
    """Draw door schedule table matching the DrawingViewer format"""
    ax.axis('off')
    
    if not door_schedule_data or not door_schedule_data.get('headers') or not door_schedule_data.get('rows'):
        ax.text(0.5, 0.5, 'No door schedule data', ha='center', va='center', transform=ax.transAxes)
        return
    
    headers = door_schedule_data['headers']
    rows = door_schedule_data['rows']
    
    # Create table matching DrawingViewer style with adjusted column widths
    table = ax.table(cellText=rows,
                    colLabels=headers,
                    cellLoc='left',
                    loc='center',
                    bbox=[0, 0, 1, 1])
    
    # Adjust column widths - make description column much wider
    if len(headers) >= 3:  # Assuming description is typically the 3rd column or similar
        table.auto_set_column_width([0, 1, 2, 3, 4])  # Auto-adjust all columns
        # Set specific widths for better layout - description gets most space
        for i, width in enumerate([0.6, 0.8, 3.5, 1.2, 0.6]):  # Much wider description column
            if i < len(headers):
                for j in range(len(rows) + 1):  # +1 for header
                    table[(j, i)].set_width(width / len(headers))
    
    # Style the table to match DrawingViewer (much smaller cells)
    table.auto_set_font_size(False)
    table.set_fontsize(7)
    table.scale(1, 0.8)  # Much shorter cells - just slightly taller than text
    
    # Header styling (gray background like DrawingViewer)
    for i in range(len(headers)):
        table[(0, i)].set_facecolor('#F9FAFB')  # bg-gray-50
        table[(0, i)].set_text_props(weight='bold', color='#374151')  # text-gray-700
        table[(0, i)].set_edgecolor('#D1D5DB')  # border-gray-300
    
    # Row styling to match DrawingViewer
    for i in range(1, len(rows) + 1):
        for j in range(len(headers)):
            table[(i, j)].set_text_props(color='#111827', wrap=True)  # text-gray-900 with wrapping
            table[(i, j)].set_edgecolor('#E5E7EB')  # border-gray-200
            if i % 2 == 0:
                table[(i, j)].set_facecolor('#FFFFFF')  # Keep white background for simplicity
            else:
                table[(i, j)].set_facecolor('#FFFFFF')


def create_bom_page(project_data, pdf_pages):
    """Create BOM (Bill of Materials) page"""
    
    fig = plt.figure(figsize=(11, 8.5))  # Landscape
    plt.clf()
    
    fig.suptitle(f'Bill of Materials - {project_data["name"]}', fontsize=16, fontweight='bold')
    
    ax = fig.add_subplot(111)
    ax.axis('off')
    
    # Collect all BOM items from all openings
    all_bom_items = {}
    
    for opening in project_data.get('openings', []):
        for panel in opening.get('panels', []):
            if panel.get('componentInstance') and panel['componentInstance'].get('product'):
                product = panel['componentInstance']['product']
                
                # Add product BOMs
                for bom_item in product.get('productBOMs', []):
                    part_key = f"{bom_item.get('partName', 'Unknown')} ({bom_item.get('unit', 'ea')})"
                    
                    if part_key not in all_bom_items:
                        all_bom_items[part_key] = {
                            'partName': bom_item.get('partName', 'Unknown'),
                            'partType': bom_item.get('partType', 'Material'),
                            'description': bom_item.get('description', ''),
                            'unit': bom_item.get('unit', 'ea'),
                            'quantity': 0,
                            'cost': bom_item.get('cost', 0)
                        }
                    
                    # Calculate quantity based on formula or use default
                    qty = bom_item.get('quantity', 1)
                    if bom_item.get('formula'):
                        # Simple formula evaluation for width-based calculations
                        if 'width' in bom_item['formula'].lower():
                            qty = (panel.get('width', 0) or 0) / 12  # Convert inches to feet
                        elif 'height' in bom_item['formula'].lower():
                            qty = (panel.get('height', 0) or 0) / 12
                    
                    all_bom_items[part_key]['quantity'] += qty
    
    if not all_bom_items:
        ax.text(0.5, 0.5, 'No BOM items found', ha='center', va='center', transform=ax.transAxes, fontsize=14)
        pdf_pages.savefig(fig, bbox_inches='tight')
        plt.close(fig)
        return
    
    # Prepare table data
    col_labels = ["Part Name", "Type", "Description", "Quantity", "Unit", "Unit Cost", "Total Cost"]
    cell_text = []
    total_cost = 0
    
    for item_data in all_bom_items.values():
        unit_cost = item_data['cost'] or 0  # Handle None values
        total_item_cost = item_data['quantity'] * unit_cost
        total_cost += total_item_cost
        
        cell_text.append([
            item_data['partName'],
            item_data['partType'],
            item_data['description'][:30] + ('...' if len(item_data['description']) > 30 else ''),
            f"{item_data['quantity']:.2f}",
            item_data['unit'],
            f"${unit_cost:.2f}",
            f"${total_item_cost:.2f}"
        ])
    
    # Add total row
    cell_text.append(['', '', '', '', '', 'TOTAL:', f"${total_cost:.2f}"])
    
    # Create table
    table = ax.table(cellText=cell_text,
                    colLabels=col_labels,
                    cellLoc='left',
                    loc='center',
                    bbox=[0, 0.1, 1, 0.8])
    
    # Style the table
    table.auto_set_font_size(False)
    table.set_fontsize(8)
    table.scale(1, 1.5)
    
    # Header styling
    for i in range(len(col_labels)):
        table[(0, i)].set_facecolor('#4472C4')
        table[(0, i)].set_text_props(weight='bold', color='white')
    
    # Total row styling
    total_row = len(cell_text)
    for i in range(len(col_labels)):
        table[(total_row, i)].set_facecolor('#FFE699')
        table[(total_row, i)].set_text_props(weight='bold')
    
    # Alternate row colors
    for i in range(1, len(cell_text)):
        for j in range(len(col_labels)):
            if i % 2 == 0 and i != total_row:
                table[(i, j)].set_facecolor('#F2F2F2')
    
    pdf_pages.savefig(fig, bbox_inches='tight')
    plt.close(fig)

def get_actual_quote_data(project_data):
    """Generate quote data using EXACT logic from /api/projects/[id]/quote/route.ts"""
    quote_items = []
    
    for opening in project_data.get('openings', []):
        # Calculate opening dimensions (sum of panel widths, max height) - EXACT API logic
        total_width = sum(panel.get('width', 0) for panel in opening.get('panels', []))
        max_height = max([panel.get('height', 0) for panel in opening.get('panels', [])], default=0)
        
        # Get hardware and glass types - EXACT API logic
        hardware_items = []
        glass_types = set()
        total_hardware_price = 0
        
        for panel in opening.get('panels', []):
            if panel.get('glassType') and panel.get('glassType') != 'N/A':
                glass_types.add(panel['glassType'])
            
            # Extract hardware from component options - EXACT API logic
            if panel.get('componentInstance') and panel['componentInstance'].get('subOptionSelections'):
                try:
                    selections = json.loads(panel['componentInstance']['subOptionSelections'])
                    product = panel['componentInstance'].get('product', {})
                    
                    # Resolve hardware options - EXACT API logic
                    for category_id, option_id in selections.items():
                        if option_id:
                            for pso in product.get('productSubOptions', []):
                                if str(pso['category']['id']) == str(category_id):
                                    category_name = pso['category']['name'].lower()
                                    if any(hw_term in category_name for hw_term in ['hardware', 'handle', 'lock', 'hinge']):
                                        for option in pso['category']['individualOptions']:
                                            if option['id'] == option_id:
                                                hardware_items.append({
                                                    'name': f"{pso['category']['name']}: {option['name']}",
                                                    'price': option.get('price', 0)
                                                })
                                                total_hardware_price += option.get('price', 0)
                                                break
                                        break
                                    break
                except:
                    pass
        
        # Generate description - EXACT API logic
        panel_types = [panel['componentInstance']['product']['productType'] 
                      for panel in opening.get('panels', []) 
                      if panel.get('componentInstance')]
        
        type_count = {}
        for panel_type in panel_types:
            type_count[panel_type] = type_count.get(panel_type, 0) + 1
        
        description_parts = []
        for ptype, count in type_count.items():
            display_type = 'Swing Door' if ptype == 'SWING_DOOR' else \
                          'Sliding Door' if ptype == 'SLIDING_DOOR' else \
                          'Fixed Panel' if ptype == 'FIXED_PANEL' else \
                          '90° Corner' if ptype == 'CORNER_90' else ptype
            description_parts.append(f"{count} {display_type}{'s' if count > 1 else ''}")
        
        description = ', '.join(description_parts) or 'Custom Opening'
        
        # Format hardware - EXACT API logic
        hardware_text = 'Standard Hardware' if not hardware_items else \
                       ' • '.join([f"{item['name']} | +${item['price']:,.0f}" for item in hardware_items])
        
        quote_items.append({
            'openingId': opening.get('id'),
            'name': opening.get('name'),
            'description': description,
            'dimensions': f'{total_width}" W × {max_height}" H',
            'color': opening.get('finishColor', 'Standard'),
            'hardware': hardware_text,
            'hardwarePrice': total_hardware_price,
            'glassType': ', '.join(glass_types) or 'Clear',
            'price': opening.get('price', 0),
            'elevationImage': None  # Would be generated by miniature elevation
        })
    
    return {
        'success': True,
        'project': {
            'id': project_data.get('id'),
            'name': project_data.get('name'),
            'status': project_data.get('status'),
            'createdAt': project_data.get('createdAt'),
            'updatedAt': project_data.get('updatedAt')
        },
        'quoteItems': quote_items,
        'totalPrice': sum(item['price'] for item in quote_items)
    }

def create_quote_page(project_data, pdf_pages):
    """Create quote page IDENTICAL to QuoteView.tsx format"""
    
    # Get quote data in the exact same format as the API
    quote_data = get_actual_quote_data(project_data)
    
    fig = plt.figure(figsize=(11, 8.5))  # Landscape
    plt.clf()
    
    fig.suptitle('Project Quote', fontsize=20, fontweight='normal', y=0.95)
    
    ax = fig.add_subplot(111)
    ax.axis('off')
    
    # Project info header (matching QuoteView exact format)
    created_date = quote_data['project']['createdAt']
    if created_date:
        try:
            created_formatted = datetime.fromisoformat(created_date.replace('Z', '+00:00')).strftime('%-m/%-d/%Y')
        except:
            created_formatted = 'N/A'
    else:
        created_formatted = 'N/A'
    
    # Valid until date (30 days from now)
    valid_until = (datetime.now() + timedelta(days=30)).strftime('%-m/%-d/%Y')
    
    # Project info section (left side)
    project_info = f"""PROJECT: {quote_data['project']['name']}
STATUS: {quote_data['project']['status']}
CREATED: {created_formatted}"""
    
    ax.text(0.05, 0.85, project_info, transform=ax.transAxes, fontsize=10, 
           verticalalignment='top', fontweight='normal')
    
    # Quote info section (right side)
    quote_info = f"""OPENINGS: {len(quote_data['quoteItems'])}
VALID UNTIL: {valid_until}"""
    
    ax.text(0.75, 0.85, quote_info, transform=ax.transAxes, fontsize=10, 
           verticalalignment='top', fontweight='normal')
    
    # Create table with EXACT QuoteView format
    # Headers: Elevation | Opening | Specs | Hardware | Price
    col_labels = ["ELEVATION", "OPENING", "SPECS", "HARDWARE", "PRICE"]
    cell_text = []
    
    for item in quote_data['quoteItems']:
        # Opening details
        opening_text = f"Opening {item['name']}\n{item['description']}"
        
        # Specifications (exact QuoteView format)
        specs_text = f"DIMENSIONS {item['dimensions']}\nCOLOR {item['color'].upper()}\nGLASS {item['glassType'].upper()}"
        
        # Hardware (format like QuoteView)
        hardware_text = item['hardware']
        if hardware_text == 'Standard Hardware':
            hardware_text = 'Standard Hardware'
        else:
            # Truncate long hardware descriptions for PDF
            if len(hardware_text) > 50:
                hardware_text = hardware_text[:47] + "..."
        
        cell_text.append([
            'Elevation\nView',  # Placeholder for elevation thumbnail
            opening_text,
            specs_text,
            hardware_text,
            f"${item['price']:,}"
        ])
    
    # Create table
    table = ax.table(cellText=cell_text,
                    colLabels=col_labels,
                    cellLoc='left',
                    loc='center',
                    bbox=[0, 0.15, 1, 0.65])
    
    # Style the table to EXACTLY match QuoteView
    table.auto_set_font_size(False)
    table.set_fontsize(8)
    table.scale(1, 4)  # Tall rows like QuoteView
    
    # Header styling (BLACK background like QuoteView)
    for i in range(len(col_labels)):
        table[(0, i)].set_facecolor('#000000')
        table[(0, i)].set_text_props(weight='bold', color='white')
        table[(0, i)].set_edgecolor('#000000')
    
    # Row styling to match QuoteView
    for i in range(1, len(cell_text) + 1):
        for j in range(len(col_labels)):
            table[(i, j)].set_text_props(color='#111827', fontsize=8)
            table[(i, j)].set_edgecolor('#E5E7EB')
            # White background for all rows (like QuoteView)
            table[(i, j)].set_facecolor('#FFFFFF')
    
    # Total section at bottom (like QuoteView footer)
    total_text = f"This quote includes {len(quote_data['quoteItems'])} opening{'s' if len(quote_data['quoteItems']) != 1 else ''}"
    ax.text(0.05, 0.08, total_text, transform=ax.transAxes, fontsize=12, 
           verticalalignment='center', color='#6B7280')
    
    # Total price (large, right-aligned like QuoteView)
    total_price_text = f"${quote_data['totalPrice']:,}"
    ax.text(0.95, 0.08, total_price_text, transform=ax.transAxes, fontsize=24, 
           verticalalignment='center', horizontalalignment='right', fontweight='normal')
    
    # "Total Project Cost" label
    ax.text(0.95, 0.04, 'TOTAL PROJECT COST', transform=ax.transAxes, fontsize=8, 
           verticalalignment='center', horizontalalignment='right', color='#6B7280', fontweight='bold')
    
    pdf_pages.savefig(fig, bbox_inches='tight')
    plt.close(fig)

def generate_complete_package(project_data):
    """Generate complete project package PDF"""
    
    if not MATPLOTLIB_AVAILABLE:
        return {
            'success': False,
            'error': 'Matplotlib is not available. Please install matplotlib: pip install matplotlib'
        }
    
    try:
        # Create PDF in memory
        buffer = io.BytesIO()
        
        with PdfPages(buffer) as pdf_pages:
            # Create shop drawing pages for each opening
            for opening in project_data.get('openings', []):
                create_shop_drawing_page(opening, pdf_pages)
            
            # Create BOM page
            create_bom_page(project_data, pdf_pages)
            
            # Create quote page
            create_quote_page(project_data, pdf_pages)
        
        # Get PDF data
        buffer.seek(0)
        pdf_data = buffer.getvalue()
        buffer.close()
        
        # Encode as base64
        pdf_base64 = base64.b64encode(pdf_data).decode('utf-8')
        
        return {
            'success': True,
            'pdf_data': pdf_base64
        }
    except Exception as e:
        return {
            'success': False,
            'error': f'Error creating PDF: {str(e)}'
        }

def main():
    try:
        # Read input from stdin
        input_text = sys.stdin.read()
        if not input_text.strip():
            print(json.dumps({
                'success': False,
                'error': 'No input data received'
            }))
            return
            
        input_data = json.loads(input_text)
        
        if input_data.get('type') == 'complete_package':
            project_data = input_data.get('project')
            if not project_data:
                print(json.dumps({
                    'success': False,
                    'error': 'No project data provided'
                }))
                return
                
            result = generate_complete_package(project_data)
            print(json.dumps(result))
        else:
            print(json.dumps({
                'success': False,
                'error': f'Unknown request type: {input_data.get("type", "none")}'
            }))
            
    except json.JSONDecodeError as e:
        print(json.dumps({
            'success': False,
            'error': f'Invalid JSON input: {str(e)}'
        }))
    except Exception as e:
        print(json.dumps({
            'success': False,
            'error': f'Error generating package: {str(e)}'
        }))

if __name__ == '__main__':
    main()