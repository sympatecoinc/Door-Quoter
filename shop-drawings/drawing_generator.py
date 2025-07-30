#!/usr/bin/env python3
"""
SHOPGEN Drawing Generator - Extracted from SHOPGEN app.py
Maintains 100% of the drawing functionality and proportional accuracy.
"""

import matplotlib.pyplot as plt
import matplotlib.patches as patches
from io import BytesIO
import numpy as np
import matplotlib.transforms as mtransforms
import json
import sys
import base64

# Architectural conventions (inches) - EXACT COPY FROM SHOPGEN
FRAME_THICKNESS = 0.75
GLASS_STOP = 0.5
HANDLE_LENGTH = 6
DIM_LINE_OFFSET = 12
DIM_FONT_SIZE = 9
PANEL_LABEL_FONT_SIZE = 8

# Swing Door details
SWING_HEADER = 5
SWING_BOTTOM = 10
SWING_STILE = 4
# Sliding Door details
SLIDING_HEADER = 5
SLIDING_BOTTOM = 5
SLIDING_LOCK_RAIL = 4
SLIDING_OUTER_STILE = 2
# Fixed Panel details
FIXED_HEADER = 5
FIXED_BOTTOM = 5
FIXED_STILE = 1
FIXED_TERMINATING_STILE = 4

PANEL_TYPES = ["Fixed", "Swing Door", "Sliding Door"]
SWING_DIRECTIONS = ["Left In", "Right In", "Left Out", "Right Out"]
SLIDING_DIRECTIONS = ["Left", "Right"]

def draw_architectural_elevation(panels, height, frame_color="black", show_mullions=False):
    """
    EXACT COPY of draw_architectural_elevation from SHOPGEN
    Maintains 100% proportional accuracy and visual appearance
    """
    total_width = sum([p["width"] for p in panels])
    scale = min(12 / total_width, 6 / height)
    fig_width = total_width * scale
    fig_height = height * scale
    fig, ax = plt.subplots(figsize=(fig_width, fig_height))
    ax.set_xlim(0, total_width)
    ax.set_ylim(0, height)

    # Draw panels
    x = 0
    for idx, panel in enumerate(panels):
        w = panel["width"]
        # Panel number label
        ax.text(x + w/2, height + 6, f"{idx+1}", ha='center', va='bottom', fontsize=PANEL_LABEL_FONT_SIZE)
        px = x  # No gap
        py = 0  # No gap
        pw = w
        ph = height
        # Determine stile widths for fixed panel
        left_stile = FIXED_STILE
        right_stile = FIXED_STILE
        if panel["type"] == "Fixed":
            if idx == 0:
                left_stile = FIXED_TERMINATING_STILE
            if idx == len(panels)-1:
                right_stile = FIXED_TERMINATING_STILE
        # Draw rails/stiles for each panel type
        if panel["type"] == "Fixed":
            # Hide stiles if adjacent to sliding door (single boundary stile approach)
            hide_left = idx > 0 and panels[idx-1]["type"] == "Sliding Door"
            hide_right = idx < len(panels)-1 and panels[idx+1]["type"] == "Sliding Door"
            # Set stile widths to 0 if hidden
            left_stile_draw = left_stile if not hide_left else 0
            right_stile_draw = right_stile if not hide_right else 0
            # Left stile
            if not hide_left:
                ax.add_patch(patches.Rectangle((px, py), left_stile, ph, edgecolor='black', facecolor='none', linewidth=0.8))
            # Right stile
            if not hide_right:
                ax.add_patch(patches.Rectangle((px+pw-right_stile, py), right_stile, ph, edgecolor='black', facecolor='none', linewidth=0.8))
            # Top rail
            ax.add_patch(patches.Rectangle((px+left_stile_draw, py+ph-FIXED_HEADER), pw-left_stile_draw-right_stile_draw, FIXED_HEADER, edgecolor='black', facecolor='none', linewidth=0.8))
            # Bottom rail
            ax.add_patch(patches.Rectangle((px+left_stile_draw, py), pw-left_stile_draw-right_stile_draw, FIXED_BOTTOM, edgecolor='black', facecolor='none', linewidth=0.8))
            # Glass stop (single rectangle inside frame, inset 1.0")
            gs_x = px + left_stile_draw + 1.0
            gs_y = py + FIXED_BOTTOM + 1.0
            gs_w = pw - left_stile_draw - right_stile_draw - 2.0
            gs_h = ph - FIXED_HEADER - FIXED_BOTTOM - 2.0
            ax.add_patch(patches.Rectangle((gs_x, gs_y), gs_w, gs_h, edgecolor='royalblue', facecolor='none', linewidth=0.7, linestyle=':'))
        elif panel["type"] == "Swing Door":
            # Left stile
            ax.add_patch(patches.Rectangle((px, py), SWING_STILE, ph, edgecolor='black', facecolor='none', linewidth=0.8))
            # Right stile
            ax.add_patch(patches.Rectangle((px+pw-SWING_STILE, py), SWING_STILE, ph, edgecolor='black', facecolor='none', linewidth=0.8))
            # Top rail (5") at the very top
            ax.add_patch(patches.Rectangle((px+SWING_STILE, py+ph-5), pw-2*SWING_STILE, 5, edgecolor='black', facecolor='none', linewidth=0.8))
            # Bottom rail (10") at the very bottom
            ax.add_patch(patches.Rectangle((px+SWING_STILE, py), pw-2*SWING_STILE, 10, edgecolor='black', facecolor='none', linewidth=0.8))
            # Glass stop (single rectangle inside frame, inset 1.0")
            gs_x = px + SWING_STILE + 1.0
            gs_y = py + 10 + 1.0
            gs_w = pw - 2*SWING_STILE - 2.0
            gs_h = ph - 5 - 10 - 2.0
            ax.add_patch(patches.Rectangle((gs_x, gs_y), gs_w, gs_h, edgecolor='royalblue', facecolor='none', linewidth=0.7, linestyle=':'))
            # Handle
            handle_y = py + ph/2
            if "Left" in panel["swing_direction"]:
                handle_x = px + pw - SWING_STILE - HANDLE_LENGTH
            else:
                handle_x = px + SWING_STILE
            ax.plot([handle_x, handle_x+HANDLE_LENGTH], [handle_y, handle_y], color='black', linewidth=1.5)
        elif panel["type"] == "Sliding Door":
            slide_dir = panel["sliding_direction"]
            if slide_dir == "Left":
                # Outer stile (2") on left, lock stile (4") on right
                outer_x = px
                lock_x = px + pw - SLIDING_LOCK_RAIL
                rail_x0 = px + SLIDING_OUTER_STILE
                rail_x1 = px + pw - SLIDING_LOCK_RAIL
            else:  # "Right"
                # Lock stile (4") on left, outer stile (2") on right
                lock_x = px
                outer_x = px + pw - SLIDING_OUTER_STILE
                rail_x0 = px + SLIDING_LOCK_RAIL
                rail_x1 = px + pw - SLIDING_OUTER_STILE
            # Always draw both stiles, flush with panel edges
            ax.add_patch(patches.Rectangle((outer_x, py), SLIDING_OUTER_STILE, ph, edgecolor='black', facecolor='none', linewidth=0.8))
            ax.add_patch(patches.Rectangle((lock_x, py), SLIDING_LOCK_RAIL, ph, edgecolor='black', facecolor='none', linewidth=0.8))
            # Top rail (5")
            ax.add_patch(patches.Rectangle((rail_x0, py+ph-5), rail_x1-rail_x0, 5, edgecolor='black', facecolor='none', linewidth=0.8))
            # Bottom rail (5")
            ax.add_patch(patches.Rectangle((rail_x0, py), rail_x1-rail_x0, 5, edgecolor='black', facecolor='none', linewidth=0.8))
            # Glass stop (single rectangle inside frame, inset 1.0")
            gs_x = rail_x0 + 1.0
            gs_y = py + 5 + 1.0
            gs_w = rail_x1 - rail_x0 - 2.0
            gs_h = ph - 5 - 5 - 2.0
            ax.add_patch(patches.Rectangle((gs_x, gs_y), gs_w, gs_h, edgecolor='royalblue', facecolor='none', linewidth=0.7, linestyle=':'))
            # Handle (vertical bar on lock stile)
            handle_height = ph * 0.3
            handle_y0 = py + (ph - handle_height) / 2
            handle_x = (lock_x + SLIDING_LOCK_RAIL/2 - 0.5)
            ax.plot([handle_x, handle_x], [handle_y0, handle_y0+handle_height], color='black', linewidth=3)
            # Track
            ax.add_patch(patches.Rectangle((px, py+ph-GLASS_STOP), pw, GLASS_STOP, edgecolor='gray', facecolor='gray', linewidth=0))
            # Arrow for sliding direction
            arrow_y = py+ph-GLASS_STOP-2
            if slide_dir == "Left":
                ax.annotate("", xy=(px+5, arrow_y), xytext=(px+pw-10, arrow_y), arrowprops=dict(arrowstyle="->", lw=0.8))
            else:
                ax.annotate("", xy=(px+pw-5, arrow_y), xytext=(px+10, arrow_y), arrowprops=dict(arrowstyle="->", lw=0.8))
        # Draw mullion if needed (between panels)
        if show_mullions and idx > 0:
            ax.plot([x, x], [0, height], color=frame_color, linewidth=1, linestyle='-')
        x += w  # Panels touch exactly, no gap

    # Label
    ax.text(total_width / 2, -18, "CLEAR GLASS", ha='center', fontsize=12)

    # Dimension lines (overall width)
    ax.annotate("", xy=(0, height + DIM_LINE_OFFSET), xytext=(total_width, height + DIM_LINE_OFFSET),
                arrowprops=dict(arrowstyle='<->', lw=0.8), annotation_clip=False)
    ax.text(total_width/2, height + DIM_LINE_OFFSET + 3, f'{total_width}"', ha='center', va='bottom', fontsize=DIM_FONT_SIZE)
    # Height dimension
    ax.annotate("", xy=(-7, 0), xytext=(-7, height),
                arrowprops=dict(arrowstyle='<->', lw=0.8), annotation_clip=False)
    ax.text(-10, height/2, f'{height}"', ha='center', va='center', fontsize=DIM_FONT_SIZE, rotation=90)

    ax.axis('off')
    plt.tight_layout()
    return fig, total_width

