export interface IDisposable {
  dispose(): void;
}

export type DisposableItem = (() => void) | IDisposable;

export class CompositeDisposable implements IDisposable {
  private disposables: Set<DisposableItem> = new Set();

  public add(disposable: DisposableItem): void {
    this.disposables.add(disposable);
  }

  public remove(disposable: DisposableItem): void {
    this.disposables.delete(disposable);
  }

  public dispose(): void {
    for (const item of this.disposables) {
      try {
        if (typeof item === 'function') {
          item();
        } else if (item && typeof item.dispose === 'function') {
          item.dispose();
        }
      } catch (err) {
        console.error('Error during disposal:', err);
      }
    }
    this.disposables.clear();
  }
}
