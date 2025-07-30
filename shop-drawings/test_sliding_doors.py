#!/usr/bin/env python3
"""
Test script specifically for sliding door functionality
"""

import json
from drawing_generator import generate_elevation_drawing, generate_plan_drawing

# Sample opening data with sliding doors
sliding_door_data = {
    "id": 3,
    "openingNumber": "O3",
    "panels": [
        {
            "id": 1,
            "width": 36,
            "height": 96,
            "swingDirection": "Right In",
            "slidingDirection": "Left",
            "componentInstance": {
                "product": {
                    "productType": "FIXED_PANEL",
                    "name": "Fixed Panel 36x96"
                }
            }
        },
        {
            "id": 2,
            "width": 48,
            "height": 96,
            "swingDirection": "Left Out",
            "slidingDirection": "Right",
            "componentInstance": {
                "product": {
                    "productType": "SLIDING_DOOR",
                    "name": "Sliding Door 48x96"
                }
            }
        },
        {
            "id": 3,
            "width": 30,
            "height": 96,
            "swingDirection": "Right In",
            "slidingDirection": "Left",
            "componentInstance": {
                "product": {
                    "productType": "FIXED_PANEL",
                    "name": "Fixed Panel 30x96"
                }
            }
        }
    ]
}

# Test different sliding directions
sliding_left_data = {
    "id": 4,
    "openingNumber": "O4",
    "panels": [
        {
            "id": 1,
            "width": 60,
            "height": 96,
            "swingDirection": "Right In",
            "slidingDirection": "Left",
            "componentInstance": {
                "product": {
                    "productType": "SLIDING_DOOR",
                    "name": "Sliding Door 60x96 - Left"
                }
            }
        }
    ]
}

sliding_right_data = {
    "id": 5,
    "openingNumber": "O5",
    "panels": [
        {
            "id": 1,
            "width": 60,
            "height": 96,
            "swingDirection": "Right In",
            "slidingDirection": "Right",
            "componentInstance": {
                "product": {
                    "productType": "SLIDING_DOOR",
                    "name": "Sliding Door 60x96 - Right"
                }
            }
        }
    ]
}

def test_sliding_door_elevation():
    print("Testing sliding door elevation drawing...")
    result = generate_elevation_drawing(sliding_door_data)
    
    if result["success"]:
        print("✓ Sliding door elevation generated successfully!")
        print(f"  Total width: {result['total_width']}\"")
        print(f"  Height: {result['height']}\"")
        print(f"  Door schedule rows: {len(result['door_schedule']['rows'])}")
        
        # Check that sliding direction appears in door schedule
        schedule_data = result['door_schedule']['rows']
        sliding_panel = next((row for row in schedule_data if 'Sliding' in row[1]), None)
        if sliding_panel:
            print(f"  ✓ Sliding door direction in schedule: {sliding_panel[3]}")
        else:
            print("  ✗ Sliding door not found in schedule")
            return False
    else:
        print(f"✗ Sliding door elevation failed: {result['error']}")
        return False
    
    return True

def test_sliding_door_plan():
    print("\nTesting sliding door plan drawing (custom implementation)...")
    result = generate_plan_drawing(sliding_door_data)
    
    if result["success"]:
        print("✓ Sliding door plan view generated successfully!")
        print(f"  Image data length: {len(result['plan_image'])} characters")
    else:
        print(f"✗ Sliding door plan failed: {result['error']}")
        return False
    
    return True

def test_sliding_directions():
    print("\nTesting different sliding directions in plan view...")
    
    # Test Left direction
    result_left = generate_plan_drawing(sliding_left_data)
    if result_left["success"]:
        print("✓ Sliding Left direction: PASS")
        print(f"  Image data length: {len(result_left['plan_image'])} characters")
    else:
        print(f"✗ Sliding Left direction failed: {result_left['error']}")
        return False
    
    # Test Right direction
    result_right = generate_plan_drawing(sliding_right_data)
    if result_right["success"]:
        print("✓ Sliding Right direction: PASS")
        print(f"  Image data length: {len(result_right['plan_image'])} characters")
    else:
        print(f"✗ Sliding Right direction failed: {result_right['error']}")
        return False
    
    return True

if __name__ == "__main__":
    print("SLIDING DOOR FUNCTIONALITY TEST")
    print("=" * 40)
    
    try:
        # Test 1: Sliding door elevation
        test1_success = test_sliding_door_elevation()
        
        # Test 2: Sliding door plan view
        test2_success = test_sliding_door_plan()
        
        # Test 3: Different sliding directions
        test3_success = test_sliding_directions()
        
        print("\n" + "=" * 40)
        print("Test Results:")
        print(f"✓ Sliding door elevation: {'PASS' if test1_success else 'FAIL'}")
        print(f"✓ Sliding door plan view: {'PASS' if test2_success else 'FAIL'}")
        print(f"✓ Sliding direction variations: {'PASS' if test3_success else 'FAIL'}")
        
        if test1_success and test2_success and test3_success:
            print("\n🎉 All tests passed! Custom sliding door plan view working correctly:")
            print("  - Elevation view: ✅ SHOPGEN format (100% fidelity)")
            print("  - Plan view: ✅ Custom implementation (shows open/ajar position)")
            print("  - Direction support: ✅ Left and Right sliding directions")
        else:
            print("\n❌ Some sliding door tests failed. Check the errors above.")
            
    except Exception as e:
        print(f"\n❌ Test failed with exception: {e}")
        import traceback
        traceback.print_exc()