def draw_door_schedule(panels):
    """
    EXACT COPY of draw_door_schedule from SHOPGEN with added Hardware column
    """
    col_labels = ["Panel #", "Type", "Width (in)", "Direction", "Glass", "Hardware"]
    cell_text = []
    for idx, p in enumerate(panels):
        direction = "-"
        if p["type"] == "Swing Door":
            direction = p["swing_direction"]
        elif p["type"] == "Sliding Door":
            direction = p["sliding_direction"]
        
        # Get hardware from configured options
        hardware = "-"
        hardware_options = p.get("hardware_options", [])
        
        if hardware_options:
            # Debug: print the hardware options structure
            print(f"DEBUG - Panel {idx+1} hardware_options: {hardware_options}", file=sys.stderr)
            
            # Hardware-related keywords to filter options
            hardware_keywords = ['hardware', 'locking', 'hinge', 'handle', 'lockset', 'track', 'rollers', 'lock', 'closer', 'panic', 'exit', 'door handle', 'pull', 'knob']
            
            # Filter for hardware-related options
            hardware_items = []
            for option in hardware_options:
                option_lower = option.lower()
                if any(keyword in option_lower for keyword in hardware_keywords):
                    hardware_items.append(option)
            
            if hardware_items:
                hardware = ", ".join(hardware_items)
        
        cell_text.append([
            str(idx+1),
            p["type"],
            str(p["width"]),
            direction,
            p.get("glass_type", "Clear"),
            hardware
        ])
    return col_labels, cell_text

def draw_topdown_swing_fixed(widths, door_idx, door_swing, panel_types, wall_thickness=8, frame_depth=3, door_thickness=2, opening_height=40):
    """
    EXACT COPY of draw_topdown_swing_fixed from SHOPGEN
    """
    import matplotlib.patches as patches
    import numpy as np
    fig, ax = plt.subplots(figsize=(10, 4))
    # --- Parameters ---
    total_width = sum(widths)
    wall_y = 0
    wall_h = wall_thickness
    wall_x0 = 0
    wall_x1 = total_width
    frame_lines = [0, 0.75, 1.5]  # offsets for frame, stop, pocket
    frame_w = frame_depth
    wall_bot_y = wall_y - wall_h/2
    wall_ext = 20  # wall extension length
    hatch_spacing = 2.5
    # --- Draw wall extensions (left and right) ---
    left_wall = patches.Rectangle((wall_x0 - wall_ext, wall_bot_y), wall_ext, wall_h, edgecolor='black', facecolor='none', linewidth=2.5)
    ax.add_patch(left_wall)
    right_wall = patches.Rectangle((wall_x1, wall_bot_y), wall_ext, wall_h, edgecolor='black', facecolor='none', linewidth=2.5)
    ax.add_patch(right_wall)
    # --- Hatching for wall extensions only ---
    # Left wall extension
    for hx in np.arange(wall_x0 - wall_ext - wall_h, wall_x0, hatch_spacing):
        x0 = max(hx, wall_x0 - wall_ext)
        y0 = wall_bot_y
        x1_hatch = hx + wall_h
        x1 = min(x1_hatch, wall_x0)
        y1 = wall_bot_y + (x1 - x0)
        if x0 < wall_x0 and x1 > wall_x0 - wall_ext:
            ax.plot([x0, x1], [y0, y1], color='black', linewidth=0.8)
    # Right wall extension
    for hx in np.arange(wall_x1 - wall_h, wall_x1 + wall_ext, hatch_spacing):
        x0 = max(hx, wall_x1)
        y0 = wall_bot_y
        x1_hatch = hx + wall_h
        x1 = min(x1_hatch, wall_x1 + wall_ext)
        y1 = wall_bot_y + (x1 - x0)
        if x0 < wall_x1 + wall_ext and x1 > wall_x1:
            ax.plot([x0, x1], [y0, y1], color='black', linewidth=0.8)
    # --- Draw panels and frames ---
    x = 0
    fixed_panel_count = 0
    for idx, (w, ptype) in enumerate(zip(widths, panel_types)):
        left = x
        right = x + w
        # Draw panel separation lines ONLY at wall/panel interfaces (start and end of wall)
        if idx == 0:
            ax.plot([left, left], [wall_bot_y, wall_bot_y + wall_h], color='black', linewidth=2)
        if idx == len(panel_types) - 1:
            ax.plot([right, right], [wall_bot_y, wall_bot_y + wall_h], color='black', linewidth=2)
        if ptype == 'Fixed':
            fixed_panel_count += 1
            # Fixed panel: opening with three blue glass lines
            gap = 2  # Gap between lines
            # Top solid line
            ax.plot([left, right], [wall_y + gap, wall_y + gap], color='royalblue', linewidth=1, linestyle='-')
            # Center dotted line (existing)
            ax.plot([left, right], [wall_y, wall_y], color='royalblue', linewidth=1, linestyle=':')
            # Bottom solid line
            ax.plot([left, right], [wall_y - gap, wall_y - gap], color='royalblue', linewidth=1, linestyle='-')
            # Add vertical division lines at edges of fixed panel for better distinction
            ax.plot([left, left], [wall_bot_y, wall_bot_y + wall_h], color='black', linewidth=2, zorder=12)
            ax.plot([right, right], [wall_bot_y, wall_bot_y + wall_h], color='black', linewidth=2, zorder=12)
            # Add panel number for distinction
            panel_center_x = (left + right) / 2
            panel_center_y = wall_y
            ax.add_patch(patches.Circle((panel_center_x, panel_center_y), 3, color='white', zorder=15, linewidth=1, fill=True))
            ax.add_patch(patches.Circle((panel_center_x, panel_center_y), 3, color='royalblue', zorder=16, linewidth=1.5, fill=False))
            ax.text(panel_center_x, panel_center_y, f'F{fixed_panel_count}', ha='center', va='center', fontsize=8, color='royalblue', weight='bold', zorder=17)
        elif ptype == 'Swing Door':
            # Door opening: clear, detailed frame
            ax.add_patch(patches.Rectangle((left, wall_bot_y), w, wall_h, edgecolor='none', facecolor='white', zorder=2))
            # Draw 2-3 parallel lines at each jamb for frame depth
            for offset in frame_lines:
                # Left jamb of door opening
                ax.plot([left + offset, left + offset], [wall_bot_y, wall_bot_y + wall_h], color='black', linewidth=1.1 if offset==0 else 0.7)
                # Right jamb of door opening
                ax.plot([right - offset, right - offset], [wall_bot_y, wall_bot_y + wall_h], color='black', linewidth=1.1 if offset==0 else 0.7)
            # --- Door panel (rectangle, perpendicular to wall, open position) ---
            if 'Left' in door_swing:
                hinge_x = left + frame_w
                door_angle = 90  # open upward
            else:
                hinge_x = right - frame_w
                door_angle = 90  # open upward
            hinge_y = wall_y
            door_length = w - 2*frame_w
            rect = patches.Rectangle((0, 0), door_length, door_thickness, edgecolor='black', facecolor='black', linewidth=2.5, zorder=10)
            t = patches.transforms.Affine2D().rotate_deg_around(0, 0, door_angle).translate(hinge_x, hinge_y)
            rect.set_transform(t + ax.transData)
            ax.add_patch(rect)
            # Hinge point (dot)
            ax.add_patch(patches.Circle((hinge_x, hinge_y), 0.7, color='black', zorder=20))
            # --- Swing arc (quarter-circle, radius = door width, from hinge point) ---
            ax.set_aspect('equal')
            arc_radius = door_length
            if 'Left' in door_swing:
                arc = patches.Arc((hinge_x, hinge_y), 2*arc_radius, 2*arc_radius, angle=0, theta1=0, theta2=90, color='black', linewidth=1.7, zorder=5)
                arc_tip_angle = np.deg2rad(90)
            else:
                arc = patches.Arc((hinge_x, hinge_y), 2*arc_radius, 2*arc_radius, angle=0, theta1=90, theta2=180, color='black', linewidth=1.7, zorder=5)
                arc_tip_angle = np.deg2rad(180)
            ax.add_patch(arc)
            # Arc arrow at tip
            arrow_x = hinge_x + arc_radius * np.cos(arc_tip_angle)
            arrow_y = hinge_y + arc_radius * np.sin(arc_tip_angle)
            ax.annotate('', xy=(arrow_x, arrow_y), xytext=(arrow_x - 7, arrow_y - 7), arrowprops=dict(arrowstyle='->', lw=1.2))
            # --- Frame hardware (simple circle at hinge) ---
            ax.add_patch(patches.Circle((hinge_x, hinge_y), 0.4, color='white', zorder=21, linewidth=1.2, fill=True))
            ax.add_patch(patches.Circle((hinge_x, hinge_y), 0.2, color='black', zorder=22, fill=True))
        x += w
    # --- Dimension lines for each panel ---
    x = 0
    for idx, (w, ptype) in enumerate(zip(widths, panel_types)):
        dim_y = wall_bot_y - 10
        ax.annotate('', xy=(x, dim_y), xytext=(x + w, dim_y), arrowprops=dict(arrowstyle='<->', lw=1.5))
        ax.text(x + w/2, dim_y-2, f'{w}"', ha='center', va='top', fontsize=16, fontweight='bold')
        x += w
    # --- Room labels ---
    # Place based on swing direction
    if 'Left' in door_swing:
        ax.text(wall_x0 - wall_ext + 10, wall_bot_y - 20, 'HALL', ha='left', va='top', fontsize=20, fontweight='bold')
        ax.text(wall_x1 + wall_ext - 10, wall_bot_y + wall_h + 30, 'OFFICE', ha='right', va='bottom', fontsize=20, fontweight='bold')
    else:
        ax.text(wall_x0 - wall_ext + 10, wall_bot_y + wall_h + 30, 'HALL', ha='left', va='bottom', fontsize=20, fontweight='bold')
        ax.text(wall_x1 + wall_ext - 10, wall_bot_y - 20, 'OFFICE', ha='right', va='top', fontsize=20, fontweight='bold')
    # --- Styling ---
    ax.set_xlim(wall_x0 - wall_ext - 10, wall_x1 + wall_ext + 10)
    ax.set_ylim(wall_bot_y - 40, wall_bot_y + wall_h + 60)
    ax.axis('off')
    plt.tight_layout()
    return fig

