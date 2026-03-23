//Bind the function to the owning class
export function Bind(
  _target: any,
  _propertyKey: string,
  descriptor: PropertyDescriptor
): void {
  const originalMethod = descriptor.value;

  delete descriptor.writable;
  delete descriptor.value;
  descriptor.get = function () {
    var _this = this;
    return function (this: any, ...args: any[]) {
      return originalMethod.apply(_this, args);
    };
  };
}
