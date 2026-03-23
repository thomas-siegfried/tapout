import {
  koprop,
  getObservable,
  kocomputedprop,
  koextend,
} from "../src/ko/ko.properties.js";
import ko from "knockout";
import { observe } from "../src/ko/effects.js";
describe("Properties", () => {
  class MyClass {
    public a = 1;
    @koprop
    public x: number = 0;
    @kocomputedprop
    public get y(): number {
      return this.x * 2;
    }
    @koprop
    private _z = 0;
    @kocomputedprop
    public get z(): number {
      return this._z;
    }
    public set z(val: number) {
      this._z = val;
    }
  }
  it("koprop makes a property reactive", () => {
    var cls = new MyClass();
    var spy = jasmine.createSpy();
    observe(() => cls.x, spy);
    cls.x = 1;
    expect(spy).toHaveBeenCalled();
  });
  it("kocomputed makes a getter reactive", () => {
    var cls = new MyClass();
    var spy = jasmine.createSpy();
    cls.y; //this is hacky, observable not created until we call getter.
    var obs = getObservable(cls, "y");
    obs.subscribe(spy);
    cls.x = 1;
    expect(spy).toHaveBeenCalled();
  });
  it("kocomputed covers getter and setter", () => {
    var cls = new MyClass();
    var spy = jasmine.createSpy();
    //init the observable
    cls.z;
    var obs = getObservable(cls, "z");
    obs.subscribe(spy);
    cls.z = 1;
    expect(spy).toHaveBeenCalled();
  });
});

describe("extenders", () => {
  class MyClass {
    @koprop
    @koextend({ notify: "always" })
    name: string = "";

    get fullname() {
      return this.name.toUpperCase();
    }
  }
  it("can extend properties", () => {
    var cls = new MyClass();
    var spy = jasmine.createSpy();
    observe(() => cls.name, spy);
    cls.name = "";

    expect(spy).toHaveBeenCalled();
  });

  it("can extend computeds", () => {
    var cls = new MyClass();
    cls.name = "me";
    var spy = jasmine.createSpy();
    observe(() => cls.fullname, spy);
    cls.name = cls.name;

    expect(spy).toHaveBeenCalled();
  });
});