def draw_topdown_sliding_fixed(widths, door_idx, door_sliding, panel_types, wall_thickness=8, frame_depth=3, door_thickness=2, opening_height=40):
    """
    Draw top-down view for sliding doors and fixed panels
    Matches swing door format exactly but shows sliding panel open/ajar
    """
    import matplotlib.patches as patches
    import numpy as np
    fig, ax = plt.subplots(figsize=(10, 4))
    # --- Parameters (same as swing door) ---
    total_width = sum(widths)
    wall_y = 0
    wall_h = wall_thickness
    wall_x0 = 0
    wall_x1 = total_width
    frame_lines = [0, 0.75, 1.5]  # offsets for frame, stop, pocket
    frame_w = frame_depth
    wall_bot_y = wall_y - wall_h/2
    wall_ext = 20  # wall extension length
    hatch_spacing = 2.5
    
    # --- Draw wall extensions (same as swing door) ---
    left_wall = patches.Rectangle((wall_x0 - wall_ext, wall_bot_y), wall_ext, wall_h, edgecolor='black', facecolor='none', linewidth=2.5)
    ax.add_patch(left_wall)
    right_wall = patches.Rectangle((wall_x1, wall_bot_y), wall_ext, wall_h, edgecolor='black', facecolor='none', linewidth=2.5)
    ax.add_patch(right_wall)
    
    # --- Hatching for wall extensions (same as swing door) ---
    # Left wall extension
    for hx in np.arange(wall_x0 - wall_ext - wall_h, wall_x0, hatch_spacing):
        x0 = max(hx, wall_x0 - wall_ext)
        y0 = wall_bot_y
        x1_hatch = hx + wall_h
        x1 = min(x1_hatch, wall_x0)
        y1 = wall_bot_y + (x1 - x0)
        if x0 < wall_x0 and x1 > wall_x0 - wall_ext:
            ax.plot([x0, x1], [y0, y1], color='black', linewidth=0.8)
    # Right wall extension
    for hx in np.arange(wall_x1 - wall_h, wall_x1 + wall_ext, hatch_spacing):
        x0 = max(hx, wall_x1)
        y0 = wall_bot_y
        x1_hatch = hx + wall_h
        x1 = min(x1_hatch, wall_x1 + wall_ext)
        y1 = wall_bot_y + (x1 - x0)
        if x0 < wall_x1 + wall_ext and x1 > wall_x1:
            ax.plot([x0, x1], [y0, y1], color='black', linewidth=0.8)
    
    # --- Draw panels and frames ---
    x = 0
    fixed_panel_count = 0
    for idx, (w, ptype) in enumerate(zip(widths, panel_types)):
        left = x
        right = x + w
        # Draw panel separation lines ONLY at wall/panel interfaces (same as swing door)
        if idx == 0:
            ax.plot([left, left], [wall_bot_y, wall_bot_y + wall_h], color='black', linewidth=2)
        if idx == len(panel_types) - 1:
            ax.plot([right, right], [wall_bot_y, wall_bot_y + wall_h], color='black', linewidth=2)
        
        if ptype == 'Fixed':
            fixed_panel_count += 1
            # Fixed panel: opening with three blue glass lines (same as swing door)
            gap = 2  # Gap between lines
            # Top solid line
            ax.plot([left, right], [wall_y + gap, wall_y + gap], color='royalblue', linewidth=1, linestyle='-')
            # Center dotted line (existing)
            ax.plot([left, right], [wall_y, wall_y], color='royalblue', linewidth=1, linestyle=':')
            # Bottom solid line
            ax.plot([left, right], [wall_y - gap, wall_y - gap], color='royalblue', linewidth=1, linestyle='-')
            # Add vertical division lines at edges of fixed panel for better distinction
            ax.plot([left, left], [wall_bot_y, wall_bot_y + wall_h], color='black', linewidth=2, zorder=12)
            ax.plot([right, right], [wall_bot_y, wall_bot_y + wall_h], color='black', linewidth=2, zorder=12)
            # Add panel number for distinction
            panel_center_x = (left + right) / 2
            panel_center_y = wall_y
            ax.add_patch(patches.Circle((panel_center_x, panel_center_y), 3, color='white', zorder=15, linewidth=1, fill=True))
            ax.add_patch(patches.Circle((panel_center_x, panel_center_y), 3, color='royalblue', zorder=16, linewidth=1.5, fill=False))
            ax.text(panel_center_x, panel_center_y, f'F{fixed_panel_count}', ha='center', va='center', fontsize=8, color='royalblue', weight='bold', zorder=17)
        elif ptype == 'Sliding Door':
            # Sliding door opening: clear, detailed frame (same format as swing door)
            ax.add_patch(patches.Rectangle((left, wall_bot_y), w, wall_h, edgecolor='none', facecolor='white', zorder=2))
            # Draw 2-3 parallel lines at each jamb for frame depth
            for offset in frame_lines:
                # Left jamb of door opening
                ax.plot([left + offset, left + offset], [wall_bot_y, wall_bot_y + wall_h], color='black', linewidth=1.1 if offset==0 else 0.7)
                # Right jamb of door opening  
                ax.plot([right - offset, right - offset], [wall_bot_y, wall_bot_y + wall_h], color='black', linewidth=1.1 if offset==0 else 0.7)
            
            # --- Sliding door panel (shown in fully open position over neighboring panel) ---
            door_length = w - 2*frame_w
            
            # Position panel on hall side (above center line)
            panel_y = wall_y + wall_h/2 + 2  # Above center line with small gap (hall side)
            
            if door_sliding == "Left":
                # Panel slides left but stays on hall side, 70% above left neighboring panel
                panel_x = left + frame_w - door_length * 0.7  # Move 70% to the left
                # Arrow pointing left
                arrow_start_x = left + w/2
                arrow_end_x = left + w/4
            else:  # "Right"
                # Panel slides right but stays on hall side, 70% above right neighboring panel
                panel_x = right - frame_w - door_length * 0.3  # Move 70% to the right
                # Arrow pointing right
                arrow_start_x = left + w/2
                arrow_end_x = left + 3*w/4
            
            # Draw sliding panel (rectangular, parallel to wall, overlapping neighboring panel)
            sliding_panel = patches.Rectangle((panel_x, panel_y), door_length, door_thickness, 
                                            edgecolor='black', facecolor='lightgray', linewidth=2.5, zorder=10)
            ax.add_patch(sliding_panel)
            
            # Track indicators (top and bottom of opening)
            track_y1 = wall_bot_y + wall_h - 0.5
            track_y2 = wall_bot_y + 0.5
            ax.plot([left + frame_w, right - frame_w], [track_y1, track_y1], color='gray', linewidth=2)
            ax.plot([left + frame_w, right - frame_w], [track_y2, track_y2], color='gray', linewidth=2)
            
            # Direction arrow
            arrow_y = wall_y
            ax.annotate('', xy=(arrow_end_x, arrow_y), xytext=(arrow_start_x, arrow_y),
                       arrowprops=dict(arrowstyle='->', lw=1.5, color='red'))
            
        x += w
    
    # --- Dimension lines for each panel (same as swing door) ---
    x = 0
    for idx, (w, ptype) in enumerate(zip(widths, panel_types)):
        dim_y = wall_bot_y - 10
        ax.annotate('', xy=(x, dim_y), xytext=(x + w, dim_y), arrowprops=dict(arrowstyle='<->', lw=1.5))
        ax.text(x + w/2, dim_y-2, f'{w}"', ha='center', va='top', fontsize=16, fontweight='bold')
        x += w
    
    # --- Room labels - Hall always on top (where sliding door panel is) ---
    # Hall is always above the wall (where sliding door panel is positioned)
    ax.text(wall_x0 - wall_ext + 10, wall_bot_y + wall_h + 30, 'HALL', ha='left', va='bottom', fontsize=20, fontweight='bold')
    # Office is always below the wall
    ax.text(wall_x1 + wall_ext - 10, wall_bot_y - 20, 'OFFICE', ha='right', va='top', fontsize=20, fontweight='bold')
    
    # --- Styling (same as swing door) ---
    ax.set_xlim(wall_x0 - wall_ext - 10, wall_x1 + wall_ext + 10)
    ax.set_ylim(wall_bot_y - 40, wall_bot_y + wall_h + 60)
    ax.set_aspect('equal')
    ax.axis('off')
    plt.tight_layout()
    return fig

