#!/usr/bin/env python3
import http.server
import socketserver
import os
import urllib.parse

class Handler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        # Strip query string
        path = urllib.parse.urlparse(path).path

        root = os.path.expanduser('~/ciclo-norte/web')
        path = path.lstrip('/')
        full = os.path.join(root, path)

        # If exact file exists, serve it
        if os.path.exists(full) and os.path.isfile(full):
            return full

        # Try adding .html extension
        if os.path.exists(full + '.html') and os.path.isfile(full + '.html'):
            return full + '.html'

        # If it's a directory, serve index.html
        if os.path.isdir(full):
            index = os.path.join(full, 'index.html')
            if os.path.exists(index):
                return index

        # SPA fallback: for unknown paths, try to serve [parent].html
        # e.g., /conversations/chat → conversations/chat.html
        if os.path.exists(full + '.html') and os.path.isfile(full + '.html'):
            return full + '.html'

        return full

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

    def log_message(self, format, *args):
        # Suppress logging
        pass

PORT = 3002
with socketserver.TCPServer(("", PORT), Handler) as httpd:
    print(f"Serving at port {PORT}")
    httpd.serve_forever()
