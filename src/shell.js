// Shell administrativo para PRO VENTAS GC
// Maneja sidebar colapsable (escritorio: 304px / 68px), barra inferior móvil, drawer móvil, backdrop, menú de usuario y títulos de página.

import { ICONS } from './ui/icons.js';

const SIDEBAR_COLLAPSED_KEY = 'pv_sidebar_collapsed';

const SECTION_TITLES = {
  inicio: 'Inicio',
  subscriptions: 'Suscripciones',
  clientes: 'Clientes',
  productos: 'Catálogo',
  proveedores: 'Proveedores',
  whatsappTemplates: 'Plantillas WhatsApp',
  subscriptionForm: 'Suscripción'
};

export function updateDocumentTitle(navKey) {
  const sectionName = SECTION_TITLES[navKey] || 'Panel';
  document.title = `${sectionName} — PRO VENTAS GC`;
}

// Iconos reutilizados desde ui/icons.js con compatibilidad
const SHELL_ICONS = {
  menu: ICONS.menu,
  home: ICONS.home,
  subscriptions: ICONS.subscriptions,
  clients: ICONS.users,
  products: ICONS.products,
  providers: ICONS.providers,
  whatsapp: ICONS.messageSquare,
  logout: ICONS.logout,
  close: ICONS.close,
  collapse: ICONS.collapse,
  sun: ICONS.sun,
  moon: ICONS.moon,
  plus: ICONS.plus
};

/**
 * Genera el markup estructural del shell administrativo
 * @param {Object} options
 * @param {string} options.userName - Nombre del usuario activo
 * @param {string} options.contentHtml - HTML del contenido principal
 * @param {string} options.activeNav - Sección activa ('inicio', 'subscriptions', etc.)
 * @returns {string} Markup HTML del shell completo
 */
