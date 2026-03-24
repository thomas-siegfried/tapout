export interface Disposable {
  dispose(): void;
}

export class DisposableGroup implements Disposable {
  private _disposables: Disposable[] = [];
  private _isDisposed = false;

  add<T extends Disposable>(disposable: T): T {
    if (this._isDisposed) {
      disposable.dispose();
      return disposable;
    }
    this._disposables.push(disposable);
    return disposable;
  }

  dispose(): void {
    if (!this._isDisposed) {
      this._isDisposed = true;
      const items = this._disposables;
      this._disposables = [];
      for (let i = 0; i < items.length; i++) {
        items[i].dispose();
      }
    }
  }

  get isDisposed(): boolean {
    return this._isDisposed;
  }

  get count(): number {
    return this._disposables.length;
  }
}
