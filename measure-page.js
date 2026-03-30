(() => {
  const controllerKey = "__chromePageHeightOverlay";

  class PageHeightOverlayController {
    constructor() {
      this.toastId = "__chrome_page_height_toast__";
      this.styleId = "__chrome_page_height_toast_style__";
      this.cssPixelTo72DpiRatio = 72 / 96;
      this.numberFormatter = new Intl.NumberFormat();
      this.mode = "page";
      this.enabled = false;
      this.lastRenderedMessage = null;
      this.resizeObserver = null;
      this.mutationObserver = null;
      this.updateScheduled = false;
      this.handleViewportChange = this.scheduleUpdate.bind(this);
      this.handleScroll = this.scheduleUpdate.bind(this);
      this.handleToggleClick = this.handleToggleClick.bind(this);
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
      this.mode = "page";
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
      this.mode = "page";
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
          display: grid;
          gap: 4px;
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
        #${this.toastId} .chrome-page-height__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }
        #${this.toastId} .chrome-page-height__label {
          display: block;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: rgba(255, 255, 255, 0.7);
        }
        #${this.toastId} .chrome-page-height__primary {
          display: block;
          font-weight: 700;
        }
        #${this.toastId} .chrome-page-height__secondary {
          display: block;
          font-size: 13px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.6);
        }
        #${this.toastId} .chrome-page-height__toggle {
          display: inline-grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 2px;
          padding: 2px;
          border: 1px solid rgba(255, 255, 255, 0.16);
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.08);
          color: rgba(255, 255, 255, 0.68);
          font: 600 10px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          cursor: pointer;
          pointer-events: auto;
        }
        #${this.toastId} .chrome-page-height__toggle-option {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 54px;
          padding: 5px 8px;
          border-radius: 999px;
          transition: background 140ms ease, color 140ms ease;
        }
        #${this.toastId} .chrome-page-height__toggle[data-mode="page"] .chrome-page-height__toggle-option--page,
        #${this.toastId} .chrome-page-height__toggle[data-mode="scroll"] .chrome-page-height__toggle-option--scroll {
          background: rgba(255, 255, 255, 0.95);
          color: #101010;
        }
        #${this.toastId} .chrome-page-height__toggle:focus-visible {
          outline: 2px solid rgba(255, 255, 255, 0.9);
          outline-offset: 2px;
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

      const header = document.createElement("div");
      header.className = "chrome-page-height__header";

      const label = document.createElement("span");
      label.className = "chrome-page-height__label";
      header.appendChild(label);

      const toggle = document.createElement("button");
      toggle.className = "chrome-page-height__toggle";
      toggle.type = "button";
      toggle.setAttribute("aria-label", "Toggle height mode");
      toggle.addEventListener("click", this.handleToggleClick);

      const pageOption = document.createElement("span");
      pageOption.className = "chrome-page-height__toggle-option chrome-page-height__toggle-option--page";
      pageOption.textContent = "Page";

      const scrollOption = document.createElement("span");
      scrollOption.className = "chrome-page-height__toggle-option chrome-page-height__toggle-option--scroll";
      scrollOption.textContent = "Scroll";

      toggle.append(pageOption, scrollOption);
      header.appendChild(toggle);

      const primary = document.createElement("span");
      primary.className = "chrome-page-height__primary";

      const secondary = document.createElement("span");
      secondary.className = "chrome-page-height__secondary";

      toast.append(header, primary, secondary);
      container.appendChild(toast);

      return toast;
    }

    removeToast() {
      const toast = document.getElementById(this.toastId);
      const toggle = toast?.querySelector(".chrome-page-height__toggle");
      toggle?.removeEventListener("click", this.handleToggleClick);
      toast?.remove();
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

    handleToggleClick(event) {
      event.preventDefault();
      event.stopPropagation();
      this.mode = this.mode === "page" ? "scroll" : "page";
      this.lastRenderedMessage = null;
      this.renderHeight();
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
      const labelNode = toast?.querySelector(".chrome-page-height__label");
      const toggleNode = toast?.querySelector(".chrome-page-height__toggle");
      const primaryNode = toast?.querySelector(".chrome-page-height__primary");
      const secondaryNode = toast?.querySelector(".chrome-page-height__secondary");

      if (!labelNode || !toggleNode || !primaryNode || !secondaryNode) {
        return;
      }

      const pageHeight = this.getDocumentHeight();
      const cssHeight = this.mode === "page" ? pageHeight : this.getScrollHeight(pageHeight);
      const title = this.mode === "page" ? "PAGE HEIGHT" : "SCROLL HEIGHT";
      const toggleState = this.mode;
      const heightAt72Dpi = Math.round(cssHeight * this.cssPixelTo72DpiRatio);
      const primaryMessage = `${this.formatNumber(heightAt72Dpi)} px @ 72 dpi`;
      const secondaryMessage = `${this.formatNumber(cssHeight)} CSS px @ 96 dpi`;
      const message = `${title}\n${toggleState}\n${primaryMessage}\n${secondaryMessage}`;

      if (message === this.lastRenderedMessage) {
        return;
      }

      this.lastRenderedMessage = message;
      labelNode.textContent = title;
      toggleNode.dataset.mode = toggleState;
      toggleNode.setAttribute("aria-pressed", String(toggleState === "scroll"));
      primaryNode.textContent = primaryMessage;
      secondaryNode.textContent = secondaryMessage;
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
