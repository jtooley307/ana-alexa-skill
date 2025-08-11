import os
import webbrowser
import json
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import requests

# Configuration
CLIENT_ID = 'amzn1.application-oa2-client.35b126e'
CLIENT_SECRET = 'amzn1.oa2-cs.v1.288d01a6'
REDIRECT_URI = 'http://localhost:3000/callback'
PORT = 3000

class CallbackHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        # Parse the callback URL
        query = urlparse(self.path).query
        params = parse_qs(query)
        
        if 'code' in params:
            code = params['code'][0]
            self.send_response(200)
            self.send_header('Content-type', 'text/html')
            self.end_headers()
            self.wfile.write(b'''
                <html><body>
                <h1>Success!</h1>
                <p>You can close this window and return to the terminal.</p>
                </body></html>
            ''')
            # Exchange the authorization code for tokens
            exchange_code_for_token(code)
            # Shutdown the server
            self.server.shutdown()
        else:
            self.send_error(400, 'No authorization code received')

    def log_message(self, format, *args):
        # Silence the default logging
        return

def exchange_code_for_token(code):
    """Exchange the authorization code for access and refresh tokens"""
    token_url = 'https://api.amazon.com/auth/o2/token'
    data = {
        'grant_type': 'authorization_code',
        'code': code,
        'redirect_uri': REDIRECT_URI,
        'client_id': CLIENT_ID,
        'client_secret': CLIENT_SECRET
    }
    
    try:
        response = requests.post(token_url, data=data)
        response.raise_for_status()
        tokens = response.json()
        
        print("\n✅ Successfully obtained tokens!")
        print("\nRefresh Token (save this securely!):")
        print("\033[92m" + tokens['refresh_token'] + "\033[0m")  # Green color
        
        # Save to .env file
        with open('.env', 'a') as f:
            f.write(f'\nALEXA_REFRESH_TOKEN={tokens["refresh_token"]}\n')
        
        print("\n✅ Refresh token has been saved to your .env file")
        
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        if 'response' in locals():
            print(f"Response: {response.text}")

def main():
    # Build the authorization URL
    auth_url = (
        'https://www.amazon.com/ap/oa'
        f'?client_id={CLIENT_ID}'
        '&scope=alexa::ask:skills:readwrite'
        '&response_type=code'
        f'&redirect_uri={REDIRECT_URI}'
        '&state=state'
    )
    
    print("Starting local server to handle OAuth callback...")
    print("\nIf your browser doesn't open automatically, please visit this URL:")
    print(f"\n{auth_url}\n")
    
    # Start the local server
    server = HTTPServer(('', PORT), CallbackHandler)
    
    # Open the authorization URL in the default browser
    webbrowser.open(auth_url)
    
    try:
        print("Waiting for authorization... (Press Ctrl+C to cancel)")
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nOperation cancelled by user")
    finally:
        server.server_close()

if __name__ == "__main__":
    main()
