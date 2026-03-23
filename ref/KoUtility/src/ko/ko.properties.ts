/// <reference types="knockout" />
import ko from "knockout";
//symbols
const KoMap: unique symbol = Symbol("KoMap");
const ArrayExtendedMarker: unique symbol = Symbol();
const PropertyExtenders: unique symbol = Symbol();

//ok, type that defines the symbols mapping to the correct types
//then we convert to this type, maybe offer an Is<X> method for convienence
//allow Object types to convert to this? or just go back to ANY everywhere.
type extendedObject = {
  [KoMap]: Map<string, KnockoutObservable<any>> | undefined;
  [ArrayExtendedMarker]: boolean | undefined;
  [PropertyExtenders]: Map<String, []> | undefined;
};

declare global {
  interface Array<T> {
    [ArrayExtendedMarker]?: boolean;
  }
}

interface ObservableContext {
  target: Object; //runtime object containing an observable
  propertyName: string; //name of the property
  prototype?: Object; //prototype that defines the property
  property?: PropertyDescriptor;
}

//utility
function GetExtenders(prototype: any, property: string): Array<any> {
  var extended = prototype as extendedObject;
  let map: Map<String, []> = (extended[PropertyExtenders] =
    extended[PropertyExtenders] || new Map<String, []>());
  if (!map.has(property)) {
    map.set(property, []);
  }
  return map.get(property) as [];
}

const extendSubscribable = (
  context: ObservableContext,
  sub: KnockoutObservable<any>
): KnockoutObservable<any> => {
  if (context == null) throw "null context provided";
  if (context.prototype == null) throw "null prototype";
  GetExtenders(context.prototype, context.propertyName).forEach((element) => {
    sub = sub.extend(element);
  });
  return sub;
};

const getSubscribable = (
  context: ObservableContext,
  builder?: () => KnockoutObservable<any>
): KnockoutObservable<any> => {
  var map: Map<string, KnockoutObservable<any>> = (context.target[KoMap] =
    context.target[KoMap] || new Map<string, KnockoutObservable<any>>());
  if (!map.has(context.propertyName) && builder) {
    var sub = builder();
    sub = extendSubscribable(context, sub);
    map.set(context.propertyName, sub);
  }
  return map.get(context.propertyName) as KnockoutObservable<any>;
};

const getObs = (context: ObservableContext): KnockoutObservable<any> => {
  var obs = getSubscribable(context, () => ko.observable());
  return obs;
};

const createArrayProxyHandler = (obs: KnockoutObservable<any>): any => {
  let mutators = ["push", "pop", "splice", "shift", "unshift"]; //methods to cause notification
  return {
    get: function (target: any, name: string) {
      if (mutators.includes(name)) {
        var fn = target[name];
        return function () {
          var ret = fn.apply(target, arguments);
          if (obs.valueHasMutated) obs.valueHasMutated();
          return ret;
        };
      } else {
        return target[name];
      }
    },
    set: function (target: any, name: string, value: any) {
      if (typeof name == "string" && !isNaN(parseInt(name))) {
        //notify when setting index properties
        let oldValue = target[name];
        target[name] = value;
        if (value != oldValue && obs.valueHasMutated) obs.valueHasMutated();
      } else {
        target[name] = value;
      }
      return true;
    },
  };
};

const wrapArray = (
  ary: KnockoutObservable<any[]>
): KnockoutObservable<any[]> => {
  var handler = createArrayProxyHandler(ary);

  var c = ko.computed<any[]>({
    write: (val) => {
      if (Array.isArray(val) && !val[ArrayExtendedMarker]) {
        var p = new Proxy(val, handler);
        p[ArrayExtendedMarker] = true;
        ary(p); //set the observable to the proxied array
      } else {
        ary(val); //set the observable to the Array value
      }
    },
    read: () => {
      return ary();
    },
  });
  c(ary()); //reset current value so that it is proxied

  return c;
};
const getArray = (context: ObservableContext) => {
  var obs = getSubscribable(context, () => wrapArray(ko.observableArray()));
  return obs;
};

