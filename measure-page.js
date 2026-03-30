(() => {
  const controllerKey = "__chromePageHeightOverlay";

  class PageHeightOverlayController {
    constructor() {
      this.toastId = "__chrome_page_height_toast__";
      this.styleId = "__chrome_page_height_toast_style__";
      this.cssPixelTo72DpiRatio = 72 / 96;
      this.numberFormatter = new Intl.NumberFormat();
      this.enabled = false;
      this.lastRenderedMessage = null;
      this.resizeObserver = null;
      this.mutationObserver = null;
      this.updateScheduled = false;
      this.handleViewportChange = this.scheduleUpdate.bind(this);
      this.handleScroll = this.scheduleUpdate.bind(this);
    }

    isEnabled() {
      return this.enabled;
    }

    toggle() {
      if (this.enabled) {
        this.disable();
        return false;
      }

      this.enable();
      return true;
    }

    enable() {
      if (this.enabled) {
        return;
      }

      this.enabled = true;
      this.ensureStyles();
      this.ensureToast();
      this.renderHeight();

      window.addEventListener("resize", this.handleViewportChange, { passive: true });
      window.addEventListener("scroll", this.handleScroll, { passive: true });

      if ("ResizeObserver" in globalThis) {
        this.resizeObserver = new ResizeObserver(() => this.scheduleUpdate());
        this.resizeObserver.observe(document.documentElement);

        if (document.body) {
          this.resizeObserver.observe(document.body);
        }
      }

      this.mutationObserver = new MutationObserver((mutations) => {
        const hasExternalMutation = mutations.some((mutation) => !this.isInternalMutation(mutation));

        if (hasExternalMutation) {
          this.scheduleUpdate();
        }
      });
      this.mutationObserver.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: true,
      });
    }

    disable() {
      if (!this.enabled) {
        return;
      }

      this.enabled = false;
      this.lastRenderedMessage = null;
      this.resizeObserver?.disconnect();
      this.resizeObserver = null;
      this.mutationObserver?.disconnect();
      this.mutationObserver = null;
      window.removeEventListener("resize", this.handleViewportChange);
      window.removeEventListener("scroll", this.handleScroll);
      this.removeToast();
    }

    getDocumentHeight() {
      const body = document.body;
      const root = document.documentElement;

      return Math.max(
        body?.scrollHeight ?? 0,
        body?.offsetHeight ?? 0,
        body?.clientHeight ?? 0,
        root?.scrollHeight ?? 0,
        root?.offsetHeight ?? 0,
        root?.clientHeight ?? 0
      );
    }

    getContainer() {
      return document.body ?? document.documentElement;
    }

    ensureStyles() {
      if (document.getElementById(this.styleId)) {
        return;
      }

      const style = document.createElement("style");
      style.id = this.styleId;
      style.textContent = `
        #${this.toastId} {
          position: fixed;
          right: 20px;
          bottom: 20px;
          z-index: 2147483647;
          max-width: min(360px, calc(100vw - 32px));
          padding: 12px 14px;
          border-radius: 12px;
          background: rgba(18, 18, 18, 0.92);
          color: #ffffff;
          box-shadow: 0 18px 40px rgba(0, 0, 0, 0.24);
          font: 600 14px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          letter-spacing: 0.01em;
          pointer-events: none;
        }
        #${this.toastId} .chrome-page-height__table {
          width: 100%;
          border-collapse: collapse;
          border-spacing: 0;
          table-layout: fixed;
        }
        #${this.toastId} .chrome-page-height__table th,
        #${this.toastId} .chrome-page-height__table td {
          padding: 8px 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.16);
        }
        #${this.toastId} .chrome-page-height__table th {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.72);
        }
        #${this.toastId} .chrome-page-height__table td {
          font-size: 14px;
          color: #ffffff;
          font-variant-numeric: tabular-nums;
        }
        #${this.toastId} .chrome-page-height__table th:first-child,
        #${this.toastId} .chrome-page-height__table td:first-child {
          padding-right: 18px;
          text-align: left;
          font-weight: 700;
        }
        #${this.toastId} .chrome-page-height__table th:nth-child(2),
        #${this.toastId} .chrome-page-height__table th:nth-child(3),
        #${this.toastId} .chrome-page-height__table td:nth-child(2),
        #${this.toastId} .chrome-page-height__table td:nth-child(3) {
          text-align: right;
        }
        #${this.toastId} .chrome-page-height__table td:nth-child(2),
        #${this.toastId} .chrome-page-height__table td:nth-child(3) {
          font-weight: 500;
          color: rgba(255, 255, 255, 0.88);
        }
        #${this.toastId} .chrome-page-height__table thead th {
          border-top: 0;
        }
        #${this.toastId} .chrome-page-height__column--label {
          width: 28%;
        }
        #${this.toastId} .chrome-page-height__column--value {
          width: 36%;
        }
      `;

      document.documentElement.appendChild(style);
    }

    ensureToast() {
      let toast = document.getElementById(this.toastId);
      if (toast) {
        return toast;
      }

      const container = this.getContainer();
      if (!container) {
        return null;
      }

      toast = document.createElement("div");
      toast.id = this.toastId;
      toast.setAttribute("role", "status");
      toast.setAttribute("aria-live", "polite");

      const table = document.createElement("table");
      table.className = "chrome-page-height__table";

      const colgroup = document.createElement("colgroup");
      const labelColumn = document.createElement("col");
      labelColumn.className = "chrome-page-height__column--label";
      const firstValueColumn = document.createElement("col");
      firstValueColumn.className = "chrome-page-height__column--value";
      const secondValueColumn = document.createElement("col");
      secondValueColumn.className = "chrome-page-height__column--value";
      colgroup.append(labelColumn, firstValueColumn, secondValueColumn);

      const thead = document.createElement("thead");
      const headerRow = document.createElement("tr");

      const pxHeader = document.createElement("th");
      pxHeader.scope = "col";
      pxHeader.textContent = "PX";

      const dpi72Header = document.createElement("th");
      dpi72Header.scope = "col";
      dpi72Header.textContent = "@72 dpi";

      const dpi96Header = document.createElement("th");
      dpi96Header.scope = "col";
      dpi96Header.textContent = "@ 96 dpi";

      headerRow.append(pxHeader, dpi72Header, dpi96Header);
      thead.appendChild(headerRow);

      const tbody = document.createElement("tbody");

      const scrollRow = document.createElement("tr");
      scrollRow.className = "chrome-page-height__row chrome-page-height__row--scroll";

      const scrollLabel = document.createElement("td");
      scrollLabel.textContent = "Scroll";

      const scroll72 = document.createElement("td");
      scroll72.className = "chrome-page-height__value chrome-page-height__value--scroll-72";

      const scroll96 = document.createElement("td");
      scroll96.className = "chrome-page-height__value chrome-page-height__value--scroll-96";

      scrollRow.append(scrollLabel, scroll72, scroll96);

      const pageRow = document.createElement("tr");
      pageRow.className = "chrome-page-height__row chrome-page-height__row--page";

      const pageLabel = document.createElement("td");
      pageLabel.textContent = "Page";

      const page72 = document.createElement("td");
      page72.className = "chrome-page-height__value chrome-page-height__value--page-72";

      const page96 = document.createElement("td");
      page96.className = "chrome-page-height__value chrome-page-height__value--page-96";

      pageRow.append(pageLabel, page72, page96);
      tbody.append(scrollRow, pageRow);
      table.append(colgroup, thead, tbody);
      toast.appendChild(table);
      container.appendChild(toast);

      return toast;
    }

    removeToast() {
      document.getElementById(this.toastId)?.remove();
    }

    isInternalMutation(mutation) {
      const toast = document.getElementById(this.toastId);
      if (!toast) {
        return false;
      }

      return mutation.target === toast || toast.contains(mutation.target);
    }

    scheduleUpdate() {
      if (!this.enabled || this.updateScheduled) {
        return;
      }

      this.updateScheduled = true;
      window.requestAnimationFrame(() => {
        this.updateScheduled = false;
        this.renderHeight();
      });
    }

    formatNumber(value) {
      return this.numberFormatter.format(value);
    }

    getScrollHeight(pageHeight) {
      const scrollOffset =
        window.scrollY ??
        window.pageYOffset ??
        document.documentElement.scrollTop ??
        document.body?.scrollTop ??
        0;
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
      const scrollHeight = Math.round(scrollOffset + viewportHeight);

      return Math.min(pageHeight, Math.max(viewportHeight, scrollHeight));
    }

    renderHeight() {
      if (!this.enabled) {
        return;
      }

      const toast = this.ensureToast();
      const scroll72Node = toast?.querySelector(".chrome-page-height__value--scroll-72");
      const scroll96Node = toast?.querySelector(".chrome-page-height__value--scroll-96");
      const page72Node = toast?.querySelector(".chrome-page-height__value--page-72");
      const page96Node = toast?.querySelector(".chrome-page-height__value--page-96");

      if (!scroll72Node || !scroll96Node || !page72Node || !page96Node) {
        return;
      }

      const pageHeight = this.getDocumentHeight();
      const scrollHeight = this.getScrollHeight(pageHeight);
      const scroll72 = this.formatNumber(Math.round(scrollHeight * this.cssPixelTo72DpiRatio));
      const scroll96 = this.formatNumber(scrollHeight);
      const page72 = this.formatNumber(Math.round(pageHeight * this.cssPixelTo72DpiRatio));
      const page96 = this.formatNumber(pageHeight);
      const message = `${scroll72}\n${scroll96}\n${page72}\n${page96}`;

      if (message === this.lastRenderedMessage) {
        return;
      }

      this.lastRenderedMessage = message;
      scroll72Node.textContent = scroll72;
      scroll96Node.textContent = scroll96;
      page72Node.textContent = page72;
      page96Node.textContent = page96;
    }
  }

  let controller = globalThis[controllerKey];
  const hasControllerShape =
    controller &&
    typeof controller.toggle === "function" &&
    typeof controller.isEnabled === "function";

  if (!hasControllerShape) {
    controller = new PageHeightOverlayController();
    globalThis[controllerKey] = controller;
  }

  controller.toggle();
})();