export function renderShellMarkup({ userName = '', contentHtml = '', activeNav = 'inicio' }) {
  const safeUser = userName || 'Usuario';
  const initial = safeUser.charAt(0).toUpperCase();
  const isInicio = activeNav === 'inicio';
  const isSubs = activeNav === 'subscriptions';
  const isClients = activeNav === 'clientes';

  return `
    <div class="app-layout">
      <!-- Backdrop para drawer móvil -->
      <div id="sidebarBackdrop" class="sidebar-backdrop" hidden></div>

      <!-- Sidebar lateral -->
      <aside id="appSidebar" class="app-sidebar" aria-label="Navegación principal">
        <div class="sidebar-header">
          <div class="sidebar-brand">
            <div class="brand-mark" aria-hidden="true">GC</div>
            <div class="brand-text">
              <span class="brand-title">PRO VENTAS GC</span>
              <span class="brand-subtitle">Panel de Control</span>
            </div>
          </div>
          <button id="sidebarCollapseBtn" class="sidebar-collapse-btn" type="button" aria-label="Contraer barra lateral" title="Contraer barra lateral">
            ${SHELL_ICONS.collapse}
          </button>
          <button id="sidebarCloseBtn" class="sidebar-close-btn" type="button" aria-label="Cerrar menú">
            ${SHELL_ICONS.close}
          </button>
        </div>

        <nav class="sidebar-nav" aria-label="Módulos">
          <div class="sidebar-quick-action">
            <button id="sidebarNewSubBtn" class="btn btn-primary btn-sidebar-new" type="button" title="Registrar nueva suscripción">
              ${SHELL_ICONS.plus}
              <span class="nav-text">Nueva suscripción</span>
            </button>
          </div>

          <div class="nav-section-label">Operación</div>
          <a href="#inicio" class="nav-item ${isInicio ? 'active' : ''}" data-nav="inicio" data-tooltip="Inicio" ${isInicio ? 'aria-current="page"' : ''}>
            ${SHELL_ICONS.home}
            <span class="nav-text">Inicio</span>
          </a>
          <a href="#suscripciones" class="nav-item ${isSubs ? 'active' : ''}" data-nav="subscriptions" data-tooltip="Suscripciones" ${isSubs ? 'aria-current="page"' : ''}>
            ${SHELL_ICONS.subscriptions}
            <span class="nav-text">Suscripciones</span>
          </a>
          <a href="#clientes" class="nav-item ${isClients ? 'active' : ''}" data-nav="clientes" data-tooltip="Clientes" ${isClients ? 'aria-current="page"' : ''}>
            ${SHELL_ICONS.clients}
            <span class="nav-text">Clientes</span>
          </a>

          <div class="nav-section-label nav-section-config">Configuración</div>
          <a href="#productos" class="nav-item ${activeNav === 'productos' ? 'active' : ''}" data-nav="productos" data-tooltip="Catálogo" ${activeNav === 'productos' ? 'aria-current="page"' : ''}>
            ${SHELL_ICONS.products}
            <span class="nav-text">Catálogo</span>
          </a>
          <a href="#proveedores" class="nav-item ${activeNav === 'proveedores' ? 'active' : ''}" data-nav="proveedores" data-tooltip="Proveedores" ${activeNav === 'proveedores' ? 'aria-current="page"' : ''}>
            ${SHELL_ICONS.providers}
            <span class="nav-text">Proveedores</span>
          </a>
          <a href="#whatsapp-templates" class="nav-item ${activeNav === 'whatsappTemplates' ? 'active' : ''}" data-nav="whatsappTemplates" data-tooltip="WhatsApp" ${activeNav === 'whatsappTemplates' ? 'aria-current="page"' : ''}>
            ${SHELL_ICONS.whatsapp}
            <span class="nav-text">Plantillas WhatsApp</span>
          </a>
        </nav>

        <div class="sidebar-footer">
          <button id="sidebarUserBtn" class="sidebar-user" type="button" aria-haspopup="menu" aria-expanded="false" aria-label="Opciones de usuario: ${safeUser}" title="${safeUser}">
            <div class="user-avatar" aria-hidden="true">${initial}<span class="status-indicator"></span></div>
            <div class="user-info">
              <span class="user-name">${safeUser}</span>
            </div>
          </button>

          <!-- Menú contextual flotante del usuario -->
          <div id="userContextMenu" class="user-context-menu hidden" role="menu" aria-label="Opciones de usuario">
            <button id="userLogoutBtn" class="context-menu-item context-menu-danger" type="button" role="menuitem">
              ${SHELL_ICONS.logout}
              <span>Cerrar sesión</span>
            </button>
          </div>
        </div>
      </aside>

      <!-- Contenedor de la barra superior y contenido -->
      <div class="app-content-wrapper">
        <header class="app-topbar">
          <div class="topbar-left">
            <button id="sidebarToggleBtn" class="topbar-toggle-btn" type="button" aria-label="Abrir menú" aria-expanded="false">
              ${SHELL_ICONS.menu}
            </button>
            <div class="topbar-brand-mini">
              <div class="brand-mark-mini" aria-hidden="true">GC</div>
              <span class="topbar-title">PRO VENTAS GC</span>
            </div>
          </div>
        </header>

        <main id="mainContent" class="main app-main">
          ${contentHtml}
        </main>
      </div>

      <!-- Barra inferior fija para navegación rápida en móvil -->
      <nav id="mobileBottomNav" class="mobile-bottom-nav" aria-label="Navegación móvil rápida">
        <a href="#inicio" class="bottom-nav-item ${isInicio ? 'active' : ''}" data-nav="inicio">
          <span class="bottom-nav-icon">${SHELL_ICONS.home}</span>
          <span class="bottom-nav-label">Inicio</span>
        </a>
        <a href="#suscripciones" class="bottom-nav-item ${isSubs ? 'active' : ''}" data-nav="subscriptions">
          <span class="bottom-nav-icon">${SHELL_ICONS.subscriptions}</span>
          <span class="bottom-nav-label">Suscrip.</span>
        </a>
        <a href="#clientes" class="bottom-nav-item ${isClients ? 'active' : ''}" data-nav="clientes">
          <span class="bottom-nav-icon">${SHELL_ICONS.clients}</span>
          <span class="bottom-nav-label">Clientes</span>
        </a>
        <button id="bottomNavMoreBtn" class="bottom-nav-item bottom-nav-btn" type="button" aria-label="Más opciones de menú" aria-expanded="false">
          <span class="bottom-nav-icon">${SHELL_ICONS.menu}</span>
          <span class="bottom-nav-label">Más</span>
        </button>
      </nav>

      <div id="modalHost"></div>
    </div>
  `;
}

