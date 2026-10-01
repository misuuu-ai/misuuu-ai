import http.server
import socketserver
import sys
import io
from pathlib import Path

# Настройка кодировки для Windows
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

class MyHttpRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(Path(__file__).resolve().parent), **kwargs)

    def do_GET(self):
        # Отдаем index.html по корневому пути
        if self.path == '/':
            self.path = '/index.html'
        return http.server.SimpleHTTPRequestHandler.do_GET(self)

def run(port=55373):
    server_address = ('127.0.0.1', port)
    
    try:
        httpd = socketserver.TCPServer(server_address, MyHttpRequestHandler)
        print(f"\033[92m🚀 Игра доступна по ссылке: http://127.0.0.1:{port}\033[0m")
        httpd.serve_forever()
    except OSError as e:
        # errno 98 - Linux (Address already in use)
        # errno 10048 - Windows (Address already in use)
        if e.errno == 98 or e.errno == 10048:
            print(f"\033[91mОшибка: Порт {port} уже занят. Попробуйте другой порт или закройте использующее его приложение.\033[0m")
        else:
            print(f"\033[91mОшибка: {e}\033[0m")
        sys.exit(1)

if __name__ == '__main__':
    run()