const getComputed = (context: ObservableContext): KnockoutObservable<any> => {
  let property = context.property as PropertyDescriptor;
  var cmp = getSubscribable(context, () => {
    var cmp2 = ko.computed<any>({
      read: property.get ? property.get.bind(context.target) : () => null,
      write: !!property.set ? property.set.bind(context.target) : undefined,
      deferEvaluation: true,
    });
    (cmp2 as any).marker = "test";
    return cmp2;
  });
  return cmp;
};

//return an exsting observable from an object by key
export function getObservable(target: Object, key: string): any {
  var ext = target as extendedObject;
  return getSubscribable({ propertyName: key, target: ext });
}
export function setObservable(
  target: Object,
  key: string,
  newObservable: KnockoutObservable<any>
): void {
  var ext = target as extendedObject;
  const map: Map<string, KnockoutObservable<any>> = ext[KoMap] || new Map();
  map.set(key, newObservable);
  ext[KoMap] = map;
}

//decorators

export function koinit(_target: any) {
  //noop
}

export function koextend(extender: any) {
  //register the extender with the prototype
  return function (target: any, prop: string) {
    GetExtenders(target, prop).push(extender);
  };
}

export function koprop(target: Object, prop: string): void {
  var ext = target as extendedObject;
  let pd: PropertyDescriptor = {
    get: function () {
      return getObs({ target: this, propertyName: prop, prototype: target })();
    },
    set: function (val) {
      getObs({ target: this, propertyName: prop, prototype: target })(val);
    },
    enumerable: true,
  };
  Object.defineProperty(target, prop, pd);
}

export function koarray(target: Object, prop: string): void {
  let pd: PropertyDescriptor = {
    get: function () {
      return getArray({
        prototype: target,
        target: this,
        propertyName: prop,
      })();
    },
    set: function (val) {
      getArray({ prototype: target, target: this, propertyName: prop })(val);
    },
    enumerable: true,
  };
  Object.defineProperty(target, prop, pd);
}

export function kocomputedprop(
  target: Object,
  prop: string,
  descriptor: PropertyDescriptor
) {
  //save reference to the original get/set methods
  var pd: PropertyDescriptor = {
    get: descriptor.get,
    set: descriptor.set,
  };

  //modify the propoerty descriptor to include call to computed
  descriptor.get = function () {
    var cmp = getComputed({
      prototype: target,
      target: this,
      propertyName: prop,
      property: pd,
    });
    return cmp();
  };
  descriptor.set = function (val) {
    if (!!pd.set) {
      var cmp = getComputed({
        prototype: target,
        target: this,
        propertyName: prop,
        property: pd,
      });
      cmp(val);
    }
  };
  //make sure it is enumerable
  descriptor.enumerable = true;
}

export function kocomputed(
  target: Object,
  prop: string,
  descriptor: PropertyDescriptor
) {
  //here we are just replacing the function a function that reads from a computed stored on the instance
  var originalFunction = descriptor.value;
  var replacementFunction = function (this: Object) {
    var cmp = getSubscribable(
      { propertyName: prop, target: this, prototype: target },
      () => {
        var cmp = ko.computed({
          read: originalFunction.bind(this),
          deferEvaluation: true,
        });
        return cmp;
      }
    );
    return cmp();
  };
  descriptor.value = replacementFunction;
}
//creates a matching writable property with a $ prefix which accepts an Observable and sets the hidden observable of this property
export function koinput(target: Object, prop: string): void {
  // Then add the $propertyName getter that returns the observable
  const getterName = "$" + prop;
  let pd: PropertyDescriptor = {
    set: function (val: KnockoutObservable<any>) {
      setObservable(this, prop, val);
    },
    enumerable: true,
    configurable: true,
  };
  Object.defineProperty(target, getterName, pd);
}

//creates a matching readable property with a $ prefix which returns the hidden observable of this property
export function kooutput(target: Object, prop: string): void {
  // Then add the $propertyName setter that directly sets the observable
  const setterName = "$" + prop;
  let pd: PropertyDescriptor = {
    get: function () {
      // We need a way to replace the observable reference
      return getObservable(this, prop);
    },
    enumerable: true,
    configurable: true,
  };
  Object.defineProperty(target, setterName, pd);
}