def convert_quoting_tool_data(opening_data):
    """
    Convert quoting tool opening data to SHOPGEN panel format
    """
    panels = []
    
    for panel in opening_data.get('panels', []):
        # Map product types from quoting tool to SHOPGEN format
        product_type = panel.get('componentInstance', {}).get('product', {}).get('productType', 'FIXED_PANEL')
        
        if product_type == 'SWING_DOOR':
            panel_type = "Swing Door"
        elif product_type == 'SLIDING_DOOR':
            panel_type = "Sliding Door"
        elif product_type == 'CORNER_90':
            panel_type = "Corner"
        else:
            panel_type = "Fixed"
            
        # Extract hardware options from componentInstance subOptionSelections
        hardware_options = []
        component_instance = panel.get('componentInstance')
        print(f"DEBUG - Panel componentInstance keys: {component_instance.keys() if component_instance else 'None'}", file=sys.stderr)
        
        if component_instance and component_instance.get('subOptionSelections'):
            try:
                import json
                raw_selections = component_instance.get('subOptionSelections', '{}')
                print(f"DEBUG - Raw subOptionSelections: {raw_selections}", file=sys.stderr)
                selections = json.loads(raw_selections)
                print(f"DEBUG - Parsed subOptionSelections: {selections}", file=sys.stderr)
                
                # Get product sub options for resolving IDs to names
                product = component_instance.get('product', {})
                product_sub_options = product.get('productSubOptions', [])
                print(f"DEBUG - Product sub options count: {len(product_sub_options)}", file=sys.stderr)
                
                # Resolve option IDs to names
                for category_id, option_id in selections.items():
                    if option_id:
                        # Find the category
                        for pso in product_sub_options:
                            if str(pso['category']['id']) == str(category_id):
                                category_name = pso['category']['name']
                                
                                # Find the individual option
                                for individual_option in pso['category']['individualOptions']:
                                    if individual_option['id'] == option_id:
                                        option_name = individual_option['name']
                                        hardware_options.append(f"{category_name}: {option_name}")
                                        print(f"DEBUG - Found hardware: {category_name}: {option_name}", file=sys.stderr)
                                        break
                                break
                
            except Exception as e:
                print(f"DEBUG - Error parsing subOptionSelections: {e}", file=sys.stderr)
                hardware_options = []
        
        shopgen_panel = {
            "type": panel_type,
            "width": panel.get('width', 36),
            "swing_direction": panel.get('swingDirection', 'Right In'),
            "sliding_direction": panel.get('slidingDirection', 'Left'),
            "corner_direction": panel.get('cornerDirection', 'Up'),
            "is_corner": panel.get('isCorner', False),
            "glass_type": panel.get('glassType', 'Clear'),
            "hardware_options": hardware_options
        }
        panels.append(shopgen_panel)
    
    return panels

def draw_topdown_swing_fixed_with_corners(widths, door_idx, door_swing, panel_types, panels, wall_thickness=8, frame_depth=3, door_thickness=2, opening_height=40):
    """
    Simple corner implementation: draw normally until corner, then draw perpendicular
    """
    import matplotlib.patches as patches
    import numpy as np
    
    # Find first corner
    corner_idx = None
    for i, ptype in enumerate(panel_types):
        if ptype == 'Corner':
            corner_idx = i
            break
    
    if corner_idx is None:
        # No corner found, use original
        return draw_topdown_swing_fixed(widths, door_idx, door_swing, panel_types, wall_thickness, frame_depth, door_thickness, opening_height)
    
    fig, ax = plt.subplots(figsize=(12, 8))
    
    # Draw first segment (before corner) - horizontal
    if corner_idx > 0:
        first_widths = widths[:corner_idx]
        first_types = panel_types[:corner_idx]
        first_panels = panels[:corner_idx]
        
        # Check if swing door is in first segment
        if door_idx < corner_idx:
            draw_horizontal_wall_segment(ax, first_widths, first_types, first_panels, 0, 0, door_idx, door_swing, wall_thickness, frame_depth, door_thickness, draw_left_ext=True, draw_right_ext=False)
        else:
            draw_horizontal_wall_segment(ax, first_widths, first_types, first_panels, 0, 0, -1, door_swing, wall_thickness, frame_depth, door_thickness, draw_left_ext=True, draw_right_ext=False)
    
    # Draw second segment (after corner) - vertical
    if corner_idx < len(panel_types) - 1:
        second_widths = widths[corner_idx + 1:]
        second_types = panel_types[corner_idx + 1:]
        second_panels = panels[corner_idx + 1:]
        start_x = sum(widths[:corner_idx]) if corner_idx > 0 else 0
        
        # Check if swing door is in second segment
        if door_idx > corner_idx:
            adjusted_door_idx = door_idx - corner_idx - 1
            draw_vertical_wall_segment(ax, second_widths, second_types, second_panels, start_x, 0, adjusted_door_idx, door_swing, wall_thickness, frame_depth, door_thickness, draw_bottom_ext=False, draw_top_ext=True)
        else:
            draw_vertical_wall_segment(ax, second_widths, second_types, second_panels, start_x, 0, -1, door_swing, wall_thickness, frame_depth, door_thickness, draw_bottom_ext=False, draw_top_ext=True)
    
    # --- Add exterior dimension lines for corner openings ---
    # Horizontal dimensions for first segment (below the wall)
    if corner_idx > 0:
        first_widths = widths[:corner_idx]
        x = 0
        for idx, w in enumerate(first_widths):
            dim_y = -wall_thickness/2 - 10  # position below wall
            ax.annotate('', xy=(x, dim_y), xytext=(x + w, dim_y), arrowprops=dict(arrowstyle='<->', lw=1.5))
            ax.text(x + w/2, dim_y-2, f'{w}"', ha='center', va='top', fontsize=16, fontweight='bold')
            x += w
    
    # Vertical dimensions for second segment (to the right of the wall)
    if corner_idx < len(panel_types) - 1:
        second_widths = widths[corner_idx + 1:]
        start_x = sum(widths[:corner_idx]) if corner_idx > 0 else 0
        dim_x = start_x + 15  # position to the right of vertical wall
        y = 0
        for idx, w in enumerate(second_widths):
            ax.annotate('', xy=(dim_x, y), xytext=(dim_x, y + w), arrowprops=dict(arrowstyle='<->', lw=1.5))
            ax.text(dim_x+2, y + w/2, f'{w}"', ha='left', va='center', fontsize=16, fontweight='bold', rotation=90)
            y += w
    
    # Set axis limits to include dimension areas
    all_x = [0, sum(widths[:corner_idx]) if corner_idx > 0 else 0]
    all_y = [0]
    if corner_idx < len(panel_types) - 1:
        all_y.append(sum(widths[corner_idx + 1:]))
    
    min_x = min(all_x) - 25  # Extra space for dimensions
    max_x = max(all_x) + 25
    min_y = min(all_y) - 25
    max_y = max(all_y) + 25
    
    ax.set_xlim(min_x, max_x)
    ax.set_ylim(min_y, max_y)
    ax.set_aspect('equal')
    ax.axis('off')
    plt.tight_layout()
    return fig

