#!/usr/bin/env python3

import sys
import json

def main():
    try:
        # Read input from stdin
        input_data = json.loads(sys.stdin.read())
        
        result = {
            'success': True,
            'message': 'Python script is working',
            'received_type': input_data.get('type', 'unknown')
        }
        
        print(json.dumps(result))
            
    except Exception as e:
        print(json.dumps({
            'success': False,
            'error': f'Test error: {str(e)}'
        }))

if __name__ == '__main__':
    main()