#!/usr/bin/env python3
"""
Test script for the drawing generator
"""

import json
from drawing_generator import generate_elevation_drawing, generate_plan_drawing

# Sample opening data for testing
sample_opening_data = {
    "id": 1,
    "openingNumber": "O1",
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
            "width": 30,
            "height": 96,
            "swingDirection": "Left Out",
            "slidingDirection": "Left",
            "componentInstance": {
                "product": {
                    "productType": "SWING_DOOR",
                    "name": "Swing Door 30x96"
                }
            }
        },
        {
            "id": 3,
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
        }
    ]
}

def test_elevation_drawing():
    print("Testing elevation drawing generation...")
    result = generate_elevation_drawing(sample_opening_data)
    
    if result["success"]:
        print("✓ Elevation drawing generated successfully!")
        print(f"  Total width: {result['total_width']}\"")
        print(f"  Height: {result['height']}\"")
        print(f"  Door schedule rows: {len(result['door_schedule']['rows'])}")
        print(f"  Image data length: {len(result['elevation_image'])} characters")
    else:
        print(f"✗ Elevation drawing failed: {result['error']}")
    
    return result["success"]

def test_plan_drawing():
    print("\nTesting plan drawing generation...")
    result = generate_plan_drawing(sample_opening_data)
    
    if result["success"]:
        print("✓ Plan drawing generated successfully!")
        print(f"  Image data length: {len(result['plan_image'])} characters")
    else:
        print(f"✗ Plan drawing failed: {result['error']}")
    
    return result["success"]

def test_fixed_panel_only():
    print("\nTesting fixed panel only (should fail plan view)...")
    fixed_only_data = {
        "id": 2,
        "openingNumber": "O2",
        "panels": [
            {
                "id": 4,
                "width": 60,
                "height": 96,
                "swingDirection": "Right In",
                "slidingDirection": "Left",
                "componentInstance": {
                    "product": {
                        "productType": "FIXED_PANEL",
                        "name": "Large Fixed Panel"
                    }
                }
            }
        ]
    }
    
    elevation_result = generate_elevation_drawing(fixed_only_data)
    plan_result = generate_plan_drawing(fixed_only_data)
    
    elevation_success = elevation_result["success"]
    plan_should_fail = not plan_result["success"]
    
    print(f"✓ Elevation (should succeed): {elevation_success}")
    print(f"✓ Plan view (should fail): {plan_should_fail}")
    
    if plan_should_fail:
        print(f"  Expected error: {plan_result['error']}")
    
    return elevation_success and plan_should_fail

if __name__ == "__main__":
    print("SHOPGEN Drawing Service Test")
    print("=" * 40)
    
    try:
        # Test 1: Elevation drawing
        test1_success = test_elevation_drawing()
        
        # Test 2: Plan drawing  
        test2_success = test_plan_drawing()
        
        # Test 3: Fixed panel only
        test3_success = test_fixed_panel_only()
        
        print("\n" + "=" * 40)
        print("Test Results:")
        print(f"✓ Elevation drawing: {'PASS' if test1_success else 'FAIL'}")
        print(f"✓ Plan drawing: {'PASS' if test2_success else 'FAIL'}")
        print(f"✓ Fixed panel only: {'PASS' if test3_success else 'FAIL'}")
        
        if test1_success and test2_success and test3_success:
            print("\n🎉 All tests passed! Drawing service is working correctly.")
        else:
            print("\n❌ Some tests failed. Check the errors above.")
            
    except Exception as e:
        print(f"\n❌ Test failed with exception: {e}")
        import traceback
        traceback.print_exc()