def draw_topdown_sliding_fixed_with_corners(widths, door_idx, door_sliding, panel_types, panels, wall_thickness=8, frame_depth=3, door_thickness=2, opening_height=40):
    """
    Simple corner implementation for sliding doors - uses proper sliding door logic
    """
    # Find first corner
    corner_idx = None
    for i, ptype in enumerate(panel_types):
        if ptype == 'Corner':
            corner_idx = i
            break
    
    if corner_idx is None:
        # No corner found, use original sliding door function
        return draw_topdown_sliding_fixed(widths, door_idx, door_sliding, panel_types, wall_thickness, frame_depth, door_thickness, opening_height)
    
    import matplotlib.patches as patches
    import numpy as np
    fig, ax = plt.subplots(figsize=(12, 8))
    
    # Draw first segment (before corner) - horizontal using sliding door logic
    if corner_idx > 0:
        first_widths = widths[:corner_idx]
        first_types = panel_types[:corner_idx]
        first_panels = panels[:corner_idx]
        
        # Check if sliding door is in first segment
        if door_idx < corner_idx:
            draw_horizontal_sliding_segment(ax, first_widths, first_types, first_panels, 0, 0, door_idx, door_sliding, wall_thickness, frame_depth, door_thickness, draw_left_ext=True, draw_right_ext=False)
        else:
            draw_horizontal_wall_segment(ax, first_widths, first_types, first_panels, 0, 0, -1, 'Right In', wall_thickness, frame_depth, door_thickness, draw_left_ext=True, draw_right_ext=False)
    
    # Draw second segment (after corner) - vertical
    if corner_idx < len(panel_types) - 1:
        second_widths = widths[corner_idx + 1:]
        second_types = panel_types[corner_idx + 1:]
        second_panels = panels[corner_idx + 1:]
        start_x = sum(widths[:corner_idx]) if corner_idx > 0 else 0
        
        # Check if sliding door is in second segment
        if door_idx > corner_idx:
            adjusted_door_idx = door_idx - corner_idx - 1
            draw_vertical_sliding_segment(ax, second_widths, second_types, second_panels, start_x, 0, adjusted_door_idx, door_sliding, wall_thickness, frame_depth, door_thickness, draw_bottom_ext=False, draw_top_ext=True)
        else:
            draw_vertical_wall_segment(ax, second_widths, second_types, second_panels, start_x, 0, -1, 'Right In', wall_thickness, frame_depth, door_thickness, draw_bottom_ext=False, draw_top_ext=True)
    
    # --- Add exterior dimension lines for corner openings ---
    # Horizontal dimensions for first segment (below the wall)
    if corner_idx > 0:
        first_widths = widths[:corner_idx]
        x = 0
        for idx, w in enumerate(first_widths):
            dim_y = -wall_thickness/2 - 10  # position below wall
            ax.annotate('', xy=(x, dim_y), xytext=(x + w, dim_y), arrowprops=dict(arrowstyle='<->', lw=1.5))
            ax.text(x + w/2, dim_y-2, f'{w}"', ha='center', va='top', fontsize=16, fontweight='bold')
            x += w
    
    # Vertical dimensions for second segment (to the right of the wall)
    if corner_idx < len(panel_types) - 1:
        second_widths = widths[corner_idx + 1:]
        start_x = sum(widths[:corner_idx]) if corner_idx > 0 else 0
        dim_x = start_x + 15  # position to the right of vertical wall
        y = 0
        for idx, w in enumerate(second_widths):
            ax.annotate('', xy=(dim_x, y), xytext=(dim_x, y + w), arrowprops=dict(arrowstyle='<->', lw=1.5))
            ax.text(dim_x+2, y + w/2, f'{w}"', ha='left', va='center', fontsize=16, fontweight='bold', rotation=90)
            y += w
    
    # Set axis limits to include dimension areas
    all_x = [0, sum(widths[:corner_idx]) if corner_idx > 0 else 0]
    all_y = [0]
    if corner_idx < len(panel_types) - 1:
        all_y.append(sum(widths[corner_idx + 1:]))
    
    min_x = min(all_x) - 25  # Extra space for dimensions
    max_x = max(all_x) + 25
    min_y = min(all_y) - 25
    max_y = max(all_y) + 25
    
    ax.set_xlim(min_x, max_x)
    ax.set_ylim(min_y, max_y)
    ax.set_aspect('equal')
    ax.axis('off')
    plt.tight_layout()
    return fig

def draw_horizontal_wall_segment(ax, widths, panel_types, panels, start_x, start_y, door_idx, door_swing, wall_thickness, frame_depth, door_thickness, draw_left_ext=True, draw_right_ext=True):
    """Draw horizontal wall segment exactly like original SHOPGEN with ALL details"""
    import matplotlib.patches as patches
    import numpy as np
    
    if not widths:
        return
    
    # --- Parameters from original ---
    total_width = sum(widths)
    wall_y = start_y
    wall_h = wall_thickness
    wall_x0 = start_x
    wall_x1 = start_x + total_width
    frame_lines = [0, 0.75, 1.5]  # offsets for frame, stop, pocket
    frame_w = frame_depth
    wall_bot_y = wall_y - wall_h/2
    wall_ext = 20  # wall extension length
    hatch_spacing = 2.5
    
    # --- Draw wall extensions (left and right) - only if not adjacent to corner ---
    if draw_left_ext:
        left_wall = patches.Rectangle((wall_x0 - wall_ext, wall_bot_y), wall_ext, wall_h, edgecolor='black', facecolor='none', linewidth=2.5)
        ax.add_patch(left_wall)
    if draw_right_ext:
        right_wall = patches.Rectangle((wall_x1, wall_bot_y), wall_ext, wall_h, edgecolor='black', facecolor='none', linewidth=2.5)
        ax.add_patch(right_wall)
    
    # --- Hatching for wall extensions only ---
    # Left wall extension
    if draw_left_ext:
        for hx in np.arange(wall_x0 - wall_ext - wall_h, wall_x0, hatch_spacing):
            x0 = max(hx, wall_x0 - wall_ext)
            y0 = wall_bot_y
            x1_hatch = hx + wall_h
            x1 = min(x1_hatch, wall_x0)
            y1 = wall_bot_y + (x1 - x0)
            if x0 < wall_x0 and x1 > wall_x0 - wall_ext:
                ax.plot([x0, x1], [y0, y1], color='black', linewidth=0.8)
    # Right wall extension
    if draw_right_ext:
        for hx in np.arange(wall_x1 - wall_h, wall_x1 + wall_ext, hatch_spacing):
            x0 = max(hx, wall_x1)
            y0 = wall_bot_y
            x1_hatch = hx + wall_h
            x1 = min(x1_hatch, wall_x1 + wall_ext)
            y1 = wall_bot_y + (x1 - x0)
            if x0 < wall_x1 + wall_ext and x1 > wall_x1:
                ax.plot([x0, x1], [y0, y1], color='black', linewidth=0.8)
    
    # --- Draw panels and frames ---
    x = wall_x0
    fixed_panel_count = 0
    for idx, (w, ptype) in enumerate(zip(widths, panel_types)):
        left = x
        right = x + w
        # Draw panel separation lines ONLY at wall/panel interfaces (start and end of wall)
        if idx == 0:
            ax.plot([left, left], [wall_bot_y, wall_bot_y + wall_h], color='black', linewidth=2)
        if idx == len(panel_types) - 1:
            ax.plot([right, right], [wall_bot_y, wall_bot_y + wall_h], color='black', linewidth=2)
        if ptype == 'Fixed':
            fixed_panel_count += 1
            # Fixed panel: opening with three blue glass lines
            gap = 2  # Gap between lines
            # Top solid line
            ax.plot([left, right], [wall_y + gap, wall_y + gap], color='royalblue', linewidth=1, linestyle='-')
            # Center dotted line (existing)
            ax.plot([left, right], [wall_y, wall_y], color='royalblue', linewidth=1, linestyle=':')
            # Bottom solid line
            ax.plot([left, right], [wall_y - gap, wall_y - gap], color='royalblue', linewidth=1, linestyle='-')
            # Add vertical division lines at edges of fixed panel for better distinction
            ax.plot([left, left], [wall_bot_y, wall_bot_y + wall_h], color='black', linewidth=2, zorder=12)
            ax.plot([right, right], [wall_bot_y, wall_bot_y + wall_h], color='black', linewidth=2, zorder=12)
            # Add panel number for distinction
            panel_center_x = (left + right) / 2
            panel_center_y = wall_y
            ax.add_patch(patches.Circle((panel_center_x, panel_center_y), 3, color='white', zorder=15, linewidth=1, fill=True))
            ax.add_patch(patches.Circle((panel_center_x, panel_center_y), 3, color='royalblue', zorder=16, linewidth=1.5, fill=False))
            ax.text(panel_center_x, panel_center_y, f'F{fixed_panel_count}', ha='center', va='center', fontsize=8, color='royalblue', weight='bold', zorder=17)
        elif ptype == 'Swing Door':
            # Door opening: clear, detailed frame
            ax.add_patch(patches.Rectangle((left, wall_bot_y), w, wall_h, edgecolor='none', facecolor='white', zorder=2))
            # Draw 2-3 parallel lines at each jamb for frame depth
            for offset in frame_lines:
                # Left jamb of door opening
                ax.plot([left + offset, left + offset], [wall_bot_y, wall_bot_y + wall_h], color='black', linewidth=1.1 if offset==0 else 0.7)
                # Right jamb of door opening
                ax.plot([right - offset, right - offset], [wall_bot_y, wall_bot_y + wall_h], color='black', linewidth=1.1 if offset==0 else 0.7)
            # --- Door panel (rectangle, perpendicular to wall, open position) ---
            if 'Left' in door_swing:
                hinge_x = left + frame_w
                door_angle = 90  # open upward
            else:
                hinge_x = right - frame_w
                door_angle = 90  # open upward
            hinge_y = wall_y
            door_length = w - 2*frame_w
            rect = patches.Rectangle((0, 0), door_length, door_thickness, edgecolor='black', facecolor='black', linewidth=2.5, zorder=10)
            t = patches.transforms.Affine2D().rotate_deg_around(0, 0, door_angle).translate(hinge_x, hinge_y)
            rect.set_transform(t + ax.transData)
            ax.add_patch(rect)
            # Hinge point (dot)
            ax.add_patch(patches.Circle((hinge_x, hinge_y), 0.7, color='black', zorder=20))
            # --- Swing arc (quarter-circle, radius = door width, from hinge point) ---
            ax.set_aspect('equal')
            arc_radius = door_length
            if 'Left' in door_swing:
                arc = patches.Arc((hinge_x, hinge_y), 2*arc_radius, 2*arc_radius, angle=0, theta1=0, theta2=90, color='black', linewidth=1.7, zorder=5)
                arc_tip_angle = np.deg2rad(90)
            else:
                arc = patches.Arc((hinge_x, hinge_y), 2*arc_radius, 2*arc_radius, angle=0, theta1=90, theta2=180, color='black', linewidth=1.7, zorder=5)
                arc_tip_angle = np.deg2rad(180)
            ax.add_patch(arc)
            # Arc arrow at tip
            arrow_x = hinge_x + arc_radius * np.cos(arc_tip_angle)
            arrow_y = hinge_y + arc_radius * np.sin(arc_tip_angle)
            ax.annotate('', xy=(arrow_x, arrow_y), xytext=(arrow_x - 7, arrow_y - 7), arrowprops=dict(arrowstyle='->', lw=1.2))
            # --- Frame hardware (simple circle at hinge) ---
            ax.add_patch(patches.Circle((hinge_x, hinge_y), 0.4, color='white', zorder=21, linewidth=1.2, fill=True))
            ax.add_patch(patches.Circle((hinge_x, hinge_y), 0.2, color='black', zorder=22, fill=True))
        x += w
    

