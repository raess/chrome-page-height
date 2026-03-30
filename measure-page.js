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
          gap: 2px;
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

      const label = document.createElement("span");
      label.className = "chrome-page-height__label";
      label.textContent = "PAGE HEIGHT";

      const primary = document.createElement("span");
      primary.className = "chrome-page-height__primary";

      const secondary = document.createElement("span");
      secondary.className = "chrome-page-height__secondary";

      toast.append(label, primary, secondary);
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

    renderHeight() {
      if (!this.enabled) {
        return;
      }

      const toast = this.ensureToast();
      const primaryNode = toast?.querySelector(".chrome-page-height__primary");
      const secondaryNode = toast?.querySelector(".chrome-page-height__secondary");

      if (!primaryNode || !secondaryNode) {
        return;
      }

      const cssHeight = this.getDocumentHeight();
      const heightAt72Dpi = Math.round(cssHeight * this.cssPixelTo72DpiRatio);
      const primaryMessage = `${this.formatNumber(heightAt72Dpi)} px @ 72 dpi`;
      const secondaryMessage = `${this.formatNumber(cssHeight)} CSS px @ 96 dpi`;
      const message = `${primaryMessage}\n${secondaryMessage}`;

      if (message === this.lastRenderedMessage) {
        return;
      }

      this.lastRenderedMessage = message;
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
