import json
import io
import base64
import matplotlib.pyplot as plt
import matplotlib.patches as patches
import numpy as np
from http.server import BaseHTTPRequestHandler

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        
        try:
            data = json.loads(post_data.decode('utf-8'))
            drawing_type = data.get('type', 'elevation')
            opening_data = data.get('data', {})
            
            if drawing_type == 'elevation':
                result = self.generate_elevation(opening_data)
            elif drawing_type == 'plan':
                result = self.generate_plan(opening_data)
            else:
                result = {'success': False, 'error': 'Invalid drawing type'}
            
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type')
            self.end_headers()
            
            self.wfile.write(json.dumps(result).encode('utf-8'))
            
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            
            error_response = {'success': False, 'error': str(e)}
            self.wfile.write(json.dumps(error_response).encode('utf-8'))
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def generate_elevation(self, opening_data):
        """Generate elevation drawing"""
        try:
            panels = opening_data.get('panels', [])
            if not panels:
                return {'success': False, 'error': 'No panels found'}
            
            # Calculate total width and height
            total_width = sum(panel.get('width', 0) for panel in panels)
            height = opening_data.get('height', 96)
            
            # Create figure
            fig, ax = plt.subplots(figsize=(12, 8))
            ax.set_xlim(0, total_width + 20)
            ax.set_ylim(0, height + 20)
            ax.set_aspect('equal')
            
            # Draw panels
            x_offset = 10
            door_schedule_rows = []
            
            for i, panel in enumerate(panels):
                panel_width = panel.get('width', 0)
                panel_height = panel.get('height', height)
                panel_type = panel.get('componentInstance', {}).get('product', {}).get('name', 'Unknown')
                direction = panel.get('direction', '-')
                
                # Draw panel frame
                frame_rect = patches.Rectangle(
                    (x_offset, 10), panel_width, panel_height,
                    linewidth=2, edgecolor='black', facecolor='lightgray', alpha=0.3
                )
                ax.add_patch(frame_rect)
                
                # Determine panel type for display
                display_type = 'Fixed'
                if 'swing' in panel_type.lower() or 'door' in panel_type.lower():
                    display_type = 'Swing Door'
                    # Draw handle
                    handle_x = x_offset + (panel_width * 0.9 if 'right' in direction.lower() else panel_width * 0.1)
                    handle_y = 10 + panel_height / 2
                    handle = patches.Circle((handle_x, handle_y), 2, facecolor='black')
                    ax.add_patch(handle)
                elif 'sliding' in panel_type.lower():
                    display_type = 'Sliding Door'
                
                # Add dimensions
                ax.annotate(f'{panel_width}"', 
                           xy=(x_offset + panel_width/2, 5), 
                           ha='center', va='top', fontsize=10, weight='bold')
                
                # Add to door schedule
                door_schedule_rows.append([
                    str(i + 1), 
                    display_type, 
                    f'{panel_width}"', 
                    direction if direction != '-' else '-',
                    'Clear'  # Default glass type
                ])
                
                x_offset += panel_width
            
            # Add overall dimension
            ax.annotate(f'{total_width}"', 
                       xy=(10 + total_width/2, height + 15), 
                       ha='center', va='bottom', fontsize=12, weight='bold')
            
            # Add height dimension
            ax.annotate(f'{height}"', 
                       xy=(5, 10 + height/2), 
                       ha='right', va='center', fontsize=12, weight='bold', rotation=90)
            
            # Style the plot
            ax.set_title('Elevation View', fontsize=16, weight='bold', pad=20)
            ax.axis('off')
            
            # Convert to base64
            buffer = io.BytesIO()
            plt.savefig(buffer, format='png', bbox_inches='tight', dpi=150, facecolor='white')
            plt.close()
            buffer.seek(0)
            image_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
            
            # Create door schedule
            door_schedule = {
                'headers': ['Panel #', 'Type', 'Width (in)', 'Direction', 'Glass'],
                'rows': door_schedule_rows
            }
            
            return {
                'success': True,
                'elevation_image': image_base64,
                'door_schedule': door_schedule,
                'total_width': total_width,
                'height': height
            }
            
        except Exception as e:
            return {'success': False, 'error': f'Failed to generate elevation: {str(e)}'}

    def generate_plan(self, opening_data):
        """Generate plan view drawing"""
        try:
            panels = opening_data.get('panels', [])
            if not panels:
                return {'success': False, 'error': 'No panels found'}
            
            # Check if there are any swing doors for plan view
            has_swing_doors = any(
                'swing' in panel.get('componentInstance', {}).get('product', {}).get('name', '').lower() or
                'door' in panel.get('componentInstance', {}).get('product', {}).get('name', '').lower()
                for panel in panels
            )
            
            if not has_swing_doors:
                return {'success': False, 'error': 'Plan views require at least one swing door'}
            
            # Calculate dimensions
            total_width = sum(panel.get('width', 0) for panel in panels)
            depth = 6  # Standard door depth
            
            # Create figure
            fig, ax = plt.subplots(figsize=(12, 8))
            ax.set_xlim(0, total_width + 20)
            ax.set_ylim(0, depth + 20)
            ax.set_aspect('equal')
            
            # Draw panels
            x_offset = 10
            
            for panel in panels:
                panel_width = panel.get('width', 0)
                panel_type = panel.get('componentInstance', {}).get('product', {}).get('name', 'Unknown')
                direction = panel.get('direction', '-')
                
                # Draw panel frame (top view)
                frame_rect = patches.Rectangle(
                    (x_offset, 10), panel_width, depth,
                    linewidth=2, edgecolor='black', facecolor='lightblue', alpha=0.3
                )
                ax.add_patch(frame_rect)
                
                # Draw door swing if it's a swing door
                if 'swing' in panel_type.lower() or 'door' in panel_type.lower():
                    # Determine swing direction and draw arc
                    if 'left' in direction.lower():
                        # Left swing
                        arc_center = (x_offset, 10 + depth)
                        swing_arc = patches.Arc(arc_center, panel_width * 2, panel_width * 2, 
                                              angle=0, theta1=270, theta2=360, 
                                              linewidth=1.5, color='red', linestyle='--')
                        ax.add_patch(swing_arc)
                        
                        # Draw door in open position
                        door_line = plt.Line2D([x_offset, x_offset + panel_width], 
                                             [10 + depth, 10 + depth], 
                                             linewidth=2, color='red')
                        ax.add_line(door_line)
                        
                    elif 'right' in direction.lower():
                        # Right swing
                        arc_center = (x_offset + panel_width, 10 + depth)
                        swing_arc = patches.Arc(arc_center, panel_width * 2, panel_width * 2, 
                                              angle=0, theta1=180, theta2=270, 
                                              linewidth=1.5, color='red', linestyle='--')
                        ax.add_patch(swing_arc)
                        
                        # Draw door in open position
                        door_line = plt.Line2D([x_offset + panel_width, x_offset], 
                                             [10 + depth, 10 + depth], 
                                             linewidth=2, color='red')
                        ax.add_line(door_line)
                
                x_offset += panel_width
            
            # Add dimensions
            ax.annotate(f'{total_width}"', 
                       xy=(10 + total_width/2, 5), 
                       ha='center', va='top', fontsize=12, weight='bold')
            
            # Style the plot
            ax.set_title('Plan View', fontsize=16, weight='bold', pad=20)
            ax.axis('off')
            
            # Convert to base64
            buffer = io.BytesIO()
            plt.savefig(buffer, format='png', bbox_inches='tight', dpi=150, facecolor='white')
            plt.close()
            buffer.seek(0)
            image_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
            
            return {
                'success': True,
                'plan_image': image_base64
            }
            
        except Exception as e:
            return {'success': False, 'error': f'Failed to generate plan: {str(e)}'}