def draw_vertical_wall_segment(ax, widths, panel_types, panels, start_x, start_y, door_idx, door_swing, wall_thickness, frame_depth, door_thickness, draw_bottom_ext=True, draw_top_ext=True):
    """Draw vertical wall segment with ALL original details rotated 90 degrees"""
    import matplotlib.patches as patches
    import numpy as np
    
    if not widths:
        return
    
    # --- Parameters adapted for vertical orientation ---
    total_height = sum(widths)  # widths become heights
    wall_x = start_x
    wall_w = wall_thickness
    wall_y0 = start_y
    wall_y1 = start_y + total_height
    frame_lines = [0, 0.75, 1.5]  # offsets for frame, stop, pocket
    frame_w = frame_depth
    wall_left_x = wall_x - wall_w/2
    wall_ext = 20  # wall extension length
    hatch_spacing = 2.5
    
    # --- Draw wall extensions (top and bottom) - only if not adjacent to corner ---
    if draw_bottom_ext:
        bottom_wall = patches.Rectangle((wall_left_x, wall_y0 - wall_ext), wall_w, wall_ext, edgecolor='black', facecolor='none', linewidth=2.5)
        ax.add_patch(bottom_wall)
    if draw_top_ext:
        top_wall = patches.Rectangle((wall_left_x, wall_y1), wall_w, wall_ext, edgecolor='black', facecolor='none', linewidth=2.5)
        ax.add_patch(top_wall)
    
    # --- Hatching for wall extensions only (rotated 90 degrees) ---
    # Bottom wall extension
    if draw_bottom_ext:
        for hy in np.arange(wall_y0 - wall_ext - wall_w, wall_y0, hatch_spacing):
            y0 = max(hy, wall_y0 - wall_ext)
            x0 = wall_left_x
            y1_hatch = hy + wall_w
            y1 = min(y1_hatch, wall_y0)
            x1 = wall_left_x + (y1 - y0)
            if y0 < wall_y0 and y1 > wall_y0 - wall_ext:
                ax.plot([x0, x1], [y0, y1], color='black', linewidth=0.8)
    # Top wall extension  
    if draw_top_ext:
        for hy in np.arange(wall_y1 - wall_w, wall_y1 + wall_ext, hatch_spacing):
            y0 = max(hy, wall_y1)
            x0 = wall_left_x
            y1_hatch = hy + wall_w
            y1 = min(y1_hatch, wall_y1 + wall_ext)
            x1 = wall_left_x + (y1 - y0)
            if y0 < wall_y1 + wall_ext and y1 > wall_y1:
                ax.plot([x0, x1], [y0, y1], color='black', linewidth=0.8)
    
    # --- Draw panels and frames vertically ---
    y = wall_y0
    fixed_panel_count = 0
    for idx, (w, ptype) in enumerate(zip(widths, panel_types)):
        bottom = y
        top = y + w
        # Draw panel separation lines ONLY at wall/panel interfaces (start and end of wall)
        if idx == 0:
            ax.plot([wall_left_x, wall_left_x + wall_w], [bottom, bottom], color='black', linewidth=2)
        if idx == len(panel_types) - 1:
            ax.plot([wall_left_x, wall_left_x + wall_w], [top, top], color='black', linewidth=2)
        if ptype == 'Fixed':
            fixed_panel_count += 1
            # Fixed panel: opening with three blue glass lines
            gap = 2  # Gap between lines
            # Left solid line
            ax.plot([wall_x - gap, wall_x - gap], [bottom, top], color='royalblue', linewidth=1, linestyle='-')
            # Center dotted line (existing)
            ax.plot([wall_x, wall_x], [bottom, top], color='royalblue', linewidth=1, linestyle=':')
            # Right solid line
            ax.plot([wall_x + gap, wall_x + gap], [bottom, top], color='royalblue', linewidth=1, linestyle='-')
            # Add horizontal division lines at edges of fixed panel for better distinction
            ax.plot([wall_left_x, wall_left_x + wall_w], [bottom, bottom], color='black', linewidth=2, zorder=12)
            ax.plot([wall_left_x, wall_left_x + wall_w], [top, top], color='black', linewidth=2, zorder=12)
            # Add panel number for distinction
            panel_center_x = wall_x
            panel_center_y = (bottom + top) / 2
            ax.add_patch(patches.Circle((panel_center_x, panel_center_y), 3, color='white', zorder=15, linewidth=1, fill=True))
            ax.add_patch(patches.Circle((panel_center_x, panel_center_y), 3, color='royalblue', zorder=16, linewidth=1.5, fill=False))
            ax.text(panel_center_x, panel_center_y, f'F{fixed_panel_count}', ha='center', va='center', fontsize=8, color='royalblue', weight='bold', zorder=17)
        elif ptype == 'Swing Door':
            # Door opening: clear, detailed frame
            ax.add_patch(patches.Rectangle((wall_left_x, bottom), wall_w, w, edgecolor='none', facecolor='white', zorder=2))
            # Draw 2-3 parallel lines at each jamb for frame depth
            for offset in frame_lines:
                # Bottom jamb of door opening
                ax.plot([wall_left_x, wall_left_x + wall_w], [bottom + offset, bottom + offset], color='black', linewidth=1.1 if offset==0 else 0.7)
                # Top jamb of door opening
                ax.plot([wall_left_x, wall_left_x + wall_w], [top - offset, top - offset], color='black', linewidth=1.1 if offset==0 else 0.7)
            # --- Door panel (rectangle, perpendicular to wall, open position) ---
            if 'Left' in door_swing:
                hinge_y = bottom + frame_w
                door_angle = 0  # open rightward (when wall is vertical)
            else:
                hinge_y = top - frame_w
                door_angle = 180  # open leftward
            hinge_x = wall_x
            door_length = w - 2*frame_w
            rect = patches.Rectangle((0, 0), door_thickness, door_length, edgecolor='black', facecolor='black', linewidth=2.5, zorder=10)
            t = patches.transforms.Affine2D().rotate_deg_around(0, 0, door_angle).translate(hinge_x, hinge_y)
            rect.set_transform(t + ax.transData)
            ax.add_patch(rect)
            # Hinge point (dot)
            ax.add_patch(patches.Circle((hinge_x, hinge_y), 0.7, color='black', zorder=20))
            # --- Swing arc (quarter-circle, radius = door width, from hinge point) ---
            ax.set_aspect('equal')
            arc_radius = door_length
            if 'Left' in door_swing:
                arc = patches.Arc((hinge_x, hinge_y), 2*arc_radius, 2*arc_radius, angle=0, theta1=270, theta2=360, color='black', linewidth=1.7, zorder=5)
                arc_tip_angle = np.deg2rad(0)
            else:
                arc = patches.Arc((hinge_x, hinge_y), 2*arc_radius, 2*arc_radius, angle=0, theta1=180, theta2=270, color='black', linewidth=1.7, zorder=5)
                arc_tip_angle = np.deg2rad(270)
            ax.add_patch(arc)
            # Arc arrow at tip
            arrow_x = hinge_x + arc_radius * np.cos(arc_tip_angle)
            arrow_y = hinge_y + arc_radius * np.sin(arc_tip_angle)
            ax.annotate('', xy=(arrow_x, arrow_y), xytext=(arrow_x - 7, arrow_y + 7), arrowprops=dict(arrowstyle='->', lw=1.2))
            # --- Frame hardware (simple circle at hinge) ---
            ax.add_patch(patches.Circle((hinge_x, hinge_y), 0.4, color='white', zorder=21, linewidth=1.2, fill=True))
            ax.add_patch(patches.Circle((hinge_x, hinge_y), 0.2, color='black', zorder=22, fill=True))
        y += w
    

