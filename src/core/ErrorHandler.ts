import { Logger } from './Logger';

const logger = new Logger('ErrorHandler');

export class ErrorHandler {
  public static init(): void {
    window.addEventListener('error', (event) => {
      logger.error('Unhandled runtime error:', event.error || event.message);
    });

    window.addEventListener('unhandledrejection', (event) => {
      logger.error('Unhandled Promise rejection:', event.reason);
    });
  }

  public static isWebGLAvailable(): boolean {
    try {
      const canvas = document.createElement('canvas');
      return !!(
        window.WebGLRenderingContext &&
        (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
      );
    } catch {
      return false;
    }
  }

  public static isWebGL2Available(): boolean {
    try {
      const canvas = document.createElement('canvas');
      return !!(window.WebGL2RenderingContext && canvas.getContext('webgl2'));
    } catch {
      return false;
    }
  }
}
