// Shell administrativo para PRO VENTAS GC
// Maneja sidebar colapsable (escritorio: 230px / 68px), drawer móvil, backdrop, menú de usuario y persistencia en localStorage.

const SIDEBAR_COLLAPSED_KEY = 'pv_sidebar_collapsed';

// Iconos SVG en línea consistentes con el diseño y Lucide
const SHELL_ICONS = {
  menu: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>`,
  subscriptions: `<svg class="nav-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"></rect><path d="M3 10h18"></path><path d="M8 14h.01"></path><path d="M12 14h.01"></path><path d="M16 14h.01"></path></svg>`,
  logout: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>`,
  close: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`,
  collapse: `<svg class="collapse-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"></polyline></svg>`
};

/**
 * Genera el markup estructural del shell administrativo
 * @param {Object} options
 * @param {string} options.userName - Nombre del usuario activo
 * @param {string} options.contentHtml - HTML del contenido principal
 * @returns {string} Markup HTML del shell completo
 */
export function renderShellMarkup({ userName = '', contentHtml = '' }) {
  const safeUser = userName || 'Usuario';
  const initial = safeUser.charAt(0).toUpperCase();

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
          <div class="nav-section-label">Gestión</div>
          <a href="#suscripciones" class="nav-item active" data-nav="subscriptions" data-tooltip="Suscripciones" aria-current="page">
            ${SHELL_ICONS.subscriptions}
            <span class="nav-text">Suscripciones</span>
          </a>
        </nav>

        <div class="sidebar-footer">
          <button id="sidebarUserBtn" class="sidebar-user" type="button" aria-haspopup="menu" aria-expanded="false" aria-label="Opciones de usuario: ${safeUser}" title="${safeUser}">
            <div class="user-avatar" aria-hidden="true">${initial}<span class="status-indicator"></span></div>
            <div class="user-info">
              <span class="user-name">${safeUser}</span>
              <span class="user-role">Administrador</span>
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

          <div class="topbar-actions">
            <!-- Botón de catálogo preservado de forma no visible para compatibilidad con app.js -->
            <button id="catalogBtn" type="button" class="hidden" style="display: none;" hidden aria-hidden="true"></button>
          </div>
        </header>

        <main id="mainContent" class="main app-main">
          ${contentHtml}
        </main>
      </div>

      <div id="modalHost"></div>
    </div>
  `;
}

/**
 * Inicializa el comportamiento interactivo del shell:
 * - Colapso en escritorio con persistencia en localStorage
 * - Botón de contraer en la cabecera de la sidebar
 * - Menú contextual de usuario en la tarjeta inferior
 * - Drawer en móvil con backdrop, tecla Escape y bloqueo de scroll
 * @param {Object} callbacks
 * @param {Function} callbacks.onLogout - Callback al hacer click en Cerrar sesión
 */
export function initShell({ onLogout } = {}) {
  const sidebar = document.querySelector('#appSidebar');
  const toggleBtn = document.querySelector('#sidebarToggleBtn');
  const collapseBtn = document.querySelector('#sidebarCollapseBtn');
  const sidebarBrand = document.querySelector('#appSidebar .sidebar-brand');
  const closeBtn = document.querySelector('#sidebarCloseBtn');
  const backdrop = document.querySelector('#sidebarBackdrop');
  const userBtn = document.querySelector('#sidebarUserBtn');
  const userMenu = document.querySelector('#userContextMenu');
  const userLogoutBtn = document.querySelector('#userLogoutBtn');

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
  };

  // Drawer móvil: Cerrar
  const closeDrawer = () => {
    sidebar.classList.remove('drawer-open');
    if (backdrop) backdrop.hidden = true;
    document.body.classList.remove('drawer-locked');
    if (toggleBtn) {
      toggleBtn.setAttribute('aria-expanded', 'false');
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
}