def draw_horizontal_sliding_segment(ax, widths, panel_types, panels, start_x, start_y, door_idx, door_sliding, wall_thickness, frame_depth, door_thickness, draw_left_ext=True, draw_right_ext=True):
    """Draw horizontal sliding door segment with all original details"""
    import matplotlib.patches as patches
    import numpy as np
    
    if not widths:
        return
    
    # --- Parameters from original sliding door function ---
    total_width = sum(widths)
    wall_y = start_y
    wall_h = wall_thickness
    wall_x0 = start_x
    wall_x1 = start_x + total_width
    frame_lines = [0, 0.75, 1.5]  # offsets for frame, stop, pocket
    frame_w = frame_depth
    wall_bot_y = wall_y - wall_h/2
    wall_ext = 20  # wall extension length
    hatch_spacing = 2.5
    
    # --- Draw wall extensions (same as original) - only if not adjacent to corner ---
    if draw_left_ext:
        left_wall = patches.Rectangle((wall_x0 - wall_ext, wall_bot_y), wall_ext, wall_h, edgecolor='black', facecolor='none', linewidth=2.5)
        ax.add_patch(left_wall)
    if draw_right_ext:
        right_wall = patches.Rectangle((wall_x1, wall_bot_y), wall_ext, wall_h, edgecolor='black', facecolor='none', linewidth=2.5)
        ax.add_patch(right_wall)
    
    # --- Hatching for wall extensions (same as original) ---
    # Left wall extension
    if draw_left_ext:
        for hx in np.arange(wall_x0 - wall_ext - wall_h, wall_x0, hatch_spacing):
            x0 = max(hx, wall_x0 - wall_ext)
            y0 = wall_bot_y
            x1_hatch = hx + wall_h
            x1 = min(x1_hatch, wall_x0)
            y1 = wall_bot_y + (x1 - x0)
            if x0 < wall_x0 and x1 > wall_x0 - wall_ext:
                ax.plot([x0, x1], [y0, y1], color='black', linewidth=0.8)
    # Right wall extension
    if draw_right_ext:
        for hx in np.arange(wall_x1 - wall_h, wall_x1 + wall_ext, hatch_spacing):
            x0 = max(hx, wall_x1)
            y0 = wall_bot_y
            x1_hatch = hx + wall_h
            x1 = min(x1_hatch, wall_x1 + wall_ext)
            y1 = wall_bot_y + (x1 - x0)
            if x0 < wall_x1 + wall_ext and x1 > wall_x1:
                ax.plot([x0, x1], [y0, y1], color='black', linewidth=0.8)
    
    # --- Draw panels and frames ---
    x = wall_x0
    fixed_panel_count = 0
    for idx, (w, ptype) in enumerate(zip(widths, panel_types)):
        left = x
        right = x + w
        # Draw panel separation lines ONLY at wall/panel interfaces (same as original)
        if idx == 0:
            ax.plot([left, left], [wall_bot_y, wall_bot_y + wall_h], color='black', linewidth=2)
        if idx == len(panel_types) - 1:
            ax.plot([right, right], [wall_bot_y, wall_bot_y + wall_h], color='black', linewidth=2)
        
        if ptype == 'Fixed':
            fixed_panel_count += 1
            # Fixed panel: opening with three blue glass lines (same as original)
            gap = 2  # Gap between lines
            # Top solid line
            ax.plot([left, right], [wall_y + gap, wall_y + gap], color='royalblue', linewidth=1, linestyle='-')
            # Center dotted line (existing)
            ax.plot([left, right], [wall_y, wall_y], color='royalblue', linewidth=1, linestyle=':')
            # Bottom solid line
            ax.plot([left, right], [wall_y - gap, wall_y - gap], color='royalblue', linewidth=1, linestyle='-')
            # Add vertical division lines at edges of fixed panel for better distinction
            ax.plot([left, left], [wall_bot_y, wall_bot_y + wall_h], color='black', linewidth=2, zorder=12)
            ax.plot([right, right], [wall_bot_y, wall_bot_y + wall_h], color='black', linewidth=2, zorder=12)
            # Add panel number for distinction
            panel_center_x = (left + right) / 2
            panel_center_y = wall_y
            ax.add_patch(patches.Circle((panel_center_x, panel_center_y), 3, color='white', zorder=15, linewidth=1, fill=True))
            ax.add_patch(patches.Circle((panel_center_x, panel_center_y), 3, color='royalblue', zorder=16, linewidth=1.5, fill=False))
            ax.text(panel_center_x, panel_center_y, f'F{fixed_panel_count}', ha='center', va='center', fontsize=8, color='royalblue', weight='bold', zorder=17)
        elif ptype == 'Sliding Door':
            # Sliding door opening: clear, detailed frame (same format as original)
            ax.add_patch(patches.Rectangle((left, wall_bot_y), w, wall_h, edgecolor='none', facecolor='white', zorder=2))
            # Draw 2-3 parallel lines at each jamb for frame depth
            for offset in frame_lines:
                # Left jamb of door opening
                ax.plot([left + offset, left + offset], [wall_bot_y, wall_bot_y + wall_h], color='black', linewidth=1.1 if offset==0 else 0.7)
                # Right jamb of door opening  
                ax.plot([right - offset, right - offset], [wall_bot_y, wall_bot_y + wall_h], color='black', linewidth=1.1 if offset==0 else 0.7)
            
            # --- Sliding door panel (shown in fully open position) ---
            door_length = w - 2*frame_w
            
            # Position panel on hall side (above center line)
            panel_y = wall_y + wall_h/2 + 2  # Above center line with small gap (hall side)
            
            if door_sliding == "Left":
                # Panel slides left but stays on hall side, 70% above left neighboring panel
                panel_x = left + frame_w - door_length * 0.7  # Move 70% to the left
                # Arrow pointing left
                arrow_start_x = left + w/2
                arrow_end_x = left + w/4
            else:  # "Right"
                # Panel slides right but stays on hall side, 70% above right neighboring panel
                panel_x = right - frame_w - door_length * 0.3  # Move 70% to the right
                # Arrow pointing right
                arrow_start_x = left + w/2
                arrow_end_x = left + 3*w/4
            
            # Draw sliding panel (rectangular, parallel to wall, overlapping neighboring panel)
            sliding_panel = patches.Rectangle((panel_x, panel_y), door_length, door_thickness, 
                                            edgecolor='black', facecolor='lightgray', linewidth=2.5, zorder=10)
            ax.add_patch(sliding_panel)
            
            # Track indicators (top and bottom of opening)
            track_y1 = wall_bot_y + wall_h - 0.5
            track_y2 = wall_bot_y + 0.5
            ax.plot([left + frame_w, right - frame_w], [track_y1, track_y1], color='gray', linewidth=2)
            ax.plot([left + frame_w, right - frame_w], [track_y2, track_y2], color='gray', linewidth=2)
            
            # Direction arrow
            arrow_y = wall_y
            ax.annotate('', xy=(arrow_end_x, arrow_y), xytext=(arrow_start_x, arrow_y), 
                       arrowprops=dict(arrowstyle='->', lw=1.5, color='red'))
        
        x += w
    

def draw_vertical_sliding_segment(ax, widths, panel_types, panels, start_x, start_y, door_idx, door_sliding, wall_thickness, frame_depth, door_thickness, draw_bottom_ext=True, draw_top_ext=True):
    """Draw vertical sliding door segment with all original details rotated 90 degrees"""
    import matplotlib.patches as patches
    import numpy as np
    
    if not widths:
        return
    
    # --- Parameters adapted for vertical orientation ---
    total_height = sum(widths)  # widths become heights
    wall_x = start_x
    wall_w = wall_thickness
    wall_y0 = start_y
    wall_y1 = start_y + total_height
    frame_lines = [0, 0.75, 1.5]  # offsets for frame, stop, pocket
    frame_w = frame_depth
    wall_left_x = wall_x - wall_w/2
    wall_ext = 20  # wall extension length
    hatch_spacing = 2.5
    
    # --- Draw wall extensions (top and bottom) - only if not adjacent to corner ---
    if draw_bottom_ext:
        bottom_wall = patches.Rectangle((wall_left_x, wall_y0 - wall_ext), wall_w, wall_ext, edgecolor='black', facecolor='none', linewidth=2.5)
        ax.add_patch(bottom_wall)
    if draw_top_ext:
        top_wall = patches.Rectangle((wall_left_x, wall_y1), wall_w, wall_ext, edgecolor='black', facecolor='none', linewidth=2.5)
        ax.add_patch(top_wall)
    
    # --- Hatching for wall extensions only (rotated 90 degrees) ---
    # Bottom wall extension
    if draw_bottom_ext:
        for hy in np.arange(wall_y0 - wall_ext - wall_w, wall_y0, hatch_spacing):
            y0 = max(hy, wall_y0 - wall_ext)
            x0 = wall_left_x
            y1_hatch = hy + wall_w
            y1 = min(y1_hatch, wall_y0)
            x1 = wall_left_x + (y1 - y0)
            if y0 < wall_y0 and y1 > wall_y0 - wall_ext:
                ax.plot([x0, x1], [y0, y1], color='black', linewidth=0.8)
    # Top wall extension  
    if draw_top_ext:
        for hy in np.arange(wall_y1 - wall_w, wall_y1 + wall_ext, hatch_spacing):
            y0 = max(hy, wall_y1)
            x0 = wall_left_x
            y1_hatch = hy + wall_w
            y1 = min(y1_hatch, wall_y1 + wall_ext)
            x1 = wall_left_x + (y1 - y0)
            if y0 < wall_y1 + wall_ext and y1 > wall_y1:
                ax.plot([x0, x1], [y0, y1], color='black', linewidth=0.8)
    
    # --- Draw panels and frames vertically ---
    y = wall_y0
    fixed_panel_count = 0
    for idx, (w, ptype) in enumerate(zip(widths, panel_types)):
        bottom = y
        top = y + w
        # Draw panel separation lines ONLY at wall/panel interfaces
        if idx == 0:
            ax.plot([wall_left_x, wall_left_x + wall_w], [bottom, bottom], color='black', linewidth=2)
        if idx == len(panel_types) - 1:
            ax.plot([wall_left_x, wall_left_x + wall_w], [top, top], color='black', linewidth=2)
        
        if ptype == 'Fixed':
            fixed_panel_count += 1
            # Fixed panel: opening with three blue glass lines
            gap = 2  # Gap between lines
            # Left solid line
            ax.plot([wall_x - gap, wall_x - gap], [bottom, top], color='royalblue', linewidth=1, linestyle='-')
            # Center dotted line (existing)
            ax.plot([wall_x, wall_x], [bottom, top], color='royalblue', linewidth=1, linestyle=':')
            # Right solid line
            ax.plot([wall_x + gap, wall_x + gap], [bottom, top], color='royalblue', linewidth=1, linestyle='-')
            # Add horizontal division lines at edges of fixed panel for better distinction
            ax.plot([wall_left_x, wall_left_x + wall_w], [bottom, bottom], color='black', linewidth=2, zorder=12)
            ax.plot([wall_left_x, wall_left_x + wall_w], [top, top], color='black', linewidth=2, zorder=12)
            # Add panel number for distinction
            panel_center_x = wall_x
            panel_center_y = (bottom + top) / 2
            ax.add_patch(patches.Circle((panel_center_x, panel_center_y), 3, color='white', zorder=15, linewidth=1, fill=True))
            ax.add_patch(patches.Circle((panel_center_x, panel_center_y), 3, color='royalblue', zorder=16, linewidth=1.5, fill=False))
            ax.text(panel_center_x, panel_center_y, f'F{fixed_panel_count}', ha='center', va='center', fontsize=8, color='royalblue', weight='bold', zorder=17)
        elif ptype == 'Sliding Door':
            # Sliding door opening: clear, detailed frame
            ax.add_patch(patches.Rectangle((wall_left_x, bottom), wall_w, w, edgecolor='none', facecolor='white', zorder=2))
            # Draw 2-3 parallel lines at each jamb for frame depth
            for offset in frame_lines:
                # Bottom jamb of door opening
                ax.plot([wall_left_x, wall_left_x + wall_w], [bottom + offset, bottom + offset], color='black', linewidth=1.1 if offset==0 else 0.7)
                # Top jamb of door opening
                ax.plot([wall_left_x, wall_left_x + wall_w], [top - offset, top - offset], color='black', linewidth=1.1 if offset==0 else 0.7)
            
            # --- Sliding door panel (shown in fully open position, rotated) ---
            door_length = w - 2*frame_w
            
            # Position panel on hall side (right of center line for vertical walls)
            panel_x = wall_x + wall_w/2 + 2  # To right of center line with small gap (hall side)
            
            if door_sliding == "Left":
                # Panel slides "up" in vertical orientation but stays on hall side
                panel_y = bottom + frame_w - door_length * 0.7  # Move 70% up
                # Arrow pointing up
                arrow_start_y = bottom + w/2
                arrow_end_y = bottom + w/4
            else:  # "Right"  
                # Panel slides "down" in vertical orientation but stays on hall side
                panel_y = top - frame_w - door_length * 0.3  # Move 70% down
                # Arrow pointing down
                arrow_start_y = bottom + w/2
                arrow_end_y = bottom + 3*w/4
            
            # Draw sliding panel (rectangular, parallel to wall, overlapping neighboring panel)
            sliding_panel = patches.Rectangle((panel_x, panel_y), door_thickness, door_length, 
                                            edgecolor='black', facecolor='lightgray', linewidth=2.5, zorder=10)
            ax.add_patch(sliding_panel)
            
            # Track indicators (left and right of opening)
            track_x1 = wall_left_x + wall_w - 0.5
            track_x2 = wall_left_x + 0.5
            ax.plot([track_x1, track_x1], [bottom + frame_w, top - frame_w], color='gray', linewidth=2)
            ax.plot([track_x2, track_x2], [bottom + frame_w, top - frame_w], color='gray', linewidth=2)
            
            # Direction arrow (vertical)
            arrow_x = wall_x
            ax.annotate('', xy=(arrow_x, arrow_end_y), xytext=(arrow_x, arrow_start_y), 
                       arrowprops=dict(arrowstyle='->', lw=1.5, color='red'))
        
        y += w
    


