"""Regresión opcional: python tests/overlays.browser.py.

Requiere Python Playwright y Chromium ya instalados, sin dependencias npm nuevas.
Sirve los módulos locales y usa exclusivamente un fixture ficticio; no carga app.js,
sesiones, variables de entorno del proyecto ni realiza peticiones a Supabase.
"""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
import os

from playwright.sync_api import sync_playwright


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


ROOT = Path(__file__).resolve().parents[1]
server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(ROOT)))
Thread(target=server.serve_forever, daemon=True).start()
base_url = f'http://127.0.0.1:{server.server_port}'


def fixture(browser):
    page = browser.new_page()
    page.route('**/overlay-fixture', lambda route: route.fulfill(
        content_type='text/html',
        body='<button id="trigger">Abrir</button><main id="background">Fondo</main><div id="modalHost"></div>'
    ))
    page.goto(f'{base_url}/overlay-fixture#clientes')
    page.locator('#trigger').focus()
    return page


try:
    with sync_playwright() as p:
        chromium_path = os.environ.get('CHROMIUM_PATH', '/usr/bin/chromium')
        launch_options = {'headless': True, 'args': ['--no-sandbox']}
        if Path(chromium_path).exists():
            launch_options['executable_path'] = chromium_path
        browser = p.chromium.launch(**launch_options)

        page = fixture(browser)
        page.evaluate('''async () => {
          const {openPanel} = await import('/src/ui/panel.js');
          const {openModal} = await import('/src/ui/modal.js');
          window.openModal = openModal;
          window.closedPanel = 0; window.closedModal = 0;
          window.panel = openPanel({title:'Ficha cliente', body:'<div hidden><input id="hiddenField"></div><button id="first">Primero</button><button id="last">Último</button>', onClose:() => window.closedPanel++});
        }''')
        assert page.locator('[role=dialog]').count() == 1
        assert page.locator('[role=dialog]').get_attribute('aria-labelledby')
        assert page.locator('#first').evaluate('(el) => el === document.activeElement')
        assert page.locator('#background').evaluate('(el) => el.inert')
        page.locator('#last').focus()
        page.keyboard.press('Tab')
        assert page.locator('.panel-close-btn').evaluate('(el) => el === document.activeElement')
        page.keyboard.press('Shift+Tab')
        assert page.locator('#last').evaluate('(el) => el === document.activeElement')
        page.evaluate('''() => {
          window.modal = openModal({title:'Editar cliente', body:'<input id="editing"><button>Guardar</button>', onClose:() => window.closedModal++});
        }''')
        assert page.locator('.panel').evaluate('(el) => el.closest("[inert]") !== null')
        page.keyboard.press('Escape')
        page.wait_for_function('window.closedModal === 1')
        assert page.locator('[role=dialog]').count() == 1
        assert page.evaluate('window.closedPanel') == 0
        assert page.locator('#last').evaluate('(el) => el === document.activeElement')
        page.go_back()
        page.wait_for_function('window.closedPanel === 1')
        assert page.locator('[role=dialog]').count() == 0
        assert page.url.endswith('#clientes')
        assert page.locator('#trigger').evaluate('(el) => el === document.activeElement')
        assert not page.locator('#background').evaluate('(el) => el.inert')
        page.evaluate('''() => {
          window.modal = openModal({title:'Cerrar dos veces', body:'<input>', onClose:() => window.closedModal++});
          modal.close(); modal.close();
        }''')
        page.wait_for_function('window.closedModal === 2')
        assert page.locator('[role=dialog]').count() == 0
        print('PASS: rol/nombre, foco visible, inert, Tab/Shift+Tab, Escape superior, atrás, foco restaurado, cierre idempotente.')
        page.close()

        page = fixture(browser)
        page.evaluate('''async () => {
          const {openOverlay, closeAllOverlays} = await import('/src/ui/overlay.js');
          window.openOverlay = openOverlay; window.closeAllOverlays = closeAllOverlays;
          history.pushState({}, '', '#clientes');
          window.panel = openOverlay({kind:'panel', title:'Ficha', body:'<button id="edit">Editar</button>'});
          window.modal = openOverlay({title:'Editar', body:'<input id="combo"><div id="options">Opciones</div>'});
          document.querySelector('#combo').addEventListener('keydown', event => {
            if(event.key === 'Escape') {document.querySelector('#options').hidden = true; event.stopPropagation();}
          });
        }''')
        page.keyboard.press('Escape')
        assert page.locator('[role=dialog]').count() == 2
        assert page.locator('#options').evaluate('(el) => el.hidden')
        page.evaluate('''async () => {
          await closeAllOverlays();
          history.replaceState({}, '', '#productos');
          window.navigated = true;
        }''')
        page.wait_for_function('window.navigated')
        assert page.locator('[role=dialog]').count() == 0
        page.go_back()
        assert page.url.endswith('#clientes')
        assert page.locator('[role=dialog]').count() == 0
        page.evaluate('''async () => {
          const {confirmDialog} = await import('/src/ui/confirm.js');
          window.panel = openOverlay({kind:'panel', title:'Ficha', body:'<button id="panel-button">Editar</button>'});
          window.result = null;
          confirmDialog({title:'Eliminar', danger:true}).then(value => window.result = value);
        }''')
        page.keyboard.press('Escape')
        page.wait_for_function('window.result === false')
        page.wait_for_timeout(100)
        assert page.locator('[role=dialog]').count() == 1
        assert page.locator('#panel-button').evaluate('(el) => el === document.activeElement')
        print('PASS: Escape de combobox, navegar consume historial, confirmación cancelada y temporizador sin robo de foco.')
        page.close()

        page = fixture(browser)
        # No esperar una Promise que requiere un clic posterior desde Playwright.
        page.evaluate('''() => {
          window.chain = (async () => {
            const {confirmDialog} = await import('/src/ui/confirm.js');
            const {openModal} = await import('/src/ui/modal.js');
            window.parentModal = openModal({title:'Ficha', body:'<button id="parent-button">Acción</button>'});
            const ok = await confirmDialog({title:'Fusionar', danger:true});
            if (!ok) throw Error('No se aceptó');
            window.next = openModal({title:'Destino', body:'<input id="next-input">'});
            window.chained = true;
          })();
        }''')
        page.locator('.confirm-submit-btn').click()
        page.wait_for_function('window.chained')
        page.wait_for_timeout(100)
        assert page.locator('[role=dialog]').count() == 2
        assert page.get_by_role('dialog', name='Destino').count() == 1
        page.keyboard.press('Escape')
        page.wait_for_function('document.querySelectorAll("[role=dialog]").length === 1')
        assert page.get_by_role('dialog', name='Ficha').count() == 1
        page.go_back()
        page.wait_for_function('document.querySelectorAll("[role=dialog]").length === 0')
        assert page.url.endswith('#clientes')
        print('PASS: await confirmDialog → nuevo modal inmediato conserva capas e historial; Escape y atrás cierran el correcto.')
        browser.close()
finally:
    server.shutdown()
    server.server_close()