/**
 * Inicializa el comportamiento interactivo del shell:
 * - Colapso en escritorio con persistencia en localStorage
 * - Barra inferior móvil y drawer sincronizado
 * - Menú contextual de usuario en la tarjeta inferior
 * - Actualización dinámica del título de la pestaña del navegador
 * @param {Object} callbacks
 * @param {Function} callbacks.onLogout - Callback al hacer click en Cerrar sesión
 * @param {Function} callbacks.onNavigate - Callback al navegar entre secciones del sidebar (recibe navKey, e)
 * @param {Function} [callbacks.onNewSubscription] - Callback al hacer click en el botón "Nueva suscripción"
 */
export function initShell({ onLogout, onNavigate, onNewSubscription } = {}) {
  const sidebar = document.querySelector('#appSidebar');
  const toggleBtn = document.querySelector('#sidebarToggleBtn');
  const collapseBtn = document.querySelector('#sidebarCollapseBtn');
  const sidebarBrand = document.querySelector('#appSidebar .sidebar-brand');
  const closeBtn = document.querySelector('#sidebarCloseBtn');
  const backdrop = document.querySelector('#sidebarBackdrop');
  const userBtn = document.querySelector('#sidebarUserBtn');
  const userMenu = document.querySelector('#userContextMenu');
  const userLogoutBtn = document.querySelector('#userLogoutBtn');
  const bottomNavMoreBtn = document.querySelector('#bottomNavMoreBtn');

  if (!sidebar) return;

  const isDesktop = () => window.innerWidth >= 992;

  const updateCollapseButtonTitle = (isCollapsed) => {
    if (collapseBtn) {
      const label = isCollapsed ? 'Expandir barra lateral' : 'Contraer barra lateral';
      collapseBtn.setAttribute('title', label);
      collapseBtn.setAttribute('aria-label', label);
    }
  };

  // Restaurar estado contraído en escritorio
  const storedCollapsed = localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
  if (isDesktop() && storedCollapsed) {
    document.body.classList.add('sidebar-collapsed');
    updateCollapseButtonTitle(true);
  } else {
    updateCollapseButtonTitle(false);
  }

  // Drawer móvil: Abrir
  const openDrawer = () => {
    sidebar.classList.add('drawer-open');
    if (backdrop) backdrop.hidden = false;
    document.body.classList.add('drawer-locked');
    if (toggleBtn) {
      toggleBtn.setAttribute('aria-expanded', 'true');
    }
    if (bottomNavMoreBtn) {
      bottomNavMoreBtn.setAttribute('aria-expanded', 'true');
      bottomNavMoreBtn.classList.add('active');
    }
  };

  // Drawer móvil: Cerrar
  const closeDrawer = () => {
    sidebar.classList.remove('drawer-open');
    if (backdrop) backdrop.hidden = true;
    document.body.classList.remove('drawer-locked');
    if (toggleBtn) {
      toggleBtn.setAttribute('aria-expanded', 'false');
    }
    if (bottomNavMoreBtn) {
      bottomNavMoreBtn.setAttribute('aria-expanded', 'false');
      bottomNavMoreBtn.classList.remove('active');
    }
  };

  // Alternar colapso en escritorio
  const toggleDesktop = () => {
    const isNowCollapsed = document.body.classList.toggle('sidebar-collapsed');
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, isNowCollapsed ? 'true' : 'false');
    updateCollapseButtonTitle(isNowCollapsed);
  };

  // Menú contextual del usuario
  const closeUserMenu = () => {
    if (userMenu && !userMenu.classList.contains('hidden')) {
      userMenu.classList.add('hidden');
      if (userBtn) {
        userBtn.setAttribute('aria-expanded', 'false');
      }
    }
  };

  const openUserMenu = () => {
    if (userMenu) {
      userMenu.classList.remove('hidden');
      if (userBtn) {
        userBtn.setAttribute('aria-expanded', 'true');
      }
    }
  };

  const toggleUserMenu = () => {
    if (userMenu) {
      if (userMenu.classList.contains('hidden')) {
        openUserMenu();
      } else {
        closeUserMenu();
      }
    }
  };

  // Sincronizar clases activas en la barra móvil inferior
  const syncBottomNavActive = (targetNav) => {
    document.querySelectorAll('#mobileBottomNav .bottom-nav-item[data-nav]').forEach((btn) => {
      const isTarget = btn.dataset.nav === targetNav ||
        (targetNav === 'subscriptionForm' && btn.dataset.nav === 'subscriptions');
      btn.classList.toggle('active', isTarget);
    });
  };

  // Click en botón de acción rápida "Nueva suscripción"
  const newSubBtn = sidebar.querySelector('#sidebarNewSubBtn');
  if (newSubBtn) {
    newSubBtn.addEventListener('click', () => {
      if (!isDesktop()) {
        closeDrawer();
      }
      if (typeof onNewSubscription === 'function') {
        onNewSubscription();
      }
    });
  }

  // Click en enlaces de navegación del sidebar
  sidebar.querySelectorAll('.sidebar-nav .nav-item').forEach((item) => {
    item.addEventListener('click', (e) => {
      const navKey = item.dataset.nav;
      if (!isDesktop()) {
        closeDrawer();
      }
      updateDocumentTitle(navKey);
      syncBottomNavActive(navKey);
      if (onNavigate) {
        onNavigate(navKey, e);
      }
    });
  });

  // Click en enlaces de la barra inferior móvil
  document.querySelectorAll('#mobileBottomNav .bottom-nav-item[data-nav]').forEach((item) => {
    item.addEventListener('click', (e) => {
      const navKey = item.dataset.nav;
      closeDrawer();
      updateDocumentTitle(navKey);
      syncBottomNavActive(navKey);
      if (onNavigate) {
        onNavigate(navKey, e);
      }
    });
  });

  // Botón "Más" en la barra inferior móvil
  if (bottomNavMoreBtn) {
    bottomNavMoreBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (sidebar.classList.contains('drawer-open')) {
        closeDrawer();
      } else {
        openDrawer();
      }
    });
  }

  // Click en botón hamburguesa en topbar (móvil)
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      if (!isDesktop()) {
        if (sidebar.classList.contains('drawer-open')) {
          closeDrawer();
        } else {
          openDrawer();
        }
      }
    });
  }

  // Click en botón de contraer/expandir de la cabecera (escritorio)
  if (collapseBtn) {
    collapseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (isDesktop()) {
        toggleDesktop();
      }
    });
  }

  // Click en brand al estar colapsado para volver a expandir (escritorio)
  if (sidebarBrand) {
    sidebarBrand.addEventListener('click', () => {
      if (isDesktop() && document.body.classList.contains('sidebar-collapsed')) {
        toggleDesktop();
      }
    });
  }

  // Click en botón cerrar del drawer móvil
  if (closeBtn) {
    closeBtn.addEventListener('click', closeDrawer);
  }

  // Click en backdrop móvil
  if (backdrop) {
    backdrop.addEventListener('click', closeDrawer);
  }

  // Control interactivo de la tarjeta de usuario
  if (userBtn) {
    userBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleUserMenu();
    });
  }

  // Click en Cerrar sesión del menú contextual
  if (userLogoutBtn) {
    userLogoutBtn.addEventListener('click', (e) => {
      closeUserMenu();
      if (onLogout) {
        onLogout(e);
      }
    });
  }

  // Cierre de menú al hacer clic fuera
  const handleDocumentClick = (e) => {
    if (userMenu && !userMenu.classList.contains('hidden')) {
      if (!userMenu.contains(e.target) && !userBtn?.contains(e.target)) {
        closeUserMenu();
      }
    }
  };
  document.addEventListener('click', handleDocumentClick);

  // Tecla Escape: cierra menú contextual si está abierto; si no, cierra drawer móvil
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      if (userMenu && !userMenu.classList.contains('hidden')) {
        closeUserMenu();
        userBtn?.focus();
      } else if (sidebar.classList.contains('drawer-open')) {
        closeDrawer();
      }
    }
  };
  document.addEventListener('keydown', handleKeyDown);

  // Escuchar redimensionamiento para limpiar estado móvil si pasa a escritorio
  const handleResize = () => {
    if (isDesktop() && sidebar.classList.contains('drawer-open')) {
      closeDrawer();
    }
  };
  window.addEventListener('resize', handleResize);

  // Sincronización automática de document.title y estado de navegación
  const syncTitleAndActiveFromDom = () => {
    const activeItem = sidebar.querySelector('.nav-item.active');
    if (activeItem?.dataset?.nav) {
      updateDocumentTitle(activeItem.dataset.nav);
      syncBottomNavActive(activeItem.dataset.nav);
    }
  };

  // Observador de cambios en la clase .active del sidebar
  const navObserver = new MutationObserver(() => {
    syncTitleAndActiveFromDom();
  });
  navObserver.observe(sidebar, { subtree: true, attributes: true, attributeFilter: ['class', 'aria-current'] });

  // Título inicial
  syncTitleAndActiveFromDom();
}