def draw_miniature_elevation(panels, height):
    """
    Draw a miniature elevation view for quotes - simplified version
    """
    import matplotlib.pyplot as plt
    import matplotlib.patches as patches
    
    # Calculate total width
    total_width = sum([p['width'] for p in panels])
    
    # Create smaller figure for miniature
    fig_width = min(4, max(2, total_width / 30))  # Scale based on total width, cap at 4"
    fig_height = min(3, max(1.5, height / 40))    # Scale based on height, cap at 3"
    
    fig, ax = plt.subplots(figsize=(fig_width, fig_height))
    
    # Simplified constants for miniature
    MINI_STILE = 0.5
    MINI_RAIL = 1.0
    
    x = 0
    for idx, panel in enumerate(panels):
        w = panel['width']
        px = x
        py = 0
        pw = w
        ph = height
        
        # Simplified panel drawing
        if panel["type"] == "Fixed":
            # Just draw frame outline and glass indication
            ax.add_patch(patches.Rectangle((px, py), pw, ph, edgecolor='black', facecolor='none', linewidth=0.5))
            # Glass area (simplified)
            glass_inset = min(MINI_STILE, w/8)
            ax.add_patch(patches.Rectangle((px+glass_inset, py+MINI_RAIL), 
                                         pw-2*glass_inset, ph-2*MINI_RAIL, 
                                         edgecolor='royalblue', facecolor='none', 
                                         linewidth=0.3, linestyle=':'))
        elif panel["type"] in ["Swing Door", "Sliding Door"]:
            # Draw frame
            ax.add_patch(patches.Rectangle((px, py), pw, ph, edgecolor='black', facecolor='none', linewidth=0.5))
            # Top and bottom rails
            ax.add_patch(patches.Rectangle((px+MINI_STILE, py+ph-MINI_RAIL), pw-2*MINI_STILE, MINI_RAIL, 
                                         edgecolor='black', facecolor='none', linewidth=0.3))
            ax.add_patch(patches.Rectangle((px+MINI_STILE, py), pw-2*MINI_STILE, MINI_RAIL, 
                                         edgecolor='black', facecolor='none', linewidth=0.3))
            # Glass area
            ax.add_patch(patches.Rectangle((px+MINI_STILE, py+MINI_RAIL), 
                                         pw-2*MINI_STILE, ph-2*MINI_RAIL, 
                                         edgecolor='royalblue', facecolor='none', 
                                         linewidth=0.3, linestyle=':'))
        
        x += w
    
    # Clean styling for miniature
    ax.set_xlim(-1, total_width + 1)
    ax.set_ylim(-2, height + 2)
    ax.set_aspect('equal')
    ax.axis('off')
    plt.tight_layout()
    
    return fig, total_width

def generate_elevation_drawing(opening_data, is_miniature=False):
    """
    Generate elevation drawing from quoting tool opening data
    """
    try:
        panels = convert_quoting_tool_data(opening_data)
        height = max([p.get('height', 96) for p in opening_data.get('panels', [])]) if opening_data.get('panels') else 96
        
        # Generate elevation (miniature or full size)
        if is_miniature:
            fig, total_width = draw_miniature_elevation(panels, height)
            dpi = 150  # Lower DPI for smaller file size
        else:
            fig, total_width = draw_architectural_elevation(panels, height)
            dpi = 300  # High DPI for full drawings
        
        # Convert to base64 image
        buf = BytesIO()
        fig.savefig(buf, format='png', dpi=dpi, bbox_inches='tight')
        buf.seek(0)
        image_base64 = base64.b64encode(buf.getvalue()).decode('utf-8')
        plt.close(fig)
        
        # Generate door schedule
        col_labels, cell_text = draw_door_schedule(panels)
        
        return {
            "success": True,
            "elevation_image": image_base64,
            "door_schedule": {
                "headers": col_labels,
                "rows": cell_text
            },
            "total_width": total_width,
            "height": height
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


def generate_plan_drawing(opening_data):
    """
    Generate plan view drawing from quoting tool opening data
    Supports swing doors, sliding doors, and 90-degree corners
    """
    try:
        panels = convert_quoting_tool_data(opening_data)
        panel_types = [p['type'] for p in panels]
        
        # Check for corners - if present, use corner-aware drawing
        has_corner = 'Corner' in panel_types
        has_swing_door = 'Swing Door' in panel_types
        has_sliding_door = 'Sliding Door' in panel_types
        
        # Check for doors - use original functions for now
        if not (has_swing_door or has_sliding_door):
            return {
                "success": False,
                "error": "Plan view requires at least one door (swing or sliding)"
            }
        
        widths = [p['width'] for p in panels]
        
        # Generate appropriate plan view based on door type
        if has_swing_door:
            # Use original SHOPGEN swing door plan view
            door_idx = panel_types.index('Swing Door')
            door_swing = panels[door_idx]['swing_direction']
            
            if has_corner:
                fig = draw_topdown_swing_fixed_with_corners(widths, door_idx, door_swing, panel_types, panels)
            else:
                fig = draw_topdown_swing_fixed(widths, door_idx, door_swing, panel_types)
        elif has_sliding_door:
            # Use custom sliding door plan view
            door_idx = panel_types.index('Sliding Door')
            door_sliding = panels[door_idx]['sliding_direction']
            
            if has_corner:
                fig = draw_topdown_sliding_fixed_with_corners(widths, door_idx, door_sliding, panel_types, panels)
            else:
                fig = draw_topdown_sliding_fixed(widths, door_idx, door_sliding, panel_types)
        
        # Convert to base64 image
        buf = BytesIO()
        fig.savefig(buf, format='png', dpi=300, bbox_inches='tight')
        buf.seek(0)
        image_base64 = base64.b64encode(buf.getvalue()).decode('utf-8')
        plt.close(fig)
        
        return {
            "success": True,
            "plan_image": image_base64
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }

def main():
    """
    Main function for command line usage
    Expects JSON input from stdin and outputs JSON result to stdout
    """
    try:
        input_data = json.loads(sys.stdin.read())
        drawing_type = input_data.get('type', 'elevation')
        opening_data = input_data.get('data', {})
        is_miniature = input_data.get('miniature', False)
        
        if drawing_type == 'elevation':
            result = generate_elevation_drawing(opening_data, is_miniature=is_miniature)
        elif drawing_type == 'plan':
            result = generate_plan_drawing(opening_data)
        else:
            result = {
                "success": False,
                "error": f"Unknown drawing type: {drawing_type}"
            }
        
        print(json.dumps(result))
        
    except Exception as e:
        error_result = {
            "success": False,
            "error": str(e)
        }
        print(json.dumps(error_result))

if __name__ == "__main__":
    main()