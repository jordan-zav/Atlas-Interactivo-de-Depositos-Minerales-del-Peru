# Copyright (c) 2026 Jordan Zavaleta
# This file is part of Atlas-Interactivo-de-Depositos-Minerales-del-Peru.
# Atlas-Interactivo-de-Depositos-Minerales-del-Peru is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program.  If not, see <https://www.gnu.org/licenses/>.

from __future__ import annotations

import contextlib
import os
import socket
import subprocess
import sys
import threading
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


ROOT = Path(__file__).resolve().parent
BUILD_SCRIPT = ROOT / "scripts" / "build_data.py"


class AtlasHandler(SimpleHTTPRequestHandler):
    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, format: str, *args) -> None:
        return


def find_free_port() -> int:
    for port in range(8765, 8816):
        with contextlib.closing(socket.socket(socket.AF_INET, socket.SOCK_STREAM)) as sock:
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            if sock.connect_ex(("127.0.0.1", port)) != 0:
                return port
    raise RuntimeError("No se encontró un puerto libre entre 8765 y 8815.")


def build_data() -> None:
    result = subprocess.run(
        [sys.executable, str(BUILD_SCRIPT)],
        cwd=ROOT,
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError("No se pudieron preparar los datos del atlas.")


def open_browser(url: str) -> None:
    threading.Timer(1.2, lambda: webbrowser.open(url)).start()


def main() -> int:
    os.chdir(ROOT)
    build_data()

    port = find_free_port()
    url = f"http://127.0.0.1:{port}/web/"

    server = ThreadingHTTPServer(("127.0.0.1", port), AtlasHandler)
    print("Atlas Interactivo de Depósitos Minerales: Implementación y Visualización mediante SIG / Servicio web.")
    print(f"URL: {url}")
    print("Cierra esta ventana para detener el servidor.")

    open_browser(url